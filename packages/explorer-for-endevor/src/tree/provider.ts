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

import * as vscode from 'vscode';
import { Node } from './_doc/ServiceLocationTree';
import {
  addNewSearchLocationButton,
  toServiceNodes,
  emptyMapNode,
  toFilteredNode,
} from './nodes';
import { buildTree } from './endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  CachedElement,
  ElementsPerRoute,
  EndevorCacheVersion,
  EndevorConfiguration,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
  EndevorServiceLocations,
  InvalidEndevorConnection,
  InvalidEndevorCredential,
  State,
  UnknownEndevorConnection,
  UnknownEndevorCredential,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from '../store/_doc/v2/Store';
import {
  Element,
  ElementSearchLocation,
  EnvironmentStageResponseObject,
  ServiceApiVersion,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import { toTreeItem } from './render';
import { byNameOrder, isDefined, isError } from '../utils';
import { Action, Actions } from '../store/_doc/Actions';
import {
  setContextVariable,
  withCancellableNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  getAllEnvironmentStages,
  searchForAllElements,
  searchForSubSystemsFromEnvironmentStage,
  searchForSystemsFromEnvironmentStage,
  searchForElementsInPlace,
} from '../endevor';
import { logger, reporter } from '../globals';
import { toElementCompositeKey } from '../store/utils';
import {
  isConnectionError,
  isWrongCredentialsError,
  subsystemStageIdToStageNumber,
  systemStageIdToStageNumber,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import {
  ElementsFetchingStatus,
  EndevorMapBuildingStatus,
  TelemetryEvents as V1TelemetryEvents,
} from '../_doc/Telemetry';
import { EndevorMap } from '../_doc/Endevor';
import { toEndevorMap, toEndevorMapWithWildcards } from './endevorMap';
import {
  getElementCcidsFilterValue,
  getElementNamesFilterValue,
  getElementsInPlace,
  getElementsUpTheMapFilterValue,
  getEndevorMap,
  getFirstFoundElements,
} from '../store/store';
import {
  DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
  TREE_VIEW_INITIALIZED_CONTEXT_NAME,
} from '../constants';

interface DataGetters {
  getState: () => State;
  getServiceLocations: () => EndevorServiceLocations;
  getConnectionDetails: (
    id: EndevorId
  ) => Promise<EndevorConnection | undefined>;
  getCredential: (
    credentialId: EndevorId
  ) => Promise<EndevorCredential | undefined>;
  getSearchLocation: (
    searchLocationId: EndevorId
  ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>;
  getEndevorConfiguration: (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ) => Promise<EndevorConfiguration | undefined>;
  dispatch: (action: Action) => Promise<void>;
}

export const make = (
  treeChangeEmitter: vscode.EventEmitter<Node | null>,
  dataGetters: DataGetters
): vscode.TreeDataProvider<Node> => {
  const elmListProvider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: treeChangeEmitter.event,
    getTreeItem(node: Node) {
      return toTreeItem(node);
    },
    async getChildren(node?: Node) {
      if (!node) {
        setContextVariable(TREE_VIEW_INITIALIZED_CONTEXT_NAME, true);
        return toServiceNodes(dataGetters.getServiceLocations()).sort(
          byNameOrder
        );
      }
      switch (node.type) {
        case 'BUTTON_ADD_SEARCH_LOCATION':
          return [];
        case 'SERVICE':
        case 'SERVICE_PROFILE': {
          const searchLocations = node.children.sort(byNameOrder);
          if (searchLocations.length) return searchLocations;
          return [addNewSearchLocationButton(node)];
        }
        case 'SERVICE_PROFILE/NON_EXISTING':
        case 'SERVICE/NON_EXISTING':
        case 'SERVICE_PROFILE/INVALID_CONNECTION':
        case 'SERVICE/INVALID_CONNECTION':
        case 'SERVICE_PROFILE/INVALID_CREDENTIALS':
        case 'SERVICE/INVALID_CREDENTIALS':
          return node.children.sort(byNameOrder);
        case 'LOCATION':
        case 'LOCATION/WITH_MAP':
        case 'LOCATION_PROFILE/WITH_MAP':
        case 'LOCATION_PROFILE': {
          const serviceId: EndevorId = {
            name: node.serviceName,
            source: node.serviceSource,
          };
          const searchLocationId: EndevorId = {
            name: node.name,
            source: node.source,
          };
          const connectionDetails = await dataGetters.getConnectionDetails(
            serviceId
          );
          if (!connectionDetails) return [];
          const configuration = await dataGetters.getEndevorConfiguration(
            serviceId,
            searchLocationId
          );
          if (!configuration) return [];
          const credential = await dataGetters.getCredential(serviceId);
          if (!credential) return [];
          const elementsSearchLocation = await dataGetters.getSearchLocation(
            searchLocationId
          );
          if (!elementsSearchLocation) return [];
          // acts like a React effect:
          //    get data from a cache (if available) and render it immediately
          //    or
          //    render with existing value (if available) and fetch the actual data from REST API with the following rerender afterwards
          const searchForFirstFoundElements =
            getElementsUpTheMapFilterValue(dataGetters.getState)(serviceId)(
              searchLocationId
            )?.value ?? DEFAULT_TREE_IN_PLACE_SEARCH_MODE;
          const endevorCache = endevorCacheEffect(
            dataGetters.getState,
            dataGetters.dispatch
          )(searchForFirstFoundElements)(
            serviceId,
            searchLocationId,
            connectionDetails,
            configuration,
            credential,
            elementsSearchLocation
          );
          const isCachedData = (
            value: PendingTask | EndevorData
          ): value is EndevorData => {
            return 'elementsPerRoute' in value;
          };
          const nameFilter = getElementNamesFilterValue(dataGetters.getState)(
            serviceId
          )(searchLocationId);
          const ccidFilter = getElementCcidsFilterValue(dataGetters.getState)(
            serviceId
          )(searchLocationId);
          const filteredNode =
            toFilteredNode(serviceId)(searchLocationId)(nameFilter)(ccidFilter);
          if (isCachedData(endevorCache)) {
            if (
              !endevorCache.elementsPerRoute ||
              !Object.keys(endevorCache.elementsPerRoute).length
            ) {
              return [];
            }
            const endevorTree = buildTree(
              serviceId,
              {
                ...connectionDetails.value,
                credential: credential.value,
              },
              searchLocationId,
              {
                configuration,
                ...elementsSearchLocation,
              }
            )(endevorCache.elementsPerRoute)({
              withElementsUpTheMap: searchForFirstFoundElements,
              showEmptyRoutes: false,
            }).sort(byNameOrder);
            if (!filteredNode) return endevorTree;
            return [filteredNode, ...endevorTree];
          }
          await endevorCache.pendingTask;
          const outdatedCacheValue = endevorCache.outdatedCacheValue;
          if (
            !outdatedCacheValue?.elementsPerRoute ||
            !Object.keys(outdatedCacheValue.elementsPerRoute).length
          ) {
            return [];
          }
          const endevorTree = buildTree(
            serviceId,
            {
              ...connectionDetails.value,
              credential: credential.value,
            },
            searchLocationId,
            {
              configuration,
              ...elementsSearchLocation,
            }
          )(outdatedCacheValue.elementsPerRoute)({
            withElementsUpTheMap: searchForFirstFoundElements,
            showEmptyRoutes: false,
          }).sort(byNameOrder);
          if (!filteredNode) return endevorTree;
          return [filteredNode, ...endevorTree];
        }
        case 'LOCATION_PROFILE/NON_EXISTING':
        case 'LOCATION/NON_EXISTING':
        case 'LOCATION_PROFILE/INVALID_CONNECTION':
        case 'LOCATION/INVALID_CONNECTION':
        case 'LOCATION_PROFILE/INVALID_CREDENTIALS':
        case 'LOCATION/INVALID_CREDENTIALS':
          return [];
        case 'SYS':
          return Array.from(node.children.values()).sort(byNameOrder);
        case 'SUB':
          return Array.from(node.children.values()).sort(byNameOrder);
        case 'TYPE':
          return node.map
            ? [node.map, ...node.elements.sort(byNameOrder)]
            : [...node.elements.sort(byNameOrder)];
        case 'MAP': {
          const elementUpTheMap = node.elements.sort(byNameOrder);
          if (elementUpTheMap.length) {
            return elementUpTheMap;
          }
          return [emptyMapNode];
        }
        case 'FILTERED':
          return Array.from(node.children.values());
        case 'FILTER': {
          const filters = Array.from(node.children.values());
          if (filters.length) {
            return filters;
          }
          return [];
        }
        case 'FILTER_VALUE':
          return [];
        case 'EMPTY_MAP_NODE':
          return [];
        case 'ELEMENT_IN_PLACE':
        case 'ELEMENT_UP_THE_MAP':
          return [];
        default:
          throw new UnreachableCaseError(node);
      }
    },
  };
  return elmListProvider;
};

type EndevorData = Readonly<{
  elementsPerRoute: ElementsPerRoute | undefined;
}>;

type PendingTask = Readonly<{
  pendingTask: Promise<undefined>;
  outdatedCacheValue: EndevorData | undefined;
}>;
const endevorCacheEffect =
  (getState: () => State, dispatch: (action: Action) => Promise<void>) =>
  (searchForFirstFound: boolean) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    connection: EndevorConnection,
    configuration: EndevorConfiguration,
    credential: EndevorCredential,
    elementsSearchLocation: Omit<ElementSearchLocation, 'configuration'>
  ): EndevorData | PendingTask => {
    if (!searchForFirstFound) {
      const elements =
        getElementsInPlace(getState)(serviceId)(searchLocationId);
      if (elements?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
        return {
          elementsPerRoute: elements.elementsPerRoute,
        };
      }
      return {
        outdatedCacheValue: {
          elementsPerRoute: elements?.elementsPerRoute,
        },
        pendingTask: new Promise((resolve) => {
          (async () => {
            const elements = await withCancellableNotificationProgress(
              'Fetching elements'
            )((progress) =>
              searchForElementsInPlace(progress)({
                ...connection.value,
                credential: credential.value,
              })({
                configuration,
                ...elementsSearchLocation,
              })
            );
            const operationCancelled = !elements;
            if (operationCancelled) {
              dispatch({
                type: Actions.ELEMENTS_FETCH_CANCELED,
                serviceId,
                searchLocationId,
              });
              resolve(undefined);
              return;
            }
            if (isConnectionError(elements)) {
              const error = elements;
              logger.error(
                'Unable to connect to Endevor Web Services.',
                `${error.message}.`
              );
              reporter.sendTelemetryEvent({
                type: V1TelemetryEvents.ERROR,
                errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                error,
              });
              const testedConnection: InvalidEndevorConnection = {
                status: EndevorConnectionStatus.INVALID,
                value: connection.value,
              };
              const unknownCredential: UnknownEndevorCredential = {
                status: EndevorCredentialStatus.UNKNOWN,
                value: credential.value,
              };
              dispatch({
                type: Actions.ELEMENTS_FETCH_FAILED,
                serviceId,
                searchLocationId,
                connection: testedConnection,
                credential: unknownCredential,
              });
              resolve(undefined);
              return error;
            }
            if (isWrongCredentialsError(elements)) {
              const error = elements;
              logger.error(
                'Endevor credentials are incorrect.',
                `${error.message}.`
              );
              reporter.sendTelemetryEvent({
                type: V1TelemetryEvents.ERROR,
                errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
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
                type: Actions.ELEMENTS_FETCH_FAILED,
                serviceId,
                searchLocationId,
                connection: testedConnection,
                credential: testedCredential,
              });
              resolve(undefined);
              return error;
            }
            if (isError(elements)) {
              const testedConnection: UnknownEndevorConnection = {
                status: EndevorConnectionStatus.UNKNOWN,
                value: connection.value,
              };
              const testedCredential: UnknownEndevorCredential = {
                status: EndevorCredentialStatus.UNKNOWN,
                value: credential.value,
              };
              dispatch({
                type: Actions.ELEMENTS_FETCH_FAILED,
                serviceId,
                searchLocationId,
                credential: testedCredential,
                connection: testedConnection,
              });
              const error = elements;
              reporter.sendTelemetryEvent({
                type: V1TelemetryEvents.ERROR,
                errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                error,
              });
              logger.warn(
                'Unable to fetch the list of elements from Endevor.',
                `${error.message}.`
              );
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
            const lastRefreshTimestamp = Date.now();
            dispatch({
              type: Actions.ELEMENTS_IN_PLACE_FETCHED,
              serviceId,
              searchLocationId,
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
              connection: testedConnection,
              credential: testedCredential,
            });
            reporter.sendTelemetryEvent({
              type: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
              elementsAmount: elements.length,
            });
            resolve(undefined);
            return;
          })();
        }),
      };
    }
    const elements =
      getFirstFoundElements(getState)(serviceId)(searchLocationId);
    if (elements?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
      return {
        elementsPerRoute: elements.elementsPerRoute,
      };
    }
    const elementsMap = getEndevorMap(getState)(serviceId)(searchLocationId);
    if (elementsMap?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
      return {
        outdatedCacheValue: {
          elementsPerRoute: elements?.elementsPerRoute,
        },
        pendingTask: new Promise((resolve) => {
          (async () => {
            const elements = await withCancellableNotificationProgress(
              'Fetching elements'
            )((progress) =>
              searchForAllElements(progress)({
                ...connection.value,
                credential: credential.value,
              })({
                configuration,
                ...elementsSearchLocation,
              })
            );
            const operationCancelled = !elements;
            if (operationCancelled) {
              dispatch({
                type: Actions.ELEMENTS_FETCH_CANCELED,
                serviceId,
                searchLocationId,
              });
              resolve(undefined);
              return;
            }
            if (isError(elements)) {
              const testedConnection: UnknownEndevorConnection = {
                status: EndevorConnectionStatus.UNKNOWN,
                value: connection.value,
              };
              const testedCredential: UnknownEndevorCredential = {
                status: EndevorCredentialStatus.UNKNOWN,
                value: credential.value,
              };
              dispatch({
                type: Actions.ELEMENTS_FETCH_FAILED,
                serviceId,
                searchLocationId,
                credential: testedCredential,
                connection: testedConnection,
              });
              const error = elements;
              reporter.sendTelemetryEvent({
                type: V1TelemetryEvents.ERROR,
                errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                error,
              });
              logger.warn(
                'Unable to fetch the list of elements from Endevor.',
                `${error.message}.`
              );
              resolve(undefined);
              return;
            }
            const lastRefreshTimestamp = Date.now();
            dispatch({
              type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
              serviceId,
              searchLocationId,
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
            });
            resolve(undefined);
            return;
          })();
        }),
      };
    }
    return {
      outdatedCacheValue: {
        elementsPerRoute: elements?.elementsPerRoute,
      },
      pendingTask: new Promise((resolve) => {
        (async () => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchEnvironment = elementsSearchLocation.environment!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchStage = elementsSearchLocation.stageNumber!;
          // use the first task to test connections and credentials issues
          const tasksNumber = 4;
          const result = await withCancellableNotificationProgress(
            'Fetching Endevor elements and map structure'
          )((progress, cancellationToken) => {
            // decline all other tasks if first is already unsuccessful
            const testTaskCompletionEmitter: vscode.EventEmitter<
              Error | ReadonlyArray<EnvironmentStageResponseObject> | undefined
            > = new vscode.EventEmitter();
            const testTaskCompletion = new Promise<
              Error | ReadonlyArray<EnvironmentStageResponseObject> | undefined
            >((resolve) => {
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
                })(configuration)(elementsSearchLocation);
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
                  dispatch({
                    type: Actions.ELEMENTS_FETCH_FAILED,
                    serviceId,
                    searchLocationId,
                    connection: testedConnection,
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
                    type: Actions.ELEMENTS_FETCH_FAILED,
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
                  const testedConnection: UnknownEndevorConnection = {
                    status: EndevorConnectionStatus.UNKNOWN,
                    value: connection.value,
                  };
                  const testedCredential: UnknownEndevorCredential = {
                    status: EndevorCredentialStatus.UNKNOWN,
                    value: credential.value,
                  };
                  dispatch({
                    type: Actions.ELEMENTS_FETCH_FAILED,
                    serviceId,
                    searchLocationId,
                    credential: testedCredential,
                    connection: testedConnection,
                  });
                  testTaskCompletionEmitter.fire(error);
                  return error;
                }
                testTaskCompletionEmitter.fire(taskResult);
                return taskResult;
              })(),
              (async (): Promise<ReadonlyArray<System> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  !isDefined(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const systems = await searchForSystemsFromEnvironmentStage(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration)({
                  environment: searchEnvironment,
                  stageNumber: searchStage,
                })(elementsSearchLocation.system);
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
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
                return systemStageIdToStageNumber(testResult)(systems);
              })(),
              (async (): Promise<ReadonlyArray<SubSystem> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  !isDefined(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const subsystems =
                  await searchForSubSystemsFromEnvironmentStage(
                    toSeveralTasksProgress(progress)(tasksNumber)
                  )({
                    ...connection.value,
                    credential: credential.value,
                  })(configuration)({
                    environment: searchEnvironment,
                    stageNumber: searchStage,
                  })(
                    elementsSearchLocation.system,
                    elementsSearchLocation.subsystem
                  );
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
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
                return subsystemStageIdToStageNumber(testResult)(subsystems);
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
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
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
            dispatch({
              type: Actions.ELEMENTS_FETCH_CANCELED,
              serviceId,
              searchLocationId,
            });
            resolve(undefined);
            return;
          }
          const [environmentStages, systems, subsystems, elements] = result;
          if (isError(environmentStages)) {
            resolve(undefined);
            return;
          }
          if (isError(systems) || isError(subsystems) || isError(elements)) {
            const testedConnection: UnknownEndevorConnection = {
              status: EndevorConnectionStatus.UNKNOWN,
              value: connection.value,
            };
            const testedCredential: UnknownEndevorCredential = {
              status: EndevorCredentialStatus.UNKNOWN,
              value: credential.value,
            };
            dispatch({
              type: Actions.ELEMENTS_FETCH_FAILED,
              serviceId,
              searchLocationId,
              credential: testedCredential,
              connection: testedConnection,
            });
            resolve(undefined);
            return;
          }
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
            type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
            endevorMap,
            elements: elements.reduce(
              (acc: { [id: string]: CachedElement }, element) => {
                acc[
                  toElementCompositeKey(serviceId)(searchLocationId)(element)
                ] = {
                  element,
                  lastRefreshTimestamp,
                };
                return acc;
              },
              {}
            ),
            serviceId,
            searchLocationId,
            connection: testedConnection,
            credential: testedCredential,
          });
          resolve(undefined);
          return;
        })();
      }),
    };
  };
