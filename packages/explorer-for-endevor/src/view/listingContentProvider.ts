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

import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import { printListing } from '../endevor';
import { logger, reporter } from '../globals';
import { fromElementListingUri } from '../uri/elementListingUri';
import { isError } from '../utils';
import {
  ListingContentProviderCompletedStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';

export const listingContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    uri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.LISTING_CONTENT_PROVIDER_CALLED,
    });
    logger.trace(
      `Print listing uri: \n  ${stringifyWithHiddenCredential(
        JSON.parse(decodeURIComponent(uri.query))
      )}.`
    );
    const uriParams = fromElementListingUri(uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to print the element listing.`,
        `Unable to print the element listing because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    const { service, element } = uriParams;
    const listingContent = await printListing({
      report: () => {
        // progress bar is already implemented in command
      },
    })(service)(element);
    if (isError(listingContent)) {
      const error = listingContent;
      logger.error(
        `Unable to print the element ${element.name} listing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
        status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
      context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
      status: ListingContentProviderCompletedStatus.SUCCESS,
    });
    return listingContent;
  },
};
