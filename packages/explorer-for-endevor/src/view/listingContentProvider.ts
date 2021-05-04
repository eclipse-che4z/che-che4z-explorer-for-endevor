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
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import { printListing } from '../endevor';
import { logger } from '../globals';
import { fromVirtualDocUri } from '../uri';

export const listingContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    uri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    logger.trace(
      `Print listing uri: \n  ${stringifyWithHiddenCredential(
        JSON.parse(uri.query)
      )}`
    );
    const { service, element } = fromVirtualDocUri(uri);
    const listingContent = await printListing({
      report: () => {
        // progress bar is already implemented in command
      },
    })(service)(element);
    if (!listingContent) {
      return;
    }
    return listingContent;
  },
};
