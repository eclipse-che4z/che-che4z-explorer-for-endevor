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
import {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
  workspace,
  TextDocument,
} from 'vscode';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
} from '../commands/utils';
import { printElement } from '../endevor';
import { logger, reporter } from '../globals';
import { fromBasicElementUri } from '../uri/basicElementUri';
import { formatWithNewLines, isError } from '../utils';
import {
  ElementContentProviderCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/Telemetry';

export const elementContentProvider = (
  configurations: ConnectionConfigurations
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      elementUri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      const uriParams = fromBasicElementUri(elementUri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print element content.`,
          `Unable to print element content because parsing of the element's URI failed with error ${error.message}.`
        );
        return;
      }
      logger.trace(
        `Print element uri: \n  ${stringifyWithHiddenCredential(
          JSON.parse(decodeURIComponent(elementUri.query))
        )}.`
      );
      const { serviceId, searchLocationId, element } = uriParams;
      logger.trace(
        `Print the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} 
        of ${serviceId.source} connection ${serviceId.name} and ${searchLocationId.source} location ${searchLocationId.name}.`
      );
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service, configuration } = connectionParams;
      const elementResponse = await withNotificationProgress(
        `Printing element: ${element.name} content`
      )((progress) => printElement(progress)(service)(configuration)(element));
      if (isErrorEndevorResponse(elementResponse)) {
        const errorMessage = `Unable to print content of the element ${
          element.environment
        }/${element.stageNumber}/${element.system}/${element.subSystem}/${
          element.type
        }/${element.name} because of error:\n${formatWithNewLines(
          elementResponse.details.messages
        )}`;
        logger.error(
          `Unable to print element ${element.name} content.`,
          errorMessage
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED,
          status: ElementContentProviderCompletedStatus.GENERIC_ERROR,
          error: new Error(errorMessage),
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED,
        status: ElementContentProviderCompletedStatus.SUCCESS,
      });
      return elementResponse.result;
    },
  };
};

/**
 * {@link elementContentProvider} will be called by VSCode
 *
 * @returns document with element or empty content
 */
export const getElementContent = async (uri: Uri): Promise<TextDocument> => {
  return await workspace.openTextDocument(uri);
};
