/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { logger } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';

export const elementContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    elementUri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    const uriParams = fromTreeElementUri(elementUri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to print element content`,
        `Unable to print element content because of ${error.message}`
      );
      return;
    }
    logger.trace(
      `Print element uri: \n  ${stringifyWithHiddenCredential(
        JSON.parse(elementUri.query)
      )}`
    );
    const { service, element } = uriParams;
    const elementContent = await withNotificationProgress(
      `Printing element: ${element.name} content`
    )((progress) => printElement(progress)(service)(element));
    if (!elementContent) {
      logger.error(
        `Unable to print element: ${element.system}/${element.subSystem}/${element.type}/${element.name} content`
      );
      return;
    }
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
