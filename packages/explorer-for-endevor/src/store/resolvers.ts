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
  askForCredentialWithDefaultPasswordPolicy,
  askForCredentialWithoutValidation,
  dialogCancelled,
} from '../dialogs/credentials/endevorCredentialDialogs';
import { logger, reporter } from '../globals';
import { TelemetryEvents as V1TelemetryEvents } from '../_doc/Telemetry';
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
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
  EndevorTokenStatus,
  State,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from './_doc/v2/Store';
import { Action, Actions } from './_doc/Actions';
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import {
  withCancellableNotificationProgress,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { getApiVersion, getAuthenticationToken } from '../endevor';
import { formatWithNewLines } from '../utils';
import {
  isErrorEndevorResponse,
  isTokenCredentialExpired,
} from '@local/endevor/utils';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents as V2TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ENDEVOR_CREDENTIAL_VALIDATION_LIMIT } from '../constants';
import { SearchLocation } from '../_doc/Endevor';
import { isAuthWithToken } from '../settings/settings';

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
export const defineValidCredentialResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>,
  connection: EndevorConnection,
  configuration: EndevorConfiguration
): ReadonlyArray<GetValidCredentials> => {
  return [
    async (sessionId) => {
      if (!isAuthWithToken()) return;
      const token = getTokenFromStore(getState)(sessionId)(configuration);
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
        case EndevorTokenStatus.DISABLED:
          return;
        default:
          throw new UnreachableCaseError(token);
      }
    },
    async (sessionId) => {
      const credential = getCredentialFromStore(getState)(sessionId);
      const authWithToken = isAuthWithToken();
      if (!credential) return;
      switch (credential.status) {
        case EndevorCredentialStatus.VALID: {
          if (!authWithToken) return credential;
          const token = getTokenFromStore(getState)(sessionId)(configuration);
          if (token && token.status === EndevorTokenStatus.DISABLED)
            return credential;
          break;
        }
        case EndevorCredentialStatus.INVALID:
          return;
        case EndevorCredentialStatus.UNKNOWN:
          break;
        default:
          throw new UnreachableCaseError(credential);
      }
      const response = await withNotificationProgress(
        'Authenticating to Endevor ...'
      )((progress) => {
        return getAuthenticationToken(progress)({
          ...connection.value,
          credential: credential.value,
        })(configuration);
      });
      if (isErrorEndevorResponse(response)) {
        const errorResponse = response;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to authenticate to Endevor because of an error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        logger.trace(`${error.message}.`);
        switch (errorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            dispatch({
              type: Actions.ENDEVOR_CREDENTIAL_TESTED,
              credentialId: sessionId,
              status: EndevorCredentialStatus.INVALID,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            dispatch({
              type: Actions.ENDEVOR_CONNECTION_TESTED,
              connectionId: sessionId,
              status: {
                status: EndevorConnectionStatus.INVALID,
              },
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            return;
          default:
            throw new UnreachableCaseError(errorResponse.type);
        }
      }
      if (!isAuthWithToken) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
          sessionId,
          credential: {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          },
        });
        return {
          status: EndevorCredentialStatus.VALID,
          value: credential.value,
        };
      }
      if (response.result) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
          sessionId,
          configuration,
          token: {
            status: EndevorTokenStatus.ENABLED,
            value: response.result,
          },
        });
        return {
          status: EndevorCredentialStatus.VALID,
          value: response.result,
        };
      }
      logger.trace(
        `Endevor token authentication is disabled for ${configuration} configuration, using username/password instead.`
      );
      dispatch({
        type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
        sessionId,
        configuration,
        token: {
          status: EndevorTokenStatus.DISABLED,
        },
      });
      return {
        status: EndevorCredentialStatus.VALID,
        value: credential.value,
      };
    },
    async (sessionId) => {
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      const credential = await askForCredentialWithDefaultPasswordPolicy({
        validateCredential: async (credential) => {
          const response = await withNotificationProgress(
            'Authenticating to Endevor ...'
          )((progress) => {
            return getAuthenticationToken(progress)({
              ...connection.value,
              credential,
            })(configuration);
          });
          if (isErrorEndevorResponse(response)) {
            const errorResponse = response;
            // TODO: format using all possible error details
            const error = new Error(
              `Unable to authenticate to Endevor because of an error:${formatWithNewLines(
                errorResponse.details.messages
              )}`
            );
            logger.trace(`${error.message}.`);
            return;
          }
          if (!isAuthWithToken()) {
            dispatch({
              type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
              sessionId,
              credential: {
                status: EndevorCredentialStatus.VALID,
                value: credential,
              },
            });
            return {
              status: EndevorCredentialStatus.VALID,
              value: credential,
            };
          }
          if (response.result) {
            return {
              status: EndevorCredentialStatus.VALID,
              value: credential,
              token: response.result,
            };
          }
          return {
            status: EndevorCredentialStatus.VALID,
            value: credential,
          };
        },
        validationAttempts: ENDEVOR_CREDENTIAL_VALIDATION_LIMIT,
      })();
      if (dialogCancelled(credential)) return;
      switch (credential.status) {
        case EndevorCredentialStatus.VALID: {
          reporter.sendTelemetryEvent({
            type: V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
          });
          const token = credential.token;
          if (!token) {
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
            return {
              status: EndevorCredentialStatus.VALID,
              value: credential.value,
            };
          }
          dispatch({
            type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
            sessionId,
            configuration,
            token: {
              status: EndevorTokenStatus.ENABLED,
              value: token,
            },
            credential: {
              status: EndevorCredentialStatus.VALID,
              value: credential.value,
            },
          });
          return {
            status: EndevorCredentialStatus.VALID,
            value: token,
          };
        }
        case EndevorCredentialStatus.INVALID:
          dispatch({
            type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
            sessionId,
            credential,
          });
          return;
        default:
          throw new UnreachableCaseError(credential);
      }
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
export const defineAnyCredentialResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>,
  connection: EndevorConnection,
  configuration: EndevorConfiguration
): ReadonlyArray<GetAnyCredentials> => {
  return [
    async (sessionId) => {
      if (!isAuthWithToken()) return;
      const token = getTokenFromStore(getState)(sessionId)(configuration);
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
        case EndevorTokenStatus.DISABLED:
          return;
        default:
          throw new UnreachableCaseError(token);
      }
    },
    async (sessionId) => {
      let credential: EndevorCredential;
      const storedCredential = getCredentialFromStore(getState)(sessionId);
      if (storedCredential) credential = storedCredential;
      else {
        reporter.sendTelemetryEvent({
          type: V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
        });
        const missingCredential = await askForCredentialWithoutValidation();
        if (dialogCancelled(missingCredential)) return;
        reporter.sendTelemetryEvent({
          type: V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
        });
        credential = {
          status: EndevorCredentialStatus.UNKNOWN,
          value: missingCredential.value,
        };
      }
      const token = getTokenFromStore(getState)(sessionId)(configuration);
      const useToken = isAuthWithToken();
      switch (credential.status) {
        case EndevorCredentialStatus.VALID: {
          if (
            !useToken ||
            (token && token.status === EndevorTokenStatus.DISABLED)
          )
            return credential;
          break;
        }
        case EndevorCredentialStatus.INVALID:
        case EndevorCredentialStatus.UNKNOWN:
          break;
        default:
          throw new UnreachableCaseError(credential);
      }
      const response = await withNotificationProgress(
        'Authenticating to Endevor ...'
      )((progress) => {
        return getAuthenticationToken(progress)({
          ...connection.value,
          credential: credential.value,
        })(configuration);
      });
      if (isErrorEndevorResponse(response)) {
        const errorResponse = response;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to authenticate to Endevor because of an error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        logger.trace(`${error.message}.`);
        switch (errorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.error(
              'Endevor credentials are incorrect or expired.',
              `${errorResponse.details.messages}.`
            );
            dispatch({
              type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
              sessionId,
              credential: {
                status: EndevorCredentialStatus.INVALID,
                value: credential.value,
              },
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.error(
              'Unable to connect to Endevor Web Services.',
              `${errorResponse.details.messages}.`
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
            return;
          default:
            throw new UnreachableCaseError(errorResponse.type);
        }
      }
      if (!useToken) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
          sessionId,
          credential: {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          },
        });
        return;
      }
      if (token && token.status === EndevorTokenStatus.DISABLED) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED,
          sessionId,
          credential: {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          },
        });
        return;
      }
      if (response.result) {
        dispatch({
          type: Actions.SESSION_ENDEVOR_TOKEN_ADDED,
          sessionId,
          configuration,
          token: {
            status: EndevorTokenStatus.ENABLED,
            value: response.result,
          },
          credential: {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          },
        });
        return;
      }
      logger.trace(
        `Endevor token authentication is disabled for ${configuration} configuration, using username/password instead.`
      );
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
      return;
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
      const apiVersionResponse = await withCancellableNotificationProgress(
        'Fetching Endevor API version'
      )((progress) =>
        getApiVersion(progress)(connectionDetails.value.location)(
          connectionDetails.value.rejectUnauthorized
        )
      );
      if (!apiVersionResponse) {
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.SERVICE_CONNECTION_TEST,
          context: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
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
              type: V2TelemetryEvents.ERROR,
              errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
              status: ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR,
              error,
            });
            logger.error(
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
              type: V2TelemetryEvents.ERROR,
              errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
              status: ServiceConnectionTestStatus.GENERIC_ERROR,
              error,
            });
            logger.error(
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
