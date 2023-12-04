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

import { reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import { InvalidLocationNode } from '../../tree/_doc/ServiceLocationTree';
import { askForCredentialWithDefaultPasswordPolicy } from '../../dialogs/credentials/endevorCredentialDialogs';
import {
  EndevorConfiguration,
  EndevorCredentialDescription,
  EndevorCredentialStatus,
  EndevorId,
  ValidEndevorConnection,
} from '../../store/_doc/v2/Store';
import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import { validateCredentials } from '../../api/endevor';
import { isError } from '../../utils';
import { ENDEVOR_CREDENTIAL_VALIDATION_LIMIT } from '../../constants';
import {
  EditCredentialsCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Source } from '../../store/storage/_doc/Storage';
import { CredentialType } from '@local/endevor/_doc/Credential';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';

export const editCredentialsCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    getEndevorConfiguration: (
      serviceId?: EndevorId,
      searchLocationId?: EndevorId
    ) => Promise<EndevorConfiguration | undefined>,
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<ValidEndevorConnection | undefined>,
    getCredentials: (
      id: EndevorId
    ) => Promise<EndevorCredentialDescription | undefined>
  ) =>
  async (invalidLocationNode: InvalidLocationNode): Promise<void> => {
    const serviceId = {
      name: invalidLocationNode.serviceName,
      source: invalidLocationNode.serviceSource,
    };
    const searchLocationId = {
      name: invalidLocationNode.name,
      source: invalidLocationNode.source,
    };
    const logger = createEndevorLogger({ serviceId, searchLocationId });
    logger.traceWithDetails('Modify Endevor credentials command was called');
    const connectionDetails = await getConnectionDetails(serviceId);
    if (!connectionDetails) return;
    const configuration = await getEndevorConfiguration(
      serviceId,
      searchLocationId
    );
    if (!configuration) return;
    const existingCredential = await getCredentials(serviceId);
    const isCredentialPersistent = existingCredential?.isPersistent;
    const credential = await askForCredentialWithDefaultPasswordPolicy({
      validateCredential: async (credential) => {
        const result = await withCancellableNotificationProgress(
          'Testing Endevor credentials ...'
        )((progress) => {
          return validateCredentials(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
            })
          )(progress)({
            ...connectionDetails.value,
            configuration,
            credential,
          });
        });
        if (!result) return;
        if (isError(result)) {
          const error = result;
          logger.trace(`${error.message}.`);
          return;
        }
        return {
          status: EndevorCredentialStatus.VALID,
          value: credential,
        };
      },
      validationAttempts: ENDEVOR_CREDENTIAL_VALIDATION_LIMIT,
    })(
      existingCredential &&
        existingCredential.value.type === CredentialType.BASE
        ? {
            user: existingCredential.value.user,
          }
        : undefined,
      invalidLocationNode.source === Source.INTERNAL && isCredentialPersistent
        ? 'Updated Endevor credentials will be stored within the connection.'
        : 'Updated Endevor credentials will be stored within the current VSCode session.'
    );
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
        errorContext: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED,
        status: EditCredentialsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED,
      status: EditCredentialsCommandCompletedStatus.SUCCESS,
    });
    switch (invalidLocationNode.serviceSource) {
      case Source.INTERNAL:
        if (isCredentialPersistent) {
          dispatch({
            type: Actions.ENDEVOR_SERVICE_UPDATED,
            serviceId,
            connection: connectionDetails,
            credential,
          });
        } else {
          dispatch({
            type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
            sessionId: serviceId,
            credential,
          });
        }
        break;
      case Source.SYNCHRONIZED:
        dispatch({
          type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
          sessionId: serviceId,
          credential,
        });
        break;
      default:
        throw new UnreachableCaseError(invalidLocationNode.serviceSource);
    }
  };
