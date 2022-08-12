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
  askForSearchLocationOrCreateNew,
  dialogCancelled,
  locationChosen,
} from '../dialogs/locations/endevorSearchLocationDialogs';
import { logger, reporter } from '../globals';
import { getConfigurations } from '../endevor';
import { ServiceNode } from '../tree/_doc/ServiceLocationTree';
import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import { Action, Actions } from '../store/_doc/Actions';
import {
  EndevorId,
  EndevorLocationName,
  EndevorService,
  EndevorServiceDescriptions,
  ValidEndevorSearchLocationDescriptions,
} from '../store/_doc/v2/Store';
import {
  CommandAddNewSearchLocationCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';

export const addNewSearchLocation =
  (
    configurations: {
      getServiceById: (serviceId: EndevorId) => EndevorService | undefined;
      getServiceDescriptionsBySearchLocationId: (
        searchLocationId: EndevorId
      ) => EndevorServiceDescriptions;
      getSearchLocationNames: () => ReadonlyArray<EndevorLocationName>;
      getValidUnusedSearchLocationDescriptionsForService: (
        serviceId: EndevorId
      ) => ValidEndevorSearchLocationDescriptions;
    },
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({ name, source }: ServiceNode): Promise<void> => {
    const serviceId: EndevorId = {
      name,
      source,
    };
    logger.trace(
      `Add an Endevor inventory location for the ${serviceId.source} Endevor connection ${serviceId.name} was called.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED,
    });
    const dialogResult = await askForSearchLocationOrCreateNew({
      locationsToChoose:
        configurations.getValidUnusedSearchLocationDescriptionsForService(
          serviceId
        ),
      allExistingLocationNames: configurations.getSearchLocationNames(),
    })(async () => {
      const service = configurations.getServiceById(serviceId);
      if (!service) {
        return new Error(
          `Unable to fetch the existing ${serviceId.source} Endevor connection with the name ${serviceId.name}`
        );
      }
      return withCancellableNotificationProgress(
        'Fetching Endevor configurations ...'
      )((progressReporter) =>
        getConfigurations(progressReporter)(service.value.location)(
          service.value.rejectUnauthorized
        )
      );
    });
    if (dialogCancelled(dialogResult)) {
      logger.trace(
        'No Endevor inventory location was selected or newly created.'
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED,
        status: CommandAddNewSearchLocationCompletedStatus.CANCELLED,
      });
      return;
    }
    if (!locationChosen(dialogResult)) {
      const createdSearchLocation = dialogResult;
      dispatch({
        type: Actions.ENDEVOR_SEARCH_LOCATION_CREATED,
        serviceId,
        searchLocation: {
          value: createdSearchLocation.value,
          id: createdSearchLocation.id,
        },
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED,
        status:
          CommandAddNewSearchLocationCompletedStatus.NEW_SEARCH_LOCATION_CREATED,
        source: createdSearchLocation.id.source,
        serviceSource: serviceId.source,
      });
      return;
    }
    const searchLocationId = dialogResult.id;
    const inUseByServicesAmount = Object.keys(
      configurations.getServiceDescriptionsBySearchLocationId(searchLocationId)
    ).length;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED,
      ...(inUseByServicesAmount
        ? {
            status:
              CommandAddNewSearchLocationCompletedStatus.USED_EXISTING_SEARCH_LOCATION_CHOSEN,
            inUseByServicesAmount,
            source: searchLocationId.source,
            serviceSource: serviceId.source,
          }
        : {
            status:
              CommandAddNewSearchLocationCompletedStatus.UNUSED_EXISTING_LOCATION_CHOSEN,
            source: searchLocationId.source,
            serviceSource: serviceId.source,
          }),
    });
    dispatch({
      type: Actions.ENDEVOR_SEARCH_LOCATION_ADDED,
      serviceId,
      searchLocationId,
    });
    return;
  };
