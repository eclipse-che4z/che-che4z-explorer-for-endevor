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

import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import { askForServiceValue } from '../../dialogs/locations/endevorServiceDialogs';
import { getApiVersion } from '../../endevor';
import { logger, reporter } from '../../globals';
import {
  CommandEditServiceCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { ServiceNode } from '../../tree/_doc/ServiceLocationTree';
import { toServiceUrl } from '../../utils';
import { CredentialType } from '@local/endevor/_doc/Credential';

export const editServiceCommand =
  (
    configurations: {
      getServiceDetails: (id: EndevorId) => EndevorConnection | undefined;
      getServiceCredentials: (id: EndevorId) => EndevorCredential | undefined;
    },
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({ name, source }: ServiceNode): Promise<void> => {
    logger.trace(`Edit an Endevor connection called for ${name}.`);
    const serviceId: EndevorId = {
      name,
      source,
    };
    const connectionDetails = configurations.getServiceDetails(serviceId);
    const credentials = configurations.getServiceCredentials(serviceId);
    const editedConnection = await askForServiceValue(
      (location, rejectUnauthorized) =>
        withCancellableNotificationProgress('Testing Endevor connection ...')(
          (progressReporter) =>
            getApiVersion(progressReporter)(location)(rejectUnauthorized)
        ),
      connectionDetails
        ? toServiceUrl(connectionDetails.value.location)
        : undefined,
      credentials
        ? {
            user:
              credentials.value.type === CredentialType.BASE
                ? credentials.value.user
                : undefined,
          }
        : undefined
    );
    if (!editedConnection) {
      logger.trace(
        'Editing an Endevor connection is cancelled, no new values provided.'
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED,
        status: CommandEditServiceCompletedStatus.CANCELLED,
      });
      return;
    }
    if (editedConnection.connection.status !== EndevorConnectionStatus.VALID) {
      dispatch({
        type: Actions.ENDEVOR_SERVICE_UPDATED,
        serviceId,
        connection: {
          status: EndevorConnectionStatus.INVALID,
          value: editedConnection.connection.value,
        },
        credential: editedConnection.credential
          ? {
              status: EndevorCredentialStatus.UNKNOWN,
              value: editedConnection.credential,
            }
          : undefined,
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED,
        status: CommandEditServiceCompletedStatus.VALIDATION_UNSUCCESSFUL,
      });
    } else {
      dispatch({
        type: Actions.ENDEVOR_SERVICE_UPDATED,
        serviceId,
        connection: {
          status: EndevorConnectionStatus.VALID,
          value: editedConnection.connection.value,
        },
        credential: editedConnection.credential
          ? {
              status: EndevorCredentialStatus.UNKNOWN,
              value: editedConnection.credential,
            }
          : undefined,
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED,
        status: CommandEditServiceCompletedStatus.SUCCESS,
      });
    }
    logger.info(`Endevor connection ${name} is updated.`);
  };
