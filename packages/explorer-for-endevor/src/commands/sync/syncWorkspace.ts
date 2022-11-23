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
  isWorkspace as isEndevorWorkspace,
  syncWorkspace as syncEndevorWorkspace,
} from '../../store/scm/workspace';
import { logger, reporter } from '../../globals';
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
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  EndevorConfiguration,
  EndevorId,
  ValidEndevorConnection,
  ValidEndevorCredential,
  ValidEndevorSearchLocationDescriptions,
  ExistingEndevorServiceDescriptions,
} from '../../store/_doc/v2/Store';
import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { isError } from '../../utils';
import { SyncActions, WorkspaceSynced } from '../../store/scm/_doc/Actions';
import {
  SyncWorkspaceCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import {
  isWorkspaceSyncConflictResponse,
  isWorkspaceSyncErrorResponse,
} from '../../store/scm/utils';
import { showConflictResolutionRequiredMessage } from '../../dialogs/scm/conflictResolutionDialogs';

export const syncWorkspace = async (
  configurations: {
    getValidServiceDescriptions: () => ExistingEndevorServiceDescriptions;
    getValidSearchLocationDescriptions: () => ValidEndevorSearchLocationDescriptions;
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<ValidEndevorConnection | undefined>;
    getEndevorConfiguration: (
      serviceId?: EndevorId,
      searchLocationId?: EndevorId
    ) => Promise<EndevorConfiguration | undefined>;
    getCredential: (
      connection: ValidEndevorConnection,
      configuration: EndevorConfiguration
    ) => (
      credentialId: EndevorId
    ) => Promise<ValidEndevorCredential | undefined>;
    getSearchLocation: (
      searchLocationId: EndevorId
    ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>;
  },
  dispatch: (action: WorkspaceSynced) => Promise<void>
): Promise<void> => {
  logger.trace('Synchronization of an Endevor workspace called.');
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
  });
  const folderUri = await getWorkspaceUri();
  if (!folderUri) {
    const error = new Error(
      'At least one workspace in this project should be opened to synchronize with Endevor'
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
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
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const serviceDialogResult = await askForService(
    configurations.getValidServiceDescriptions()
  );
  if (serviceDialogCancelled(serviceDialogResult)) {
    logger.trace('No Endevor connection was selected.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED,
      status: SyncWorkspaceCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const serviceId = serviceDialogResult.id;
  const connectionDetails = await configurations.getConnectionDetails(
    serviceId
  );
  if (!connectionDetails) {
    const error = new Error(
      `Unable to fetch the existing ${serviceId.source} Endevor connection with the name ${serviceId.name}`
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const locationDialogResult = await askForSearchLocation(
    configurations.getValidSearchLocationDescriptions()
  );
  if (locationDialogCancelled(locationDialogResult)) {
    logger.trace('No Endevor inventory location was selected.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED,
      status: SyncWorkspaceCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const searchLocationId = locationDialogResult.id;
  const configuration = await configurations.getEndevorConfiguration(
    serviceId,
    searchLocationId
  );
  if (!configuration) {
    const error = new Error(
      `Unable to fetch the existing ${searchLocationId.source} inventory location with the name ${searchLocationId.name}`
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const credential = await configurations.getCredential(
    connectionDetails,
    configuration
  )(serviceId);
  if (!credential) {
    const error = new Error(
      `Unable to fetch the existing ${serviceId.source} Endevor credential with the name ${serviceId.name}`
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const searchLocation = await configurations.getSearchLocation(
    searchLocationId
  );
  if (!searchLocation) {
    const error = new Error(
      `Unable to fetch the existing ${searchLocationId.source} inventory location with the name ${searchLocationId.name}`
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const syncChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(syncChangeControlValue)) {
    logger.error('CCID and Comment must be specified to sync with Endevor.');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED,
      status: SyncWorkspaceCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const syncResult = await withNotificationProgress(
    'Synchronizing Endevor workspace'
  )((progressReporter) =>
    syncEndevorWorkspace(progressReporter)({
      ...connectionDetails.value,
      credential: credential.value,
    })({
      ...searchLocation,
      configuration,
    })(syncChangeControlValue)(folderUri)
  );
  if (isError(syncResult)) {
    const error = syncResult;
    logger.error(
      'Unable to synchronize Endevor workspace.',
      `${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  // always dump the result messages
  // TODO: consider not to use the result messages since they include internal CLI info sometimes
  logger.trace(syncResult.messages.join('\n'));
  if (isWorkspaceSyncErrorResponse(syncResult)) {
    const syncError = syncResult;
    logger.error(
      `Unable to synchronize Endevor workspace for these elements: ${syncError.errorDetails
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
          errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED,
          status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR,
          error: new Error(errorMessage),
        });
      });
    return;
  }
  if (isWorkspaceSyncConflictResponse(syncResult)) {
    const syncConflict = syncResult;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED,
      status: SyncWorkspaceCommandCompletedStatus.CONFLICT,
    });
    showConflictResolutionRequiredMessage(
      syncConflict.conflictDetails.map(
        (conflictInfo) => conflictInfo.element.name
      )
    );
    return;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED,
    status: SyncWorkspaceCommandCompletedStatus.SUCCESS,
  });
  dispatch({
    type: SyncActions.WORKSPACE_SYNCED,
  });
};
