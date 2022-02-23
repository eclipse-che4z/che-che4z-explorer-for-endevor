/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { isError, stringifyWithHiddenCredential } from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
  workspace,
  TextDocument,
} from 'vscode';
import { printElement } from '../endevor';
import { logger, reporter } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';
import {
  ElementContentProviderCompletedStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';

export const elementContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    elementUri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    const uriParams = fromTreeElementUri(elementUri);
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
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_CALLED,
    });
    const { service, element } = uriParams;
    const elementContent = await withNotificationProgress(
      `Printing element: ${element.name} content`
    )((progress) => printElement(progress)(service)(element));
    if (isError(elementContent)) {
      const error = elementContent;
      logger.error(
        `Unable to print element ${element.name} content.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED,
        status: ElementContentProviderCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED,
      context: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED,
      status: ElementContentProviderCompletedStatus.SUCCESS,
    });
    return elementContent;
  },
};

/**
 * {@link elementContentProvider} will be called by VSCode
 *
 * @returns document with element or empty content
 */
export const getElementContent = async (uri: Uri): Promise<TextDocument> => {
  return await workspace.openTextDocument(uri);
};
