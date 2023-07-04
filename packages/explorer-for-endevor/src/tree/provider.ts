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

import * as vscode from 'vscode';
import { LocationNodes, Node, ServiceNodes } from './_doc/ServiceLocationTree';
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
  CachedEndevorMap,
  ElementFilter,
  ElementsPerRoute,
  ElementsUpTheMapFilter,
  EndevorCacheVersion,
  EndevorConfiguration,
  EndevorConnection,
  EndevorCredential,
  EndevorId,
  EndevorServiceLocations,
} from '../store/_doc/v2/Store';
import {
  Element,
  EnvironmentStage,
  EnvironmentStageResponseObject,
  ErrorResponseType,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import { toTreeItem } from './render';
import {
  byNameOrder,
  formatWithNewLines,
  isDefined,
  isElementUpTheMap,
  isError,
  isUnique,
} from '../utils';
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
  isErrorEndevorResponse,
  subsystemStageIdToStageNumber,
  systemStageIdToStageNumber,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import {
  ElementsFetchingStatus,
  EndevorMapBuildingStatus,
  TelemetryEvents,
} from '../_doc/telemetry/Telemetry';
import { EndevorMap, SearchLocation } from '../_doc/Endevor';
import { toEndevorMap, toEndevorMapWithWildcards } from './endevorMap';
import {
  DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
  TREE_VIEW_INITIALIZED_CONTEXT_NAME,
} from '../constants';
import { Source } from '../store/storage/_doc/Storage';

type DataGetters = Readonly<{
  getServiceLocations: () => EndevorServiceLocations;
  getConnectionDetails: (
    id: EndevorId
  ) => Promise<EndevorConnection | undefined>;
  getCredential: (
    connection: EndevorConnection,
    configuration: EndevorConfiguration
  ) => (credentialId: EndevorId) => Promise<EndevorCredential | undefined>;
  getSearchLocation: (
    searchLocationId: EndevorId
  ) => Promise<SearchLocation | undefined>;
  getEndevorConfiguration: (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ) => Promise<EndevorConfiguration | undefined>;
  getElementsUpTheMapFilterValue: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => ElementsUpTheMapFilter | undefined;
  getAllElementFilterValues: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => ReadonlyArray<ElementFilter>;
  getElementsInPlace: (serviceId: EndevorId) => (
    searchLocationId: EndevorId
  ) =>
    | Readonly<{
        cacheVersion: EndevorCacheVersion;
        elementsPerRoute: ElementsPerRoute;
      }>
    | undefined;
  getFirstFoundElements: (serviceId: EndevorId) => (
    searchLocationId: EndevorId
  ) =>
    | Readonly<{
        cacheVersion: EndevorCacheVersion;
        elementsPerRoute: ElementsPerRoute;
      }>
    | undefined;
  getEndevorMap: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => CachedEndevorMap | undefined;
}>;

export const make =
  (dataGetters: DataGetters, dispatch: (action: Action) => Promise<void>) =>
  (
    treeChangeEmitter: vscode.EventEmitter<Node | null>
  ): vscode.TreeDataProvider<Node> => {
    const elmListProvider: vscode.TreeDataProvider<Node> = {
      onDidChangeTreeData: treeChangeEmitter.event,
      getTreeItem(node: Node) {
        return toTreeItem(node);
      },
      async getChildren(node?: Node) {
        if (!node) {
          setContextVariable(TREE_VIEW_INITIALIZED_CONTEXT_NAME, true);
          const serviceNodes = toServiceNodes(
            dataGetters.getServiceLocations()
          ).sort(byNameOrder);
          sendTreeRefreshTelemetry(serviceNodes);
          return serviceNodes;
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
            const searchForFirstFoundElements =
              dataGetters.getElementsUpTheMapFilterValue(serviceId)(
                searchLocationId
              )?.value ?? DEFAULT_TREE_IN_PLACE_SEARCH_MODE;
            // acts like a React effect:
            //    get data from a cache (if available) and render it immediately
            //    or
            //    render with existing value (if available) and fetch the actual data from REST API with the following rerender afterwards
            let endevorCache: EndevorData | PendingTask | undefined =
              endevorCacheEffect(
                dataGetters,
                dispatch
              )(searchForFirstFoundElements)(serviceId, searchLocationId);
            if (!isCachedData(endevorCache)) {
              await endevorCache.pendingTask;
              endevorCache = endevorCache.outdatedCacheValue;
            }
            if (
              !endevorCache?.elementsPerRoute ||
              !Object.keys(endevorCache.elementsPerRoute).length
            ) {
              return [];
            }
            const endevorTree = buildTree(
              serviceId,
              searchLocationId
            )(endevorCache.elementsPerRoute)({
              withElementsUpTheMap: searchForFirstFoundElements,
              showEmptyRoutes: false,
            }).sort(byNameOrder);
            const filteredNode = toFilteredNode(serviceId)(searchLocationId)(
              dataGetters.getAllElementFilterValues(serviceId)(searchLocationId)
            );
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

const isCachedData = (
  value: PendingTask | EndevorData
): value is EndevorData => {
  return 'elementsPerRoute' in value;
};

const endevorCacheEffect =
  (dataGetters: DataGetters, dispatch: (action: Action) => Promise<void>) =>
  (searchForFirstFound: boolean) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): EndevorData | PendingTask => {
    if (!searchForFirstFound) {
      const elements =
        dataGetters.getElementsInPlace(serviceId)(searchLocationId);
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
          (async (): Promise<ReadonlyArray<Element> | Error | undefined> => {
            const connection = await dataGetters.getConnectionDetails(
              serviceId
            );
            if (!connection) {
              resolve(undefined);
              return [];
            }
            const configuration = await dataGetters.getEndevorConfiguration(
              serviceId,
              searchLocationId
            );
            if (!configuration) {
              resolve(undefined);
              return [];
            }
            const credential = await dataGetters.getCredential(
              connection,
              configuration
            )(serviceId);
            if (!credential) {
              resolve(undefined);
              return [];
            }
            const searchLocation = await dataGetters.getSearchLocation(
              searchLocationId
            );
            if (!searchLocation) {
              resolve(undefined);
              return [];
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const searchEnvironment = searchLocation.environment!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const searchStage = searchLocation.stageNumber!;
            const elementsResponse = await withCancellableNotificationProgress(
              'Fetching elements ...'
            )((progress) =>
              searchForElementsInPlace(progress)({
                ...connection.value,
                credential: credential.value,
              })(configuration)({
                environment: searchEnvironment,
                stageNumber: searchStage,
              })(
                searchLocation.system,
                searchLocation.subsystem,
                searchLocation.type,
                searchLocation.element
              )
            );
            const operationCancelled = !elementsResponse;
            if (operationCancelled) {
              dispatch({
                type: Actions.ELEMENTS_FETCH_CANCELED,
                serviceId,
                searchLocationId,
              });
              resolve(undefined);
              return;
            }
            if (isErrorEndevorResponse(elementsResponse)) {
              const errorResponse = elementsResponse;
              // TODO: format using all possible error details
              const error = new Error(
                `Unable to fetch elements information because of error:${formatWithNewLines(
                  errorResponse.details.messages
                )}`
              );
              switch (errorResponse.type) {
                case ErrorResponseType.CONNECTION_ERROR:
                case ErrorResponseType.CERT_VALIDATION_ERROR: {
                  logger.error(
                    'Unable to connect to Endevor Web Services.',
                    `${error.message}.`
                  );
                  dispatch({
                    type: Actions.ELEMENTS_FETCH_FAILED,
                    serviceId,
                    searchLocationId,
                  });
                  break;
                }
                case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
                case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
                  logger.error(
                    'Endevor credentials are incorrect.',
                    `${error.message}.`
                  );
                  dispatch({
                    type: Actions.ELEMENTS_FETCH_FAILED,
                    serviceId,
                    searchLocationId,
                  });
                  break;
                }
                case ErrorResponseType.GENERIC_ERROR: {
                  logger.error(
                    'Unable to fetch elements from Endevor.',
                    `${error.message}.`
                  );
                  dispatch({
                    type: Actions.ELEMENTS_FETCH_FAILED,
                    serviceId,
                    searchLocationId,
                  });
                  break;
                }
                default:
                  throw new UnreachableCaseError(errorResponse.type);
              }
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                elementsAmount: 0,
              });
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                // TODO specific statuses for each error type?
                status: ElementsFetchingStatus.GENERIC_ERROR,
                error,
              });
              resolve(undefined);
              return error;
            }
            if (
              elementsResponse.details &&
              elementsResponse.details.returnCode >= 4
            ) {
              // TODO: format using all possible details
              logger.warn(
                'Fetching elements finished with warnings.',
                `Fetching elements finished with warnings:${formatWithNewLines(
                  elementsResponse.details.messages
                )}`
              );
            }
            const elements = elementsResponse.result;
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
                    elementIsUpTheMap:
                      isElementUpTheMap(searchLocation)(element),
                    lastRefreshTimestamp,
                  };
                  return acc;
                },
                {}
              ),
            });
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
              status: ElementsFetchingStatus.SUCCESS,
              elementsAmount: elements.length,
            });
            resolve(undefined);
            return;
          })();
        }),
      };
    }
    const elements =
      dataGetters.getFirstFoundElements(serviceId)(searchLocationId);
    if (elements?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
      return {
        elementsPerRoute: elements.elementsPerRoute,
      };
    }
    const elementsMap = dataGetters.getEndevorMap(serviceId)(searchLocationId);
    if (elementsMap?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
      return {
        outdatedCacheValue: {
          elementsPerRoute: elements?.elementsPerRoute,
        },
        pendingTask: new Promise((resolve) => {
          (async () => {
            const connection = await dataGetters.getConnectionDetails(
              serviceId
            );
            if (!connection) {
              resolve(undefined);
              return [];
            }
            const configuration = await dataGetters.getEndevorConfiguration(
              serviceId,
              searchLocationId
            );
            if (!configuration) {
              resolve(undefined);
              return [];
            }
            const credential = await dataGetters.getCredential(
              connection,
              configuration
            )(serviceId);
            if (!credential) {
              resolve(undefined);
              return [];
            }
            const searchLocation = await dataGetters.getSearchLocation(
              searchLocationId
            );
            if (!searchLocation) {
              resolve(undefined);
              return [];
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const searchEnvironment = searchLocation.environment!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const searchStage = searchLocation.stageNumber!;
            const elementsResponse = await withCancellableNotificationProgress(
              'Fetching elements ...'
            )((progress) =>
              searchForAllElements(progress)({
                ...connection.value,
                credential: credential.value,
              })(configuration)({
                environment: searchEnvironment,
                stageNumber: searchStage,
              })(
                searchLocation.system,
                searchLocation.subsystem,
                searchLocation.type,
                searchLocation.element
              )
            );
            const operationCancelled = !elementsResponse;
            if (operationCancelled) {
              dispatch({
                type: Actions.ELEMENTS_FETCH_CANCELED,
                serviceId,
                searchLocationId,
              });
              resolve(undefined);
              return;
            }
            if (isErrorEndevorResponse(elementsResponse)) {
              const errorResponse = elementsResponse;
              // TODO: format using all possible error details
              const error = new Error(
                `Unable to fetch elements information because of error:${formatWithNewLines(
                  errorResponse.details.messages
                )}`
              );
              dispatch({
                type: Actions.ELEMENTS_FETCH_FAILED,
                serviceId,
                searchLocationId,
              });
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                elementsAmount: 0,
              });
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                status: ElementsFetchingStatus.GENERIC_ERROR,
                error,
              });
              logger.error(
                'Unable to fetch elements from Endevor.',
                `${error.message}.`
              );
              resolve(undefined);
              return;
            }
            if (
              elementsResponse.details &&
              elementsResponse.details.returnCode >= 4
            ) {
              // TODO: format using all possible details
              logger.warn(
                'Fetching elements finished with warnings.',
                `Fetching elements finished with warnings:${formatWithNewLines(
                  elementsResponse.details.messages
                )}`
              );
            }
            const lastRefreshTimestamp = Date.now();
            dispatch({
              type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
              serviceId,
              searchLocationId,
              elements: elementsResponse.result.reduce(
                (acc: { [id: string]: CachedElement }, element) => {
                  const newElementId =
                    toElementCompositeKey(serviceId)(searchLocationId)(element);
                  acc[newElementId] = {
                    element,
                    elementIsUpTheMap:
                      isElementUpTheMap(searchLocation)(element),
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
          const connection = await dataGetters.getConnectionDetails(serviceId);
          if (!connection) {
            resolve(undefined);
            return [];
          }
          const configuration = await dataGetters.getEndevorConfiguration(
            serviceId,
            searchLocationId
          );
          if (!configuration) {
            resolve(undefined);
            return [];
          }
          const credential = await dataGetters.getCredential(
            connection,
            configuration
          )(serviceId);
          if (!credential) {
            resolve(undefined);
            return [];
          }
          const searchLocation = await dataGetters.getSearchLocation(
            searchLocationId
          );
          if (!searchLocation) {
            resolve(undefined);
            return [];
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchEnvironment = searchLocation.environment!;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const searchStage = searchLocation.stageNumber!;
          // use the first task to test connections and credentials issues
          const tasksNumber = 4;
          const result = await withCancellableNotificationProgress(
            'Fetching Endevor elements and map structure ...'
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
              (async (): Promise<ReadonlyArray<EnvironmentStage> | Error> => {
                const environmentStagesResponse = await getAllEnvironmentStages(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration)(searchLocation);
                if (cancellationToken?.isCancellationRequested) {
                  testTaskCompletionEmitter.fire(undefined);
                  return [];
                }
                if (isErrorEndevorResponse(environmentStagesResponse)) {
                  const errorResponse = environmentStagesResponse;
                  // TODO: format using all possible error details
                  const error = new Error(
                    `Unable to fetch environment stages information because of error:${formatWithNewLines(
                      errorResponse.details.messages
                    )}`
                  );
                  switch (errorResponse.type) {
                    case ErrorResponseType.CONNECTION_ERROR:
                    case ErrorResponseType.CERT_VALIDATION_ERROR:
                      logger.error(
                        'Unable to connect to Endevor Web Services.',
                        `${error.message}.`
                      );
                      dispatch({
                        type: Actions.ELEMENTS_FETCH_FAILED,
                        serviceId,
                        searchLocationId,
                      });
                      break;
                    case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
                    case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
                      logger.error(
                        'Endevor credentials are incorrect.',
                        `${error.message}.`
                      );
                      dispatch({
                        type: Actions.ELEMENTS_FETCH_FAILED,
                        serviceId,
                        searchLocationId,
                      });
                      break;
                    case ErrorResponseType.GENERIC_ERROR:
                      logger.error(
                        'Unable to fetch environment stages information from Endevor.',
                        `${error.message}.`
                      );
                      dispatch({
                        type: Actions.ELEMENTS_FETCH_FAILED,
                        serviceId,
                        searchLocationId,
                      });
                      break;
                    default:
                      throw new UnreachableCaseError(errorResponse.type);
                  }
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ERROR,
                    errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    // TODO specific statuses for each error type?
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  testTaskCompletionEmitter.fire(error);
                  return error;
                }
                // TODO report warnings
                const environmentStages = environmentStagesResponse.result;
                testTaskCompletionEmitter.fire(environmentStages);
                return environmentStages;
              })(),
              (async (): Promise<ReadonlyArray<System> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  !isDefined(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const systemsResponse =
                  await searchForSystemsFromEnvironmentStage(
                    toSeveralTasksProgress(progress)(tasksNumber)
                  )({
                    ...connection.value,
                    credential: credential.value,
                  })(configuration)({
                    environment: searchEnvironment,
                    stageNumber: searchStage,
                  })(searchLocation.system);
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
                if (isErrorEndevorResponse(systemsResponse)) {
                  const errorResponse = systemsResponse;
                  // TODO: format using all possible error details
                  const error = new Error(
                    `Unable to fetch systems information from Endevor because of error:${formatWithNewLines(
                      errorResponse.details.messages
                    )}`
                  );
                  logger.error(
                    'Unable to fetch systems information from Endevor.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ERROR,
                    errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  return error;
                }
                // TODO report warnings
                return systemStageIdToStageNumber(testResult)(
                  systemsResponse.result
                );
              })(),
              (async (): Promise<ReadonlyArray<SubSystem> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  !isDefined(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const subsystemsResponse =
                  await searchForSubSystemsFromEnvironmentStage(
                    toSeveralTasksProgress(progress)(tasksNumber)
                  )({
                    ...connection.value,
                    credential: credential.value,
                  })(configuration)({
                    environment: searchEnvironment,
                    stageNumber: searchStage,
                  })(searchLocation.system, searchLocation.subsystem);
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
                if (isErrorEndevorResponse(subsystemsResponse)) {
                  const errorResponse = subsystemsResponse;
                  // TODO: format using all possible error details
                  const error = new Error(
                    `Unable to fetch systems information from Endevor because of error:${formatWithNewLines(
                      errorResponse.details.messages
                    )}`
                  );
                  logger.error(
                    'Unable to fetch subsystems information from Endevor.',
                    `${error.message}.`
                  );
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ERROR,
                    errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
                    status: EndevorMapBuildingStatus.GENERIC_ERROR,
                    error,
                  });
                  return error;
                }
                // TODO report warnings
                return subsystemStageIdToStageNumber(testResult)(
                  subsystemsResponse.result
                );
              })(),
              (async (): Promise<ReadonlyArray<Element> | Error> => {
                const testResult = await testTaskCompletion;
                if (
                  isError(testResult) ||
                  cancellationToken?.isCancellationRequested
                )
                  return [];
                const elementsResponse = await searchForAllElements(
                  toSeveralTasksProgress(progress)(tasksNumber)
                )({
                  ...connection.value,
                  credential: credential.value,
                })(configuration)({
                  environment: searchEnvironment,
                  stageNumber: searchStage,
                })(
                  searchLocation.system,
                  searchLocation.subsystem,
                  searchLocation.type,
                  searchLocation.element
                );
                if (cancellationToken?.isCancellationRequested) {
                  return [];
                }
                if (isErrorEndevorResponse(elementsResponse)) {
                  const errorResponse = elementsResponse;
                  // TODO: format using all possible error details
                  const error = new Error(
                    `Unable to fetch elements information from Endevor because of error:${formatWithNewLines(
                      errorResponse.details.messages
                    )}`
                  );
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                    status: ElementsFetchingStatus.GENERIC_ERROR,
                    elementsAmount: 0,
                  });
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ERROR,
                    errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                    status: ElementsFetchingStatus.GENERIC_ERROR,
                    error,
                  });
                  logger.error(
                    'Unable to fetch elements from Endevor.',
                    `${error.message}.`
                  );
                  return error;
                }
                if (
                  elementsResponse.details &&
                  elementsResponse.details.returnCode >= 4
                ) {
                  // TODO: format using all possible details
                  logger.warn(
                    'Fetching elements finished with warnings.',
                    `Fetching elements finished with warnings:${formatWithNewLines(
                      elementsResponse.details.messages
                    )}`
                  );
                }
                const elements = elementsResponse.result;
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                  status: ElementsFetchingStatus.SUCCESS,
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
            dispatch({
              type: Actions.ELEMENTS_FETCH_FAILED,
              serviceId,
              searchLocationId,
            });
            resolve(undefined);
            return;
          }
          let endevorMap: EndevorMap;
          if (
            !isDefined(searchLocation.subsystem) ||
            !isDefined(searchLocation.system)
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
              system: searchLocation.system,
              subSystem: searchLocation.subsystem,
            });
          }
          const lastRefreshTimestamp = Date.now();
          dispatch({
            type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
            endevorMap,
            elements: elements.reduce(
              (acc: { [id: string]: CachedElement }, element) => {
                acc[
                  toElementCompositeKey(serviceId)(searchLocationId)(element)
                ] = {
                  element,
                  elementIsUpTheMap: isElementUpTheMap(searchLocation)(element),
                  lastRefreshTimestamp,
                };
                return acc;
              },
              {}
            ),
            serviceId,
            searchLocationId,
          });
          resolve(undefined);
          return;
        })();
      }),
    };
  };

// TODO: We can move this in the future.
// Keeping it here seems fine, since moving it to telemetry.ts or utils.ts causes circular dependencies.
// Creating its own file seemed a bit excessive.
export const sendTreeRefreshTelemetry = (serviceNodes: ServiceNodes): void => {
  let maxLocationsPerService = 0;
  let internalServices = 0;
  let syncedServices = 0;
  const syncedLocationNodes: LocationNodes = [];
  const internalLocationNodes: LocationNodes = [];
  serviceNodes.forEach((serviceNode) => {
    maxLocationsPerService =
      serviceNode.children.length > maxLocationsPerService
        ? serviceNode.children.length
        : maxLocationsPerService;
    if (serviceNode.source == Source.SYNCHRONIZED) ++syncedServices;
    else ++internalServices;
    serviceNode.children.map((location) => {
      if (location.source == Source.SYNCHRONIZED)
        syncedLocationNodes.push(location);
      else internalLocationNodes.push(location);
    });
  });
  const uniqueSyncedLocations = syncedLocationNodes
    .map((location) => location.name)
    .filter(isUnique).length;
  const uniqueInternalLocations = internalLocationNodes
    .map((location) => location.name)
    .filter(isUnique).length;
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.SERVICES_LOCATIONS_PROVIDED_INTO_TREE,
    syncedServices,
    internalServices,
    maxLocationsPerService,
    uniqueSyncedLocations,
    uniqueInternalLocations,
  });
};
