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
import {
  ElementsFetchingStatus,
  EndevorMapBuildingStatus,
  TelemetryEvents as V1TelemetryEvents,
} from '../_doc/Telemetry';
import {
  getCredential as getCredentialFromStore,
  getSearchLocation as getSearchLocationFromStore,
  getEndevorCache,
  getEndevorConnectionDetails as getEndevorConnectionDetailsFromStore,
  getEndevorConfiguration as getEndevorConfigurationFromStore,
} from './store';
import {
  CachedElement,
  EndevorCacheItem,
  EndevorConfiguration,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
  InvalidEndevorConnection,
  InvalidEndevorCredential,
  State,
  UnknownEndevorCredential,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from './_doc/v2/Store';
import { Action, Actions } from './_doc/Actions';
import {
  Element,
  ElementSearchLocation,
  ServiceApiVersion,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import {
  withCancellableNotificationProgress,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  getAllEnvironmentStages,
  getAllSubSystems,
  getAllSystems,
  getApiVersion,
  searchForAllElements,
  validateCredentials,
} from '../endevor';
import { isDefined, isError, isPromise } from '../utils';
import { EndevorMap } from '../_doc/Endevor';
import {
  isConnectionError,
  isSelfSignedCertificateError,
  isWrongCredentialsError,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import { toEndevorMap, toEndevorMapWithWildcards } from '../tree/endevorMap';
import { toElementCompositeKey } from './utils';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents as V2TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ENDEVOR_CREDENTIAL_VALIDATION_LIMIT } from '../constants';
import { EventEmitter } from 'vscode';

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

type PendingTask = Promise<undefined>;
export type GetEndevorCache = (
  serviceId: EndevorId,
  searchLocationId: EndevorId
) => EndevorCacheItem | undefined | PendingTask;
export const resolveEndevorCache =
  (elementGetters: ReadonlyArray<GetEndevorCache>) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): EndevorCacheItem | undefined | PendingTask => {
    for (const getCache of elementGetters) {
      const endevorCache = getCache(serviceId, searchLocationId);
      const isPendingTask = isPromise(endevorCache);
      if (endevorCache || isPendingTask) return endevorCache;
    }
    return undefined;
  };
export const defineEndevorCacheResolver = (
  getState: () => State,
  connection: EndevorConnection,
  configuration: EndevorConfiguration,
  credential: EndevorCredential,
  elementsSearchLocation: Omit<ElementSearchLocation, 'configuration'>,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetEndevorCache> => {
  return [
    (serviceId, searchLocationId) =>
      getEndevorCache(getState)(serviceId)(searchLocationId),
    (serviceId, searchLocationId) => {
      return new Promise((resolve) => {
        (async () => {
          const tasksNumber = 4;
          const result = await withCancellableNotificationProgress(
            'Fetching Endevor elements and map structure'
          )((progress, cancellationToken) => {
            // use the first task to test connections and credentials issues
            // decline all other tasks if first is already unsuccessful
            const testTaskCompletionEmitter: EventEmitter<Error | void> =
              new EventEmitter();
            const testTaskCompletion = new Promise<Error | void>((resolve) => {
              testTaskCompletionEmitter.event((value) => {
                resolve(value);
              });
            });
            return Promise.all([
              (async () => {
                const taskResult = await getAllEnvironmentStages(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration);
                if (cancellationToken?.isCancellationRequested) {
                  testTaskCompletionEmitter.fire(undefined);
                  return [];
                }
                if (isConnectionError(taskResult)) {
                  const error = taskResult;
                  logger.error(
                    'Unable to connect to Endevor Web Services.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  const testedConnection: InvalidEndevorConnection = {
                    status: EndevorConnectionStatus.INVALID,
                    value: connection.value,
                  };
                  const testedCredential: UnknownEndevorCredential = {
                    status: EndevorCredentialStatus.UNKNOWN,
                    value: credential.value,
                  };
                  dispatch({
                    type: Actions.ENDEVOR_CACHE_FETCHED,
                    endevorCachedItem: {},
                    serviceId,
                    searchLocationId,
                    connection: testedConnection,
                    credential: testedCredential,
                  });
                  testTaskCompletionEmitter.fire(error);
                  return error;
                }
                if (isWrongCredentialsError(taskResult)) {
                  const error = taskResult;
                  logger.error(
                    'Endevor credentials are incorrect.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  const anyVersion = ServiceApiVersion.V2;
                  const testedConnection: ValidEndevorConnection = {
                    status: EndevorConnectionStatus.VALID,
                    value: {
                      ...connection.value,
                      apiVersion: anyVersion,
                    },
                  };
                  const testedCredential: InvalidEndevorCredential = {
                    status: EndevorCredentialStatus.INVALID,
                    value: credential.value,
                  };
                  dispatch({
                    type: Actions.ENDEVOR_CACHE_FETCHED,
                    endevorCachedItem: {},
                    serviceId,
                    searchLocationId,
                    connection: testedConnection,
                    credential: testedCredential,
                  });
                  testTaskCompletionEmitter.fire(error);
                  return error;
                }
                if (isError(taskResult)) {
                  const error = taskResult;
                  logger.error(
                    'Unable to fetch environment stages information from Endevor.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  testTaskCompletionEmitter.fire(error);
                  return error;
                }
                testTaskCompletionEmitter.fire(undefined);
                return taskResult;
              })(),
              (async (): Promise<ReadonlyArray<System> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const systems = await getAllSystems(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration);
                if (isError(systems)) {
                  const error = systems;
                  logger.error(
                    'Unable to fetch systems information from Endevor.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  return error;
                }
                return systems;
              })(),
              (async (): Promise<ReadonlyArray<SubSystem> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const subsystems = await getAllSubSystems(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration);
                if (isError(subsystems)) {
                  const error = subsystems;
                  logger.error(
                    'Unable to fetch subsystems information from Endevor.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  return error;
                }
                return subsystems;
              })(),
              (async (): Promise<ReadonlyArray<Element> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const elements = await searchForAllElements(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })({
                  configuration,
                  ...elementsSearchLocation,
                });
                if (isError(elements)) {
                  const error = elements;
                  reporter.sendTelemetryEvent({
                    type: V1TelemetryEvents.ERROR,
                    errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                    status: ElementsFetchingStatus.GENERIC_ERROR,
                    error,
                  });
                  logger.error(
                    'Unable to fetch any valid element from Endevor.',
                    `${error.message}.`
                  );
                  return error;
                }
                reporter.sendTelemetryEvent({
                  type: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                  elementsAmount: elements.length,
                });
                return elements;
              })(),
            ]);
          });
          const operationCancelled = !result;
          if (operationCancelled) {
            resolve(undefined);
            return;
          }
          const [environmentStages, systems, subsystems, elements] = result;
          if (
            isError(environmentStages) ||
            isError(systems) ||
            isError(subsystems) ||
            isError(elements)
          ) {
            resolve(undefined);
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchEnvironment = elementsSearchLocation.environment!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchStage = elementsSearchLocation.stageNumber!;
          let endevorMap: EndevorMap;
          if (
            !isDefined(elementsSearchLocation.subsystem) ||
            !isDefined(elementsSearchLocation.system)
          ) {
            endevorMap = toEndevorMapWithWildcards(environmentStages)(systems)(
              subsystems
            )({
              environment: searchEnvironment,
              stageNumber: searchStage,
            });
          } else {
            endevorMap = toEndevorMap(environmentStages)(systems)(subsystems)({
              environment: searchEnvironment,
              stageNumber: searchStage,
              system: elementsSearchLocation.system,
              subSystem: elementsSearchLocation.subsystem,
            });
          }
          const lastRefreshTimestamp = Date.now();
          const endevorCachedItem: EndevorCacheItem = {
            endevorMap,
            elements: elements.reduce(
              (acc: { [id: string]: CachedElement }, element) => {
                const newElementId =
                  toElementCompositeKey(serviceId)(searchLocationId)(element);
                acc[newElementId] = {
                  element,
                  lastRefreshTimestamp,
                };
                return acc;
              },
              {}
            ),
          };
          if (!endevorCachedItem) {
            resolve(undefined);
            return;
          }
          const anyVersion = ServiceApiVersion.V2;
          const testedConnection: ValidEndevorConnection = {
            status: EndevorConnectionStatus.VALID,
            value: {
              ...connection.value,
              apiVersion: anyVersion,
            },
          };
          const testedCredential: ValidEndevorCredential = {
            status: EndevorCredentialStatus.VALID,
            value: credential.value,
          };
          dispatch({
            type: Actions.ENDEVOR_CACHE_FETCHED,
            endevorCachedItem,
            serviceId,
            searchLocationId,
            connection: testedConnection,
            credential: testedCredential,
          });
          resolve(undefined);
          return;
        })();
      });
    },
  ];
};
