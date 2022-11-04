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

import { logger, reporter } from '../globals';
import { Action, Actions } from '../store/_doc/Actions';
import { InvalidLocationNode } from '../tree/_doc/ServiceLocationTree';
import { askForCredentialWithDefaultPasswordPolicy } from '../dialogs/credentials/endevorCredentialDialogs';
import {
  EndevorConfiguration,
  EndevorCredentialStatus,
  EndevorId,
  ValidEndevorConnection,
} from '../store/_doc/v2/Store';
import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import { validateCredentials } from '../endevor';
import { isError } from '../utils';
import { ENDEVOR_CREDENTIAL_VALIDATION_LIMIT } from '../constants';
import {
  EditCredentialsCommandCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';

export const editCredentials =
  (
    getEndevorConfiguration: (
      serviceId?: EndevorId,
      searchLocationId?: EndevorId
    ) => Promise<EndevorConfiguration | undefined>,
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<ValidEndevorConnection | undefined>,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (invalidLocationNode: InvalidLocationNode): Promise<void> => {
    logger.trace('Modify Endevor credentials command called');
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_CALLED,
    });
    const serviceId = {
      name: invalidLocationNode.serviceName,
      source: invalidLocationNode.serviceSource,
    };
    const searchLocationId = {
      name: invalidLocationNode.name,
      source: invalidLocationNode.source,
    };
    const connectionDetails = await getConnectionDetails(serviceId);
    if (!connectionDetails) return;
    const configuration = await getEndevorConfiguration(
      serviceId,
      searchLocationId
    );
    if (!configuration) return;
    const credential = await askForCredentialWithDefaultPasswordPolicy({
      validateCredential: async (credential) => {
        const result = await withCancellableNotificationProgress(
          'Testing Endevor credentials ...'
        )((progress) => {
          return validateCredentials(progress)(connectionDetails.value)(
            configuration
          )(credential);
        });
        if (isError(result) || !result) {
          return false;
        }
        return true;
      },
      validationAttempts: ENDEVOR_CREDENTIAL_VALIDATION_LIMIT,
    })();
    if (!credential) {
      logger.trace('No new credentials provided.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED,
        status: EditCredentialsCommandCompletedStatus.CANCELLED,
      });
      return;
    }
    if (credential.status !== EndevorCredentialStatus.VALID) {
      logger.trace('Invalid credentials provided.');
      const error = new Error('Invalid credentials provided.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_CALLED,
        status: EditCredentialsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED,
      status: EditCredentialsCommandCompletedStatus.SUCCESS,
    });
    logger.info(
      'Updated Endevor credentials will be stored within the current VSCode session.'
    );
    dispatch({
      type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
      sessionId: serviceId,
      credential,
    });
  };
