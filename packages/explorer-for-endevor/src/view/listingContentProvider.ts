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
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import type {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
} from 'vscode';
import { printListingAndLogActivity } from '../api/endevor';
import { reporter } from '../globals';
import { fromElementListingUri } from '../uri/elementListingUri';
import { formatWithNewLines, isError } from '../utils';
import {
  ListingContentProviderCompletedStatus,
  TelemetryEvents,
} from '../telemetry/_doc/Telemetry';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../logger';
import { Action } from '../store/_doc/Actions';
import { EndevorId } from '../store/_doc/v2/Store';
import { EndevorAuthorizedService, SearchLocation } from '../api/_doc/Endevor';

export const listingContentProvider = (
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
  >
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      uri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      const logger = createEndevorLogger();
      const uriParams = fromElementListingUri(uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print element listing.`,
          `Unable to print element listing because parsing of the element's URI failed with an error:\n${error.message}.`
        );
        return;
      }
      const { serviceId, searchLocationId, element } = uriParams;
      logger.updateContext({ serviceId, searchLocationId });
      logger.traceWithDetails(
        `Print a listing for element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} was called.`
      );
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service } = connectionParams;
      const listingResponse = await printListingAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )({
        report: () => {
          // progress bar is already implemented in command
        },
      })(service)(element);
      if (isErrorEndevorResponse(listingResponse)) {
        const error = new Error(`Unable to print a listing for element 
          ${element.environment}/${element.stageNumber}/${element.system}/${
          element.subSystem
        }/${element.type}/${element.name} 
          because of error:\n${formatWithNewLines(
            listingResponse.details.messages
          )}.`);
        switch (listingResponse.type) {
          case ErrorResponseType.NO_COMPONENT_INFO_ENDEVOR_ERROR:
            logger.infoWithDetails(
              `Listing for element ${element.name} is not available, try to generate it first.`,
              `${error.message}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
              status: ListingContentProviderCompletedStatus.NO_LISTING,
              error,
            });
            return;
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.errorWithDetails(
              `Endevor credentials are incorrect or expired.`,
              `${error.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              error,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.errorWithDetails(
              `Unable to connect to Endevor Web Services.`,
              `${error.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              error,
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            logger.errorWithDetails(
              `Unable to print a listing for element ${element.name}.`,
              `${error.message}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
              status: ListingContentProviderCompletedStatus.GENERIC_ERROR,
              error,
            });
            return;
          default:
            throw new UnreachableCaseError(listingResponse.type);
        }
      }
      if (listingResponse.details && listingResponse.details.returnCode >= 4) {
        logger.warnWithDetails(
          `Listing for ${element.name} was printed with warnings.`,
          `Listing for ${element.environment}/${element.stageNumber}/${
            element.system
          }/${element.subSystem}/${element.type}/${
            element.name
          } was printed with warnings:\n${formatWithNewLines(
            listingResponse.details.messages
          )}`
        );
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED,
        status: ListingContentProviderCompletedStatus.SUCCESS,
      });
      return listingResponse.result;
    },
  };
};
