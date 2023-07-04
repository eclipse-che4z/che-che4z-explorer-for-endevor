/*
 * © 2023 Broadcom Inc and/or its subsidiaries; All rights reserved
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Broadcom, Inc. - initial API and implementation
 */

import {
  isErrorEndevorResponse,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
} from '../commands/utils';
import { printHistory } from '../endevor';
import { logger, reporter } from '../globals';
import { fromElementHistoryUri } from '../uri/elementHistoryUri';
import { formatWithNewLines, isError } from '../utils';
import {
  HistoryContentProviderCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/Telemetry';

export const historyContentProvider = (
  configurations: ConnectionConfigurations
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      uri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      logger.trace(
        `Print history uri: \n  ${stringifyWithHiddenCredential(
          JSON.parse(decodeURIComponent(uri.query))
        )}.`
      );
      const uriParams = fromElementHistoryUri(uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print the element history.`,
          `Unable to print the element history because parsing of the element's URI failed with an error:\n${error.message}.`
        );
        return;
      }
      const { serviceId, searchLocationId, element } = uriParams;
      logger.trace(
        `Print history for the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} 
        of ${serviceId.source} connection ${serviceId.name} and ${searchLocationId.source} location ${searchLocationId.name}.`
      );
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service, configuration } = connectionParams;
      const historyResponse = await withNotificationProgress(
        `Printing element: ${element.name} history content`
      )(async (progressReporter) => {
        return printHistory(progressReporter)(service)(configuration)(element);
      });
      if (isErrorEndevorResponse(historyResponse)) {
        const errorMessage = `Unable to print history for the element 
          ${element.environment}/${element.stageNumber}/${element.system}/${
          element.subSystem
        }/${element.type}/${
          element.name
        } because of error:\n${formatWithNewLines(
          historyResponse.details.messages
        )}`;
        logger.error(
          `Unable to print history for the element ${element.name}.`,
          errorMessage
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.HISTORY_CONTENT_PROVIDER_COMPLETED,
          status: HistoryContentProviderCompletedStatus.GENERIC_ERROR,
          error: new Error(errorMessage),
        });
        return;
      }
      if (historyResponse.details && historyResponse.details.returnCode >= 4) {
        logger.warn(
          `History for ${element.name} was printed with warnings.`,
          `History for ${element.environment}/${element.stageNumber}/${
            element.system
          }/${element.subSystem}/${element.type}/${
            element.name
          } was printed with warnings:\n${formatWithNewLines(
            historyResponse.details.messages
          )}`
        );
      }

      reporter.sendTelemetryEvent({
        type: TelemetryEvents.HISTORY_CONTENT_PROVIDER_COMPLETED,
        status: HistoryContentProviderCompletedStatus.SUCCESS,
      });
      return historyResponse.result;
    },
  };
};
