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

import { isErrorEndevorResponse } from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
  workspace,
  TextDocument,
} from 'vscode';
import { printElementAndLogActivity } from '../api/endevor';
import { reporter } from '../globals';
import { fromBasicElementUri } from '../uri/basicElementUri';
import { formatWithNewLines, isError } from '../utils';
import {
  ElementContentProviderCompletedStatus,
  TelemetryEvents,
} from '../telemetry/_doc/Telemetry';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../logger';
import { Action } from '../store/_doc/Actions';
import { EndevorId } from '../store/_doc/v2/Store';
import { EndevorAuthorizedService, SearchLocation } from '../api/_doc/Endevor';

export const elementContentProvider = (
  dispatch: (action: Action) => Promise<void>,
  getConnectionConfiguration: (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) => Promise<
    | {
        service: EndevorAuthorizedService;
        searchLocation: SearchLocation;
      }
    | undefined
    | undefined
  >
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      elementUri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      const logger = createEndevorLogger();
      const uriParams = fromBasicElementUri(elementUri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print element content.`,
          `Unable to print element content because parsing of the element's URI failed with error ${error.message}.`
        );
        return;
      }
      const { serviceId, searchLocationId, element } = uriParams;
      logger.updateContext({ serviceId, searchLocationId });
      logger.traceWithDetails(
        `Print the content of element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} was called.`
      );
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service } = connectionParams;
      const elementResponse = await withNotificationProgress(
        `Printing element ${element.name} content ...`
      )((progress) =>
        printElementAndLogActivity(
          setLogActivityContext(dispatch, {
            serviceId,
            searchLocationId,
            element,
          })
        )(progress)(service)(element)
      );
      if (isErrorEndevorResponse(elementResponse)) {
        const error = new Error(
          `Unable to print the content of element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${element.type}/${
            element.name
          } because of error:\n${formatWithNewLines(
            elementResponse.details.messages
          )}`
        );
        logger.errorWithDetails(
          `Unable to print the content of element ${element.name}.`,
          `${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED,
          status: ElementContentProviderCompletedStatus.GENERIC_ERROR,
          error,
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
