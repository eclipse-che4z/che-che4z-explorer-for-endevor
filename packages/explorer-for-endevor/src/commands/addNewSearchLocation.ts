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
  dialogCancelled as locationDialogCancelled,
  locationChosen,
} from '../dialogs/locations/endevorSearchLocationDialogs';
import { logger, reporter } from '../globals';
import { isDefined } from '../utils';
import { Action, Actions } from '../store/_doc/Actions';
import {
  EndevorId,
  EndevorLocationName,
  EndevorServiceDescriptions,
  ValidEndevorConnection,
  ValidEndevorSearchLocationDescriptions,
  ExistingEndevorServiceDescriptions,
  EndevorConnectionStatus,
} from '../store/_doc/v2/Store';
import {
  CommandAddNewSearchLocationCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import {
  askForService,
  dialogCancelled as serviceDialogCancelled,
} from '../dialogs/locations/endevorServiceDialogs';
import { ValidServiceNode } from '../tree/_doc/ServiceLocationTree';
import {
  focusOnView,
  withCancellableNotificationProgress,
} from '@local/vscode-wrapper/window';
import { getConfigurations } from '../endevor';
import { TREE_VIEW_ID } from '../constants';
import { isConnectionError } from '@local/endevor/utils';

export const addNewSearchLocation =
  (
    configurations: {
      getConnectionDetails: (
        id: EndevorId
      ) => Promise<ValidEndevorConnection | undefined>;
      getServiceDescriptionsBySearchLocationId: (
        searchLocationId: EndevorId
      ) => EndevorServiceDescriptions;
      getSearchLocationNames: () => ReadonlyArray<EndevorLocationName>;
      getValidSearchLocationDescriptionsForService: (
        serviceId: EndevorId
      ) => ValidEndevorSearchLocationDescriptions;
      getValidUsedServiceDescriptions: () => ExistingEndevorServiceDescriptions;
    },
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (
    serviceArg?: EndevorId | ValidServiceNode
  ): Promise<EndevorId | undefined> => {
    const serviceId = await resolveServiceId(
      configurations.getValidUsedServiceDescriptions()
    )(serviceArg);
    if (!serviceId) return;
    logger.trace(
      `Add an Endevor inventory location for the ${serviceId.source} Endevor connection ${serviceId.name} was called.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED,
    });
    const dialogResult = await askForSearchLocationOrCreateNew({
      locationsToChoose:
        configurations.getValidSearchLocationDescriptionsForService(serviceId),
      allExistingLocationNames: configurations.getSearchLocationNames(),
    })(async () => {
      const connectionDetails = await configurations.getConnectionDetails(
        serviceId
      );
      if (!connectionDetails) {
        const error = new Error(
          `Unable to fetch the existing ${serviceId.source} Endevor connection with the name ${serviceId.name}`
        );
        logger.error(`${error.message}.`);
        return;
      }
      return withCancellableNotificationProgress(
        'Fetching Endevor configurations ...'
      )((progressReporter) =>
        getConfigurations(progressReporter)(connectionDetails.value.location)(
          connectionDetails.value.rejectUnauthorized
        )
      );
    });
    if (isConnectionError(dialogResult)) {
      const error = dialogResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED,
        status: CommandAddNewSearchLocationCompletedStatus.GENERIC_ERROR,
        error,
      });
      await dispatch({
        type: Actions.ENDEVOR_CONNECTION_TESTED,
        connectionId: serviceId,
        status: {
          status: EndevorConnectionStatus.INVALID,
        },
      });
      logger.error(
        `Unable to fetch the list of Endevor configurations for ${serviceId.name} because of invalid connection details`,
        error.message
      );
      return;
    }
    if (locationDialogCancelled(dialogResult)) {
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
      await focusOnView(TREE_VIEW_ID);
      return createdSearchLocation.id;
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
    await focusOnView(TREE_VIEW_ID);
    return searchLocationId;
  };

const resolveServiceId =
  (servicesToChoose: ExistingEndevorServiceDescriptions) =>
  async (
    serviceArg?: EndevorId | ValidServiceNode
  ): Promise<EndevorId | undefined> => {
    if (!isDefined(serviceArg)) {
      const serviceKeys = Object.keys(servicesToChoose);
      if (serviceKeys.length === 1 && serviceKeys[0]) {
        return servicesToChoose[serviceKeys[0]]?.id;
      }
      const dialogResult = await askForService(servicesToChoose);
      if (serviceDialogCancelled(dialogResult)) {
        logger.trace('No Endevor connection was selected.');
        return;
      }
      return dialogResult.id;
    }
    return {
      name: serviceArg.name,
      source: serviceArg.source,
    };
  };
