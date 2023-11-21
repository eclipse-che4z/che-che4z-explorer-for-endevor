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
  askForCredentialWithoutValidation,
  dialogCancelled,
} from '../dialogs/credentials/endevorCredentialDialogs';
import { reporter } from '../globals';
import {
  getCredential as getCredentialFromStore,
  getSearchLocation as getSearchLocationFromStore,
  getEndevorConnectionDetails as getEndevorConnectionDetailsFromStore,
  getEndevorConfigurationBySearchLocationId as getEndevorConfigurationFromSearchLocation,
  getToken as getTokenFromStore,
} from './store';
import {
  EndevorConfiguration,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorCredentialStatus,
  EndevorId,
  EndevorTokenStatus,
  State,
  UnknownEndevorCredential,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from './_doc/v2/Store';
import { Action, Actions } from './_doc/Actions';
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import {
  withCancellableNotificationProgress,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  getApiVersionAndLogActivity,
  getAuthenticationTokenAndLogActivity,
} from '../api/endevor';
import { formatWithNewLines } from '../utils';
import {
  isErrorEndevorResponse,
  isTokenCredentialExpired,
} from '@local/endevor/utils';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents,
} from '../telemetry/_doc/Telemetry';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { SearchLocation } from '../api/_doc/Endevor';
import { isAuthWithToken } from '../settings/settings';
import { CredentialsStorage } from './storage/_doc/Storage';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../logger';

export type GetValidOrUnknownCredentials = (
  credentialId: EndevorId
) => Promise<UnknownEndevorCredential | ValidEndevorCredential | undefined>;
export const resolveValidOrUnknownCredentials =
  (credentialsGetter: ReadonlyArray<GetValidOrUnknownCredentials>) =>
  async (
    credentialId: EndevorId
  ): Promise<UnknownEndevorCredential | ValidEndevorCredential | undefined> => {
    for (const getCredentials of credentialsGetter) {
      const credentials = await getCredentials(credentialId);
      if (credentials) return credentials;
    }
    return undefined;
  };
export const defineValidOrUnknownCredentialsResolutionOrder = (
  getState: () => State,
  getCredentialsStorage: () => CredentialsStorage
): ReadonlyArray<GetValidOrUnknownCredentials> => {
  return [
    async (credentialId) => {
      const credential = await getCredentialFromStore(getState)(
        getCredentialsStorage
      )(credentialId);
      if (!credential) return;
      switch (credential.status) {
        case EndevorCredentialStatus.VALID:
        case EndevorCredentialStatus.UNKNOWN:
          return credential;
        case EndevorCredentialStatus.INVALID:
          return;
        default:
          throw new UnreachableCaseError(credential);
      }
    },
    async (credentialId) => {
      const logger = createEndevorLogger({ serviceId: credentialId });
      const credential = await askForCredentialWithoutValidation();
      if (dialogCancelled(credential)) {
        logger.errorWithDetails(
          `Endevor credentials must be specified for ${credentialId.name}.`
        );
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
      });
      return credential;
    },
  ];
};

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
export const defineValidCredentialResolutionOrder =
  (
    getState: () => State,
    dispatch: (action: Action) => Promise<void>,
    getCredentialsStorage: () => CredentialsStorage,
    getBaseCredential: (
      sessionId: EndevorId
    ) => Promise<UnknownEndevorCredential | ValidEndevorCredential | undefined>,
    connection: EndevorConnection,
    configuration: EndevorConfiguration
  ) =>
  (options?: {
    undefinedIfRevalidated?: boolean; // required for the provider immediate exit
  }): ReadonlyArray<GetValidCredentials> => {
    return [
      async (sessionId) => {
        const logger = createEndevorLogger({ serviceId: sessionId });
        const token = await getTokenFromStore(getState)(getCredentialsStorage)(
          sessionId
        )(configuration);
        if (!token) return;
        switch (token.status) {
          case EndevorTokenStatus.ENABLED:
            if (isTokenCredentialExpired(token.value)) {
              logger.trace(
                'Endevor authentication token is expired, proceeding with the request for a new one.'
              );
              return;
            }
            return {
              status: EndevorCredentialStatus.VALID,
              value: token.value,
            };
          case EndevorTokenStatus.DISABLED: {
            const credential = await getCredentialFromStore(getState)(
              getCredentialsStorage
            )(sessionId);
            if (!credential) return;
            switch (credential.status) {
              case EndevorCredentialStatus.VALID:
                return credential;
              case EndevorCredentialStatus.INVALID:
              case EndevorCredentialStatus.UNKNOWN:
                return;
              default:
                throw new UnreachableCaseError(credential);
            }
          }
          default:
            throw new UnreachableCaseError(token);
        }
      },
      async (sessionId) => {
        const logger = createEndevorLogger({ serviceId: sessionId });
        const credential = await getBaseCredential(sessionId);
        if (!credential) return;
        const response = await withNotificationProgress(
          'Authenticating to Endevor ...'
        )((progress) => {
          return getAuthenticationTokenAndLogActivity(
            setLogActivityContext(dispatch, {
              serviceId: sessionId,
            })
          )(progress)({
            ...connection.value,
            configuration,
            credential: credential.value,
          });
        });
        if (isErrorEndevorResponse(response)) {
          const errorResponse = response;
          // TODO: format using all possible error details
          const error = new Error(
            `Unable to authenticate to Endevor because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          switch (errorResponse.type) {
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
              logger.errorWithDetails(
                'Endevor credentials are incorrect or expired.',
                `${error.message}.`
              );
              dispatch({
                type: Actions.ENDEVOR_CREDENTIAL_TESTED,
                credentialId: sessionId,
                status: EndevorCredentialStatus.INVALID,
              });
              return;
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              logger.errorWithDetails(
                'Unable to connect to Endevor Web Services.',
                `${error.message}.`
              );
              dispatch({
                type: Actions.ENDEVOR_CONNECTION_TESTED,
                connectionId: sessionId,
                status: {
                  status: EndevorConnectionStatus.INVALID,
                },
              });
              return;
            case ErrorResponseType.GENERIC_ERROR:
              logger.errorWithDetails(
                'Unable to authenticate to Endevor.',
                `${error.message}.`
              );
              dispatch({
                type: Actions.ENDEVOR_CONNECTION_TESTED,
                connectionId: sessionId,
                status: {
                  status: EndevorConnectionStatus.INVALID,
                },
              });
              return;
            default:
              throw new UnreachableCaseError(errorResponse.type);
          }
        }
        if (response.result && isAuthWithToken()) {
          dispatch({
            type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
            sessionId,
            configuration,
            token: {
              status: EndevorTokenStatus.ENABLED,
              value: response.result,
            },
          });
        } else {
          dispatch({
            type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
            sessionId,
            configuration,
            token: {
              status: EndevorTokenStatus.DISABLED,
            },
            credential: {
              status: EndevorCredentialStatus.VALID,
              value: credential.value,
            },
          });
        }
        if (options?.undefinedIfRevalidated) return;
        return {
          status: EndevorCredentialStatus.VALID,
          value:
            response.result && isAuthWithToken()
              ? response.result
              : credential.value,
        };
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
      const logger = createEndevorLogger({ serviceId });
      const connectionDetails =
        getEndevorConnectionDetailsFromStore(getState)(serviceId);
      if (!connectionDetails) return;
      if (connectionDetails.status === EndevorConnectionStatus.INVALID) return;
      if (connectionDetails.status === EndevorConnectionStatus.VALID) {
        return connectionDetails;
      }
      const apiVersionResponse = await withCancellableNotificationProgress(
        'Fetching Endevor API version'
      )((progress) =>
        getApiVersionAndLogActivity(
          setLogActivityContext(dispatch, {
            serviceId,
          })
        )(progress)({
          location: connectionDetails.value.location,
          rejectUnauthorized: connectionDetails.value.rejectUnauthorized,
        })
      );
      if (!apiVersionResponse) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SERVICE_CONNECTION_TEST,
          context: TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.CANCELLED,
        });
        return;
      }
      if (isErrorEndevorResponse(apiVersionResponse)) {
        const errorResponse = apiVersionResponse;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to fetch Endevor Web Services API version because of error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        switch (errorResponse.type) {
          case ErrorResponseType.CERT_VALIDATION_ERROR:
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
              status: ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR,
              error,
            });
            logger.errorWithDetails(
              'Unable to fetch Endevor Web Services API version.',
              `${error.message}.`
            );
            dispatch({
              type: Actions.ENDEVOR_CONNECTION_TESTED,
              connectionId: serviceId,
              status: {
                status: EndevorConnectionStatus.INVALID,
              },
            });
            break;
          case ErrorResponseType.CONNECTION_ERROR:
          case ErrorResponseType.GENERIC_ERROR:
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
              status: ServiceConnectionTestStatus.GENERIC_ERROR,
              error,
            });
            logger.errorWithDetails(
              'Unable to fetch Endevor Web Services API version.',
              `${error.message}.`
            );
            dispatch({
              type: Actions.ENDEVOR_CONNECTION_TESTED,
              connectionId: serviceId,
              status: {
                status: EndevorConnectionStatus.INVALID,
              },
            });
            break;
          default:
            throw new UnreachableCaseError(errorResponse.type);
        }
        return;
      }
      const apiVersion = apiVersionResponse.result;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
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
    // for now configuration only exists in search locations
    async (_, searchLocationId) => {
      if (!searchLocationId) return;
      return getEndevorConfigurationFromSearchLocation(getState)(
        searchLocationId
      );
    },
  ];
};

export type GetSearchLocation = (
  searchLocationId: EndevorId
) => Promise<SearchLocation | undefined>;
export const resolveSearchLocation =
  (searchLocationGetters: ReadonlyArray<GetSearchLocation>) =>
  async (searchLocationId: EndevorId): Promise<SearchLocation | undefined> => {
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
