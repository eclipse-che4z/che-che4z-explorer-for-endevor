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
  isWorkspace as isEndevorWorkspace,
  syncWorkspaceOneWay as syncEndevorWorkspaceOneWay,
} from '../../store/scm/workspace';
import { reporter } from '../../globals';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  askForService,
  dialogCancelled as serviceDialogCancelled,
} from '../../dialogs/locations/endevorServiceDialogs';
import {
  askForSearchLocation,
  dialogCancelled as locationDialogCancelled,
} from '../../dialogs/locations/endevorSearchLocationDialogs';
import {
  EndevorId,
  ValidEndevorSearchLocationDescriptions,
  ExistingEndevorServiceDescriptions,
} from '../../store/_doc/v2/Store';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { isError } from '../../utils';
import { SyncActions, UpdateLastUsed } from '../../store/scm/_doc/Actions';
import {
  PullFromEndevorCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import {
  isWorkspaceSyncConflictResponse,
  isWorkspaceSyncErrorResponse,
} from '../../store/scm/utils';
import { showConflictResolutionRequiredMessage } from '../../dialogs/scm/conflictResolutionDialogs';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { Id } from '../../store/storage/_doc/Storage';
import {
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { createEndevorLogger } from '../../logger';

export const pullFromEndevorCommand = async (
  dispatch: (action: UpdateLastUsed) => Promise<void>,
  getConnectionConfiguration: (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) => Promise<
    | {
        service: EndevorAuthorizedService;
        searchLocation: SearchLocation;
      }
    | undefined
  >,
  getValidServiceDescriptions: () => Promise<ExistingEndevorServiceDescriptions>,
  getValidSearchLocationDescriptions: () => ValidEndevorSearchLocationDescriptions,
  getLastUsedServiceId: () => Id | undefined,
  getLastUsedSearchLocationId: () => Id | undefined
): Promise<void> => {
  const logger = createEndevorLogger();
  logger.trace('Pull from Endevor into workspace called.');
  const folderUri = await getWorkspaceUri();
  if (!folderUri) {
    const error = new Error(
      'At least one workspace in this project should be opened to pull from Endevor'
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  if (!isEndevorWorkspace(folderUri)) {
    const error = new Error(
      'An opened workspace is not the initialized Endevor workspace'
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const serviceDialogResult = await askForService(
    await getValidServiceDescriptions(),
    getLastUsedServiceId(),
    'Last Used'
  );
  if (serviceDialogCancelled(serviceDialogResult)) {
    logger.trace('No Endevor connection was selected.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const serviceId = serviceDialogResult.id;
  logger.updateContext({ serviceId });
  const locationDialogResult = await askForSearchLocation(
    getValidSearchLocationDescriptions(),
    getLastUsedSearchLocationId(),
    'Last Used'
  );
  if (locationDialogCancelled(locationDialogResult)) {
    logger.trace('No Endevor inventory location was selected.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const searchLocationId = locationDialogResult.id;
  logger.updateContext({ serviceId, searchLocationId });
  dispatch({
    type: SyncActions.UPDATE_LAST_USED,
    lastUsedServiceId: serviceId,
    lastUsedSearchLocationId: searchLocationId,
  });
  const connectionParams = await getConnectionConfiguration(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const { service, searchLocation } = connectionParams;
  const pullChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(pullChangeControlValue)) {
    logger.error('CCID and Comment must be specified to pull from Endevor.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const syncResult = await withNotificationProgress('Pulling from Endevor')(
    (progressReporter) =>
      syncEndevorWorkspaceOneWay(progressReporter)(service)(
        service.configuration
      )({
        ...searchLocation,
        subSystem: searchLocation.subsystem,
        id: searchLocation.element,
      })(pullChangeControlValue)(folderUri)
  );
  if (isError(syncResult)) {
    const error = syncResult;
    logger.errorWithDetails(
      'Unable to pull from Endevor.',
      `${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  // always dump the result messages
  syncResult.messages.forEach((message) => logger.trace(message));
  if (isWorkspaceSyncErrorResponse(syncResult)) {
    const syncError = syncResult;
    logger.errorWithDetails(
      `Unable to pull from Endevor these elements: ${syncError.errorDetails
        .map((errorInfo) => errorInfo.element.name)
        .join(', ')}`
    );
    syncError.errorDetails
      .map(
        (errorInfo) =>
          `Unable to perform ${errorInfo.operation} operation on the element ${
            errorInfo.element.environment
          }/${errorInfo.element.stageNumber}/${errorInfo.element.system}/${
            errorInfo.element.subSystem
          }/${errorInfo.element.type}/${
            errorInfo.element.name
          } because of an error:\n${errorInfo.errorMessages.join('\n')}`
      )
      .forEach((errorMessage) => {
        logger.trace(errorMessage);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
          status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
          error: new Error(errorMessage),
        });
      });
    return;
  }
  if (isWorkspaceSyncConflictResponse(syncResult)) {
    const syncConflict = syncResult;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.CONFLICT,
    });
    showConflictResolutionRequiredMessage(
      syncConflict.conflictDetails.map(
        (conflictInfo) => conflictInfo.element.name
      )
    );
    return;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
    status: PullFromEndevorCommandCompletedStatus.SUCCESS,
  });
};
