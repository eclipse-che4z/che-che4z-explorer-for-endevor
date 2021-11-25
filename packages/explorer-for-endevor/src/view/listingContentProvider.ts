/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import { fromElementListingUri } from '../uri/elementListingUri';
import { isError } from '../utils';

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
    const uriParams = fromElementListingUri(uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to show element listing`,
        `Unable to show element listing, because of ${error.message}`
      );
      return;
    }
    const { service, element } = uriParams;
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
