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

import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import {
  askForServiceOrCreateNew,
  dialogCancelled,
  serviceChosen,
} from '../dialogs/locations/endevorServiceDialogs';
import { getApiVersion } from '../endevor';
import { logger, reporter } from '../globals';
import {
  CommandAddNewServiceCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import { Action, Actions } from '../store/_doc/Actions';
import {
  EndevorServiceName,
  ValidEndevorServiceDescriptions,
} from '../store/_doc/v2/Store';

export const addNewService = async (
  configurations: {
    getAllServiceNames: () => ReadonlyArray<EndevorServiceName>;
    getValidUnusedServiceDescriptions: () => ValidEndevorServiceDescriptions;
  },
  dispatch: (action: Action) => Promise<void>
): Promise<void> => {
  logger.trace('Add an Endevor connection called.');
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
  });
  const dialogResult = await askForServiceOrCreateNew({
    servicesToChoose: configurations.getValidUnusedServiceDescriptions(),
    allExistingServices: configurations.getAllServiceNames(),
  })((location, rejectUnauthorized) =>
    withCancellableNotificationProgress('Testing Endevor connection ...')(
      (progressReporter) =>
        getApiVersion(progressReporter)(location)(rejectUnauthorized)
    )
  );
  if (dialogCancelled(dialogResult)) {
    logger.trace('No Endevor connection was selected or newly created.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
      status: CommandAddNewServiceCompletedStatus.CANCELLED,
    });
    return;
  }
  if (serviceChosen(dialogResult)) {
    const serviceId = dialogResult.id;
    dispatch({
      type: Actions.ENDEVOR_SERVICE_ADDED,
      serviceId,
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
      status: CommandAddNewServiceCompletedStatus.EXISTING_SERVICE_ADDED,
      source: serviceId.source,
    });
    return;
  }
  const createdService = dialogResult;
  dispatch({
    type: Actions.ENDEVOR_SERVICE_CREATED,
    service: {
      value: {
        location: createdService.value.location,
        rejectUnauthorized: createdService.value.rejectUnauthorized,
      },
      apiVersion: createdService.value.apiVersion,
      credential: createdService.value.credential
        ? {
            value: createdService.value.credential,
            id: createdService.id,
          }
        : undefined,
      id: createdService.id,
    },
  });
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
    status: CommandAddNewServiceCompletedStatus.NEW_SERVICE_CREATED,
    source: createdService.id.source,
  });
  return;
};
