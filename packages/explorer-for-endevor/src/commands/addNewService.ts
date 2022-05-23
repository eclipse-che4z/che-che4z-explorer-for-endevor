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
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  askForServiceOrCreateNew,
  dialogCancelled,
  serviceChosen,
} from '../dialogs/locations/endevorServiceDialogs';
import { getApiVersion } from '../endevor';
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
} from '../_doc/telemetry/v2/Telemetry';

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
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALL,
    context: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
  });
  const dialogResult = await askForServiceOrCreateNew({
    hiddenServices: filterForUnusedServices(allServices),
    allServices,
  })((location, rejectUnauthorized) =>
    withNotificationProgress('Testing Endevor connection')((progressReporter) =>
      getApiVersion(progressReporter)(location)(rejectUnauthorized)
    )
  );
  if (dialogCancelled(dialogResult)) {
    logger.trace('No profile was selected or newly created.');
    return;
  }
  let serviceName;
  if (serviceChosen(dialogResult)) {
    serviceName = dialogResult;
  } else {
    const createdService = dialogResult;
    serviceName = createdService.name;
    try {
      await createEndevorService(serviceName, createdService.value);
    } catch (error) {
      logger.error(
        `Unable to save the profile ${serviceName}.`,
        `Unable to save the profile ${serviceName} because of error ${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        status: CommandAddNewServiceCompletedStatus.GENERIC_ERROR,
        errorContext: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
        error,
      });
      return;
    }
  }
  try {
    await addService(serviceName);
  } catch (error) {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      status: CommandAddNewServiceCompletedStatus.GENERIC_ERROR,
      errorContext: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
      error,
    });
    return;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
    status: CommandAddNewServiceCompletedStatus.SUCCESS,
  });
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
