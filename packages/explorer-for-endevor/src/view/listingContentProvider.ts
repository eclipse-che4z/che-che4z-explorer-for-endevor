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

import {
  isErrorPrintListingResponse,
  isNoComponentInfoError,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
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
    const listingResult = await printListing({
      report: () => {
        // progress bar is already implemented in command
      },
    })(service)(element);
    if (isErrorPrintListingResponse(listingResult)) {
      const error = listingResult.additionalDetails.error;
      const isNoListing = isNoComponentInfoError(error);
      const logMessage = isNoListing ? logger.info : logger.error;
      logMessage(
        isNoListing
          ? `Listing for the element ${element.name} is not available, try to generate it first.`
          : `Unable to print listing for the element ${element.name}.`,
        `Unable to print listing for the element ${element.name} because of error:\n${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
        context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
        status: ListingContentProviderCompletedStatus.NO_LISTING,
      });
      return;
    }
    if (listingResult.additionalDetails.returnCode >= 4) {
      logger.warn(
        `Listing for ${element.name} was printed with warnings.`,
        `Listing for ${element.name} was printed with warnings:\n${listingResult.additionalDetails.message}`
      );
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
      context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
      status: ListingContentProviderCompletedStatus.SUCCESS,
    });
    return listingResult.content;
  },
};
