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
  askForElementLocationOrCreateNew,
  dialogCancelled,
  locationChosen,
} from '../dialogs/locations/endevorElementLocationDialogs';
import { logger, reporter } from '../globals';
import { addElementLocation, getLocations } from '../settings/settings';
import { getInstanceNames } from '../endevor';
import { ServiceNode } from '../_doc/ElementTree';
import { getEndevorServiceByName } from '../services/services';
import {
  createEndevorElementLocation,
  getElementLocationNames,
} from '../element-locations/elementLocations';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { Credential } from '@local/endevor/_doc/Credential';
import { Action } from '../_doc/Actions';
import { resolveCredential } from '../credentials/credentials';
import { isError } from '@local/profiles/utils';
import {
  CommandAddNewSearchLocationCompletedStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';
import { isDefined, isUnique } from '../utils';

export const addNewElementLocation =
  (
    getCredentialFromStore: (name: string) => Credential | undefined,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({ name: serviceName }: ServiceNode): Promise<void> => {
    logger.trace('Add a New Location Profile was called.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED,
    });
    const service = await getEndevorServiceByName(
      serviceName,
      resolveCredential(serviceName, getCredentialFromStore, dispatch)
    );
    if (!service) {
      logger.error(
        `Unable to fetch the existing service profile with name ${serviceName}.`
      );
      return;
    }
    const allLocations = await getElementLocationNames();
    if (isError(allLocations)) {
      const error = allLocations;
      logger.error(
        `Unable to fetch the existing element locations.`,
        `Unable to fetch the existing element locations because of error ${error.message}.`
      );
      return;
    }
    const usedLocations = getLocations();
    const alreadyAddedElementLocations = usedLocations
      .filter((location) => location.service === serviceName)
      .flatMap((location) => location.elementLocations);
    const unusedLocations = await filterForUnusedLocations(
      allLocations,
      alreadyAddedElementLocations
    );
    const dialogResult = await askForElementLocationOrCreateNew({
      unusedLocations,
      allLocations,
    })(() =>
      withNotificationProgress('Fetching instances')((progressReporter) =>
        getInstanceNames(progressReporter)(service.location)(
          service.rejectUnauthorized
        )
      )
    );
    if (dialogCancelled(dialogResult)) {
      logger.trace('No location profile was selected or newly created.');
      return;
    } else {
      let locationName: string;
      if (locationChosen(dialogResult)) {
        locationName = dialogResult;
        const inUseByServices = usedLocations
          .map((location) =>
            location.elementLocations.includes(locationName)
              ? location.service
              : undefined
          )
          .filter(isDefined)
          .filter(isUnique);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED,
          ...(inUseByServices.length
            ? {
                status:
                  CommandAddNewSearchLocationCompletedStatus.USED_EXISTING_LOCATION_CHOSEN,
                inUseByServicesAmount: inUseByServices.length,
              }
            : {
                status:
                  CommandAddNewSearchLocationCompletedStatus.UNUSED_EXISTING_LOCATION_CHOSEN,
              }),
        });
      } else {
        const createdLocation = dialogResult;
        locationName = createdLocation.name;
        try {
          await createEndevorElementLocation(
            locationName,
            createdLocation.value
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED,
            status:
              CommandAddNewSearchLocationCompletedStatus.NEW_LOCATION_CREATED,
          });
        } catch (error) {
          logger.error(
            `Unable to save the location profile ${locationName}.`,
            `Unable to save the location profile ${locationName} because of error ${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            status: CommandAddNewSearchLocationCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED,
            error,
          });
          return;
        }
      }
      return addElementLocation(locationName, serviceName);
    }
  };

const filterForUnusedLocations = async (
  allLocations: ReadonlyArray<string>,
  alreadyAddedLocations: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> => {
  return allLocations.filter(
    (location) => !alreadyAddedLocations.includes(location)
  );
};
