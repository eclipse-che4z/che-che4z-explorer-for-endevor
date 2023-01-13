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
  askForCredentialWithDefaultPasswordPolicy,
  askForCredentialWithoutValidation,
} from '../dialogs/credentials/endevorCredentialDialogs';
import { logger, reporter } from '../globals';
import { TelemetryEvents as V1TelemetryEvents } from '../_doc/Telemetry';
import {
  getCredential as getCredentialFromStore,
  getSearchLocation as getSearchLocationFromStore,
  getEndevorConnectionDetails as getEndevorConnectionDetailsFromStore,
  getEndevorConfiguration as getEndevorConfigurationFromStore,
} from './store';
import {
  EndevorConfiguration,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
  State,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from './_doc/v2/Store';
import { Action, Actions } from './_doc/Actions';
import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
import {
  withCancellableNotificationProgress,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { getApiVersion, validateCredentials } from '../endevor';
import { isError } from '../utils';
import { isSelfSignedCertificateError } from '@local/endevor/utils';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents as V2TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ENDEVOR_CREDENTIAL_VALIDATION_LIMIT } from '../constants';

export type GetValidCredentials = (
  credentialId: EndevorId
) => Promise<ValidEndevorCredential | undefined>;
export const resolveValidCredentials =
  (credentialsGetter: ReadonlyArray<GetValidCredentials>) =>
  async (
    credentialId: EndevorId
  ): Promise<ValidEndevorCredential | undefined> => {
    for (const getCredentials of credentialsGetter) {
      const credentials = await getCredentials(credentialId);
      if (credentials) return credentials;
    }
    return undefined;
  };
export const defineValidCredentialsResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>,
  connection: ValidEndevorConnection,
  configuration: EndevorConfiguration
): ReadonlyArray<GetValidCredentials> => {
  return [
    async (credentialId) => {
      const credential = getCredentialFromStore(getState)(credentialId);
      if (!credential) return;
      switch (credential.status) {
        case EndevorCredentialStatus.VALID:
          return credential;
        case EndevorCredentialStatus.INVALID:
          return;
        case EndevorCredentialStatus.UNKNOWN: {
          const result = await withNotificationProgress(
            'Validating credentials'
          )((progress) => {
            return validateCredentials(progress)(connection.value)(
              configuration
            )(credential.value);
          });
          if (isError(result) || !result) {
            dispatch({
              type: Actions.ENDEVOR_CREDENTIAL_TESTED,
              status: EndevorCredentialStatus.INVALID,
              credentialId,
            });
            return;
          }
          dispatch({
            type: Actions.ENDEVOR_CREDENTIAL_TESTED,
            status: EndevorCredentialStatus.VALID,
            credentialId,
          });
          return {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          };
        }
        default:
          throw new UnreachableCaseError(credential);
      }
    },
    async (credentialId) => {
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      const credential = await askForCredentialWithDefaultPasswordPolicy({
        validateCredential: async (credential) => {
          const result = await withNotificationProgress(
            'Validating credentials'
          )((progress) => {
            return validateCredentials(progress)(connection.value)(
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
      if (!credential) return;
      if (credential.status === EndevorCredentialStatus.UNKNOWN) return;
      if (credential.status === EndevorCredentialStatus.INVALID) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
          sessionId: credentialId,
          credential,
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
      });
      dispatch({
        type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
        sessionId: credentialId,
        credential,
      });
      return credential;
    },
  ];
};

export type GetAnyCredentials = (
  credentialId: EndevorId
) => Promise<EndevorCredential | undefined>;
export const resolveAnyCredentials =
  (credentialsGetter: ReadonlyArray<GetAnyCredentials>) =>
  async (credentialId: EndevorId): Promise<EndevorCredential | undefined> => {
    for (const getCredentials of credentialsGetter) {
      const credentials = await getCredentials(credentialId);
      if (credentials) return credentials;
    }
    return undefined;
  };
export const defineAnyCredentialsResolutionOrder = (
  getState: () => State
): ReadonlyArray<GetAnyCredentials> => {
  return [
    async (credentialId) => getCredentialFromStore(getState)(credentialId),
    async () => {
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      const credential = await askForCredentialWithoutValidation();
      if (!credential) return;
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
      });
      return credential;
    },
  ];
};

type GetValidConnectionDetails = (
  serviceId: EndevorId
) => Promise<ValidEndevorConnection | undefined>;
export const resolveValidConnectionDetails =
  (connectionDetailsGetter: ReadonlyArray<GetValidConnectionDetails>) =>
  async (serviceId: EndevorId): Promise<ValidEndevorConnection | undefined> => {
    for (const connectionDetails of connectionDetailsGetter) {
      const apiVersion = await connectionDetails(serviceId);
      if (apiVersion) return apiVersion;
    }
    return;
  };
export const defineValidConnectionDetailsResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetValidConnectionDetails> => {
  return [
    async (serviceId) => {
      const connectionDetails =
        getEndevorConnectionDetailsFromStore(getState)(serviceId);
      if (!connectionDetails) return;
      if (connectionDetails.status === EndevorConnectionStatus.INVALID) return;
      if (connectionDetails.status === EndevorConnectionStatus.VALID) {
        return connectionDetails;
      }
      const apiVersion = await withCancellableNotificationProgress(
        'Fetching Endevor API version'
      )((progress) =>
        getApiVersion(progress)(connectionDetails.value.location)(
          connectionDetails.value.rejectUnauthorized
        )
      );
      if (!apiVersion) {
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.SERVICE_CONNECTION_TEST,
          context: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.CANCELLED,
        });
        return;
      }
      if (isSelfSignedCertificateError(apiVersion)) {
        const error = apiVersion;
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.ERROR,
          errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR,
          error,
        });
        logger.error(
          'Unable to fetch Endevor API version.',
          `${error.message}.`
        );
        dispatch({
          type: Actions.ENDEVOR_CONNECTION_TESTED,
          connectionId: serviceId,
          status: {
            status: EndevorConnectionStatus.INVALID,
          },
        });
        return;
      }
      if (isError(apiVersion)) {
        const error = apiVersion;
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.ERROR,
          errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.GENERIC_ERROR,
          error,
        });
        logger.error(
          'Unable to fetch Endevor API version.',
          `${error.message}.`
        );
        dispatch({
          type: Actions.ENDEVOR_CONNECTION_TESTED,
          connectionId: serviceId,
          status: {
            status: EndevorConnectionStatus.INVALID,
          },
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: V2TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
        status: ServiceConnectionTestStatus.SUCCESS,
        apiVersion,
      });
      dispatch({
        type: Actions.ENDEVOR_CONNECTION_TESTED,
        connectionId: serviceId,
        status: {
          status: EndevorConnectionStatus.VALID,
          apiVersion,
        },
      });
      return {
        status: EndevorConnectionStatus.VALID,
        value: {
          ...connectionDetails.value,
          apiVersion,
        },
      };
    },
  ];
};

type GetAnyConnectionDetails = (
  serviceId: EndevorId
) => Promise<EndevorConnection | undefined>;
export const resolveAnyConnectionDetails =
  (connectionDetailsGetter: ReadonlyArray<GetAnyConnectionDetails>) =>
  async (serviceId: EndevorId): Promise<EndevorConnection | undefined> => {
    for (const connectionDetails of connectionDetailsGetter) {
      const value = await connectionDetails(serviceId);
      if (value) return value;
    }
    return;
  };
export const defineAnyConnectionDetailsResolutionOrder = (
  getState: () => State
): ReadonlyArray<GetAnyConnectionDetails> => {
  return [
    async (serviceId) =>
      getEndevorConnectionDetailsFromStore(getState)(serviceId),
  ];
};

export type GetEndevorConfiguration = (
  serviceId?: EndevorId,
  searchLocationId?: EndevorId
) => Promise<EndevorConfiguration | undefined>;
export const resolveEndevorConfiguration =
  (configurationGetters: ReadonlyArray<GetEndevorConfiguration>) =>
  async (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ): Promise<EndevorConfiguration | undefined> => {
    for (const getEndevorConfiguration of configurationGetters) {
      const configuration = await getEndevorConfiguration(
        serviceId,
        searchLocationId
      );
      if (configuration) return configuration;
    }
    return undefined;
  };
export const defineEndevorConfigurationResolutionOrder = (
  getState: () => State
): ReadonlyArray<GetEndevorConfiguration> => {
  return [
    async (_serviceId?: EndevorId, searchLocationId?: EndevorId) => {
      if (!searchLocationId) {
        return;
      }
      return getEndevorConfigurationFromStore(getState)(searchLocationId);
    },
  ];
};

export type GetSearchLocation = (
  searchLocationId: EndevorId
) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>;
export const resolveSearchLocation =
  (searchLocationGetters: ReadonlyArray<GetSearchLocation>) =>
  async (
    searchLocationId: EndevorId
  ): Promise<Omit<ElementSearchLocation, 'configuration'> | undefined> => {
    for (const getSearchLocation of searchLocationGetters) {
      const searchLocation = await getSearchLocation(searchLocationId);
      if (searchLocation) return searchLocation;
    }
    return undefined;
  };
export const defineSearchLocationResolutionOrder = (
  getState: () => State
): ReadonlyArray<GetSearchLocation> => {
  return [
    async (searchLocationId) => {
      return getSearchLocationFromStore(getState)(searchLocationId);
    },
  ];
};
