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
  focusOnView,
  withCancellableNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  askForServiceOrCreateNew,
  dialogCancelled,
  serviceChosen,
} from '../../dialogs/locations/endevorServiceDialogs';
import { getApiVersion } from '../../endevor';
import { logger, reporter } from '../../globals';
import {
  CommandAddNewServiceCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  EndevorConnectionStatus,
  EndevorId,
  EndevorServiceName,
  ExistingEndevorServiceDescriptions,
} from '../../store/_doc/v2/Store';
import { TREE_VIEW_ID } from '../../constants';

export const addNewServiceCommand = async (
  configurations: {
    getAllServiceNames: () => ReadonlyArray<EndevorServiceName>;
    getValidServiceDescriptions: () => ExistingEndevorServiceDescriptions;
  },
  dispatch: (action: Action) => Promise<void>
): Promise<EndevorId | undefined> => {
  logger.trace('Add an Endevor connection called.');
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED,
  });
  const dialogResult = await askForServiceOrCreateNew({
    servicesToChoose: configurations.getValidServiceDescriptions(),
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
    await focusOnView(TREE_VIEW_ID);
    return serviceId;
  }
  const createdService = dialogResult;
  if (
    createdService.value.connection.status === EndevorConnectionStatus.VALID
  ) {
    dispatch({
      type: Actions.ENDEVOR_SERVICE_CREATED,
      service: {
        id: createdService.id,
        value: createdService.value.connection.value,
        credential: createdService.value.credential
          ? {
              value: createdService.value.credential,
              id: createdService.id,
            }
          : undefined,
      },
      connectionStatus: {
        status: createdService.value.connection.status,
        apiVersion: createdService.value.connection.value.apiVersion,
      },
    });
  } else {
    dispatch({
      type: Actions.ENDEVOR_SERVICE_CREATED,
      service: {
        id: createdService.id,
        value: createdService.value.connection.value,
        credential: createdService.value.credential
          ? {
              value: createdService.value.credential,
              id: createdService.id,
            }
          : undefined,
      },
      connectionStatus: {
        status: createdService.value.connection.status,
      },
    });
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED,
    status: CommandAddNewServiceCompletedStatus.NEW_SERVICE_CREATED,
    source: createdService.id.source,
  });
  await focusOnView(TREE_VIEW_ID);
  return createdService.id;
};
