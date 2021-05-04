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

import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import { printElement } from '../endevor';
import { logger } from '../globals';
import { fromVirtualDocUri } from '../uri';

export const elementContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    uri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    logger.trace(
      `Print element uri: \n  ${stringifyWithHiddenCredential(
        JSON.parse(uri.query)
      )}`
    );
    const { service, element } = fromVirtualDocUri(uri);
    const elementContent = await withNotificationProgress(
      `Printing element: ${element.name} content`
    )((progress) => printElement(progress)(service)(element));
    if (!elementContent) {
      logger.error(
        `Unable to print element: ${element.system}/${element.subSystem}/${element.type}/${element.name}`
      );
      return;
    }
    return elementContent;
  },
};
