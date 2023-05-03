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
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import { printListing } from '../endevor';
import { logger, reporter } from '../globals';
import { fromElementListingUri } from '../uri/elementListingUri';
import { formatWithNewLines, isError } from '../utils';
import {
  ListingContentProviderCompletedStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
} from '../commands/utils';

export const listingContentProvider = (
  configurations: ConnectionConfigurations
): TextDocumentContentProvider => {
  return {
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
      const { serviceId, searchLocationId, element } = uriParams;
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service, configuration } = connectionParams;
      const listingResponse = await printListing({
        report: () => {
          // progress bar is already implemented in command
        },
      })(service)(configuration)(element);
      if (isErrorEndevorResponse(listingResponse)) {
        const message = `Unable to print listing for the element ${
          element.name
        } because of error:\n${formatWithNewLines(
          listingResponse.details.messages
        )}.`;
        switch (listingResponse.type) {
          case ErrorResponseType.NO_COMPONENT_INFO_ENDEVOR_ERROR:
            logger.info(
              `Listing for the element ${element.name} is not available, try to generate it first.`,
              message
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
              context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
              status: ListingContentProviderCompletedStatus.NO_LISTING,
            });
            return;
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.error(`Endevor credentials are incorrect or expired.`);
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              // TODO: specific completed status?
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              errorContext: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
              error: new Error(message),
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.error(`Unable to connect to Endevor Web Services.`);
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              // TODO: specific completed status?
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              errorContext: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
              error: new Error(message),
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            logger.error(
              `Unable to print listing for the element ${element.name}.`,
              message
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              error: new Error(message),
            });
            return;
          default:
            throw new UnreachableCaseError(listingResponse.type);
        }
      }
      if (listingResponse.details && listingResponse.details.returnCode >= 4) {
        logger.warn(
          `Listing for ${element.name} was printed with warnings.`,
          `Listing for ${
            element.name
          } was printed with warnings:\n${formatWithNewLines(
            listingResponse.details.messages
          )}`
        );
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
        context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
        status: ListingContentProviderCompletedStatus.SUCCESS,
      });
      return listingResponse.result;
    },
  };
};
