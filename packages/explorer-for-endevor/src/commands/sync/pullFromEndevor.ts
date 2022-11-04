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
  syncWorkspaceOneWay as syncEndevorWorkspaceOneWay,
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
import {
  SyncActions,
  WorkspaceSyncedOneWay,
} from '../../store/scm/_doc/Actions';
import {
  PullFromEndevorCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';

export const pullFromEndevorCommand = async (
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
    getElementLocation: (
      searchLocationId: EndevorId
    ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>;
  },
  dispatch: (action: WorkspaceSyncedOneWay) => Promise<void>
): Promise<void> => {
  logger.trace('Pull from Endevor into workspace called.');
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_CALLED,
  });
  const folderUri = await getWorkspaceUri();
  if (!folderUri) {
    const error = new Error(
      'At least one workspace in this project should be opened to pull from Endevor'
    );
    logger.error(`${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_CALLED,
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
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_CALLED,
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
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
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
      status: PullFromEndevorCommandCompletedStatus.CANCELLED,
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
    return;
  }
  const locationDialogResult = await askForSearchLocation(
    configurations.getValidSearchLocationDescriptions()
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
  const configuration = await configurations.getEndevorConfiguration(
    serviceId,
    searchLocationId
  );
  if (!configuration) {
    const error = new Error(
      `Unable to fetch the existing ${searchLocationId.source} inventory location with the name ${searchLocationId.name}`
    );
    logger.error(`${error.message}.`);
    return;
  }
  const credential = await configurations.getCredential(
    connectionDetails,
    configuration
  )(serviceId);
  if (!credential) {
    const error = new Error(
      `Unable to fetch the existing ${serviceId.source} Endevor connection with the name ${serviceId.name}`
    );
    logger.error(`${error.message}.`);
    return;
  }
  const searchLocation = await configurations.getElementLocation(
    searchLocationId
  );
  if (!searchLocation) {
    const error = new Error(
      `Unable to fetch the existing ${searchLocationId.source} inventory location with the name ${searchLocationId.name}`
    );
    logger.error(`${error.message}.`);
    return;
  }

  // TODO: Remove these hardcoded values when ccid and comment are no longer required in this call.
  const syncResult = withNotificationProgress('Pulling from Endevor')(
    (progressReporter) =>
      syncEndevorWorkspaceOneWay(progressReporter)({
        ...connectionDetails.value,
        credential: credential.value,
      })({
        ...searchLocation,
        configuration,
      })(folderUri)
  );
  if (isError(syncResult)) {
    const error = syncResult;
    logger.error('Unable to pull from Endevor.', `${error.message}.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_CALLED,
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED,
    status: PullFromEndevorCommandCompletedStatus.SUCCESS,
  });
  dispatch({
    type: SyncActions.WORKSPACE_SYNCED_ONEWAY,
  });
};
