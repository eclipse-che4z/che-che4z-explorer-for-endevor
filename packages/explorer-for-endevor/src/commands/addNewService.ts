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

import { isError } from '@local/profiles/utils';
import {
  askForServiceOrCreateNew,
  dialogCancelled,
  serviceChosen,
} from '../dialogs/locations/endevorServiceDialogs';
import { logger, reporter } from '../globals';
import {
  createEndevorService,
  getEndevorServiceNames,
} from '../services/services';
import {
  addService,
  getLocations as getUsedEndevorServices,
} from '../settings/settings';
import {
  CommandAddNewServiceCompletedStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';

export const addNewService = async (): Promise<void> => {
  logger.trace('Add a New Profile called.');
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
  });
  const allServices = await getEndevorServiceNames();
  if (isError(allServices)) {
    const error = allServices;
    logger.error(
      `Unable to fetch the existing services.`,
      `Unable to fetch the existing services because of error ${error.message}.`
    );
    return;
  }
  const dialogResult = await askForServiceOrCreateNew({
    hiddenServices: filterForUnusedServices(allServices),
    allServices,
  });
  if (dialogCancelled(dialogResult)) {
    logger.trace('No profile was selected or newly created.');
    return;
  } else {
    let serviceName;
    if (serviceChosen(dialogResult)) {
      serviceName = dialogResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
        status: CommandAddNewServiceCompletedStatus.EXISTING_SERVICE_CHOSEN,
      });
    } else {
      const createdService = dialogResult;
      serviceName = createdService.name;
      try {
        await createEndevorService(serviceName, createdService.value);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
          status: CommandAddNewServiceCompletedStatus.NEW_SERVICE_CREATED,
        });
      } catch (err) {
        logger.error(
          `Unable to save the profile ${serviceName}.`,
          `Unable to save the profile ${serviceName} because of error ${err.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          status: CommandAddNewServiceCompletedStatus.GENERIC_ERROR,
          errorContext: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
          error: err,
        });
        return;
      }
    }
    return addService(serviceName);
  }
};

const filterForUnusedServices = (
  allServices: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const usedServices = getUsedEndevorServices().map(
    (usedService) => usedService.service
  );
  return allServices.filter(
    (service) => !usedServices.find((usedService) => usedService === service)
  );
};
