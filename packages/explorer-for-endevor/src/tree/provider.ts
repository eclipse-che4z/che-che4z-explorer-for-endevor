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
  CachedEndevorInventory,
  ElementFilter,
  ElementsPerRoute,
  ElementsUpTheMapFilter,
  EmptyTypesFilter,
  EndevorCacheVersion,
  EndevorConfiguration,
  EndevorId,
  EndevorServiceLocations,
} from '../store/_doc/v2/Store';
import {
  Element,
  ElementType,
  EnvironmentStage,
  EnvironmentStageResponseObject,
  ErrorResponseType,
  Service,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import { toTreeItem } from './render';
import {
  byNameOrder,
  byComplexOrder,
  formatWithNewLines,
  isDefined,
  isElementUpTheMap,
  isError,
  isUnique,
  byIsDefaultOrder,
} from '../utils';
import { Action, Actions } from '../store/_doc/Actions';
import {
  setContextVariable,
  withCancellableNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  getAllEnvironmentStagesAndLogActivity,
  searchForAllElementsAndLogActivity,
  searchForSubSystemsFromEnvironmentStageAndLogActivity,
  searchForSystemsFromEnvironmentStageAndLogActivity,
  searchForElementsInPlaceAndLogActivity,
  searchForTypesInPlaceAndLogActivity,
} from '../api/endevor';
import { reporter } from '../globals';
import { createEndevorInventory, toElementCompositeKey } from '../store/utils';
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
} from '../telemetry/_doc/Telemetry';
import {
  EndevorAuthorizedService,
  EndevorMap,
  SearchLocation,
} from '../api/_doc/Endevor';
import { toEndevorMap, toEndevorMapWithWildcards } from './endevorMap';
import {
  DEFAULT_SHOW_EMPTY_TYPES_MODE,
  DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
  TREE_VIEW_INITIALIZED_CONTEXT_NAME,
} from '../constants';
import { Source } from '../store/storage/_doc/Storage';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../logger';
import { ProgressReporter } from '@local/endevor/_doc/Progress';

type DataGetters = Readonly<{
  getServiceLocations: () => Promise<EndevorServiceLocations>;
  getElementsUpTheMapFilterValue: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => ElementsUpTheMapFilter | undefined;
  getEmptyTypesFilterValue: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => EmptyTypesFilter | undefined;
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
  getEndevorInventory: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => CachedEndevorInventory | undefined;
}>;

export const make =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >,
    dataGetters: DataGetters
  ) =>
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
            await dataGetters.getServiceLocations()
          ).sort(byComplexOrder([byIsDefaultOrder, byNameOrder]));
          sendTreeRefreshTelemetry(serviceNodes);
          return serviceNodes;
        }
        switch (node.type) {
          case 'BUTTON_ADD_SEARCH_LOCATION':
            return [];
          case 'SERVICE':
          case 'SERVICE_PROFILE': {
            const searchLocations = node.children.sort(
              byComplexOrder([byIsDefaultOrder, byNameOrder])
            );
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
            const showEmptyTypes =
              dataGetters.getEmptyTypesFilterValue(serviceId)(searchLocationId)
                ?.value ?? DEFAULT_SHOW_EMPTY_TYPES_MODE;
            const elementFilters =
              dataGetters.getAllElementFilterValues(serviceId)(
                searchLocationId
              );
            // acts like a React effect:
            //    get data from a cache (if available) and render it immediately
            //    or
            //    render with existing value (if available) and fetch the actual data from REST API with the following rerender afterwards
            let endevorCache: EndevorData | PendingTask | undefined =
              endevorCacheEffect(
                dispatch,
                getConnectionConfiguration,
                dataGetters
              )(searchForFirstFoundElements)(serviceId, searchLocationId);
            if (!isCachedData(endevorCache)) {
              await endevorCache.pendingTask;
              endevorCache = endevorCache.outdatedCacheValue;
            }
            if (
              !endevorCache?.elementsPerRoute ||
              !Object.keys(endevorCache.elementsPerRoute).length ||
              !endevorCache.endevorInventory
            ) {
              return [];
            }
            const endevorTree = buildTree(serviceId, searchLocationId)(
              endevorCache.elementsPerRoute,
              endevorCache.endevorInventory,
              elementFilters
            )({
              withElementsUpTheMap: searchForFirstFoundElements,
              showEmptyRoutes: false,
              showEmptyTypes,
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
  endevorInventory: CachedEndevorInventory | undefined;
}>;

type PendingTask = Readonly<{
  pendingTask: Promise<undefined>;
  outdatedCacheValue: EndevorData | undefined;
}>;

type InventoryResult = [
  ReadonlyArray<EnvironmentStage> | Error,
  ReadonlyArray<System> | Error,
  ReadonlyArray<SubSystem> | Error,
  ReadonlyArray<ElementType> | Error
];

const emptyInventoryResult: InventoryResult = [[], [], [], []];

const isCachedData = (
  value: PendingTask | EndevorData
): value is EndevorData => {
  return 'elementsPerRoute' in value;
};

const endevorCacheEffect =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          // TODO create AuthorizedService type to use everywhere
          service: Service & Readonly<{ configuration: EndevorConfiguration }>;
          searchLocation: SearchLocation;
        }
      | undefined
    >,
    dataGetters: DataGetters
  ) =>
  (searchForFirstFound: boolean) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): EndevorData | PendingTask => {
    const logger = createEndevorLogger({ serviceId, searchLocationId });

    const endevorInventory =
      dataGetters.getEndevorInventory(serviceId)(searchLocationId);

    const elements = (
      searchForFirstFound
        ? dataGetters.getFirstFoundElements
        : dataGetters.getElementsInPlace
    )(serviceId)(searchLocationId);
    if (elements?.cacheVersion === EndevorCacheVersion.UP_TO_DATE) {
      return {
        elementsPerRoute: elements.elementsPerRoute,
        endevorInventory,
      };
    }

    return {
      outdatedCacheValue: {
        elementsPerRoute: elements?.elementsPerRoute,
        endevorInventory,
      },
      pendingTask: new Promise((resolve) => {
        (async (): Promise<ReadonlyArray<Element> | Error | undefined> => {
          const connectionParams = await getConnectionConfiguration(
            serviceId,
            searchLocationId
          );
          if (!connectionParams) {
            resolve(undefined);
            return [];
          }
          const { service, searchLocation } = connectionParams;
          const shouldFetchInventory =
            endevorInventory?.cacheVersion !== EndevorCacheVersion.UP_TO_DATE;
          const tasksNumber = shouldFetchInventory ? 5 : 1;
          const progressTitle = `Fetching ${
            shouldFetchInventory ? 'inventory and ' : ''
          }elements ...`;
          const result = await withCancellableNotificationProgress(
            progressTitle
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
            const inventoryPromises = shouldFetchInventory
              ? endevorInventoryPromises(logger)(dispatch)(
                  progress,
                  tasksNumber
                )(serviceId, searchLocationId)(service, searchLocation)(
                  testTaskCompletionEmitter,
                  testTaskCompletion
                )(cancellationToken)
              : Promise.resolve(emptyInventoryResult);
            return Promise.all([
              inventoryPromises,
              (async (): Promise<ReadonlyArray<Element> | Error> => {
                const testResult = shouldFetchInventory
                  ? await testTaskCompletion
                  : [];
                if (
                  isError(testResult) ||
                  !isDefined(testResult) ||
                  cancellationToken?.isCancellationRequested
                ) {
                  return [];
                }
                const elementsResponse = await (searchForFirstFound
                  ? searchForAllElementsAndLogActivity
                  : searchForElementsInPlaceAndLogActivity)(
                  setLogActivityContext(dispatch, {
                    serviceId,
                    searchLocationId,
                  })
                )(toSeveralTasksProgress(progress)(tasksNumber))(service)({
                  environment: searchLocation.environment,
                  stageNumber: searchLocation.stageNumber,
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
                    `Unable to fetch elements information because of error:${formatWithNewLines(
                      errorResponse.details.messages
                    )}`
                  );
                  switch (errorResponse.type) {
                    case ErrorResponseType.CONNECTION_ERROR:
                    case ErrorResponseType.CERT_VALIDATION_ERROR: {
                      logger.errorWithDetails(
                        'Unable to connect to Endevor Web Services.',
                        `${error.message}.`
                      );
                      break;
                    }
                    case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
                    case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
                      logger.errorWithDetails(
                        'Endevor credentials are incorrect.',
                        `${error.message}.`
                      );
                      break;
                    }
                    case ErrorResponseType.GENERIC_ERROR: {
                      logger.errorWithDetails(
                        'Unable to fetch elements from Endevor.',
                        `${error.message}.`
                      );
                      break;
                    }
                    default:
                      throw new UnreachableCaseError(errorResponse.type);
                  }
                  return error;
                }
                if (
                  elementsResponse.details &&
                  elementsResponse.details.returnCode >= 4
                ) {
                  // TODO: format using all possible details
                  logger.warnWithDetails(
                    'Fetching elements finished with warnings.',
                    `Fetching elements finished with warnings:${formatWithNewLines(
                      elementsResponse.details.messages
                    )}`
                  );
                }
                const elements = elementsResponse.result;
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
          const [inventoryResult, elements] = result;
          const [environmentStages, systems, subsystems, types] =
            inventoryResult;
          if (isError(environmentStages)) {
            resolve(undefined);
            return;
          }
          if (
            isError(systems) ||
            isError(subsystems) ||
            isError(elements) ||
            isError(types)
          ) {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
              status: ElementsFetchingStatus.GENERIC_ERROR,
              elementsAmount: 0,
            });
            result.forEach((actionResult) => {
              if (isError(actionResult)) {
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.ERROR,
                  errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
                  // TODO specific statuses for each error type?
                  status: ElementsFetchingStatus.GENERIC_ERROR,
                  error: actionResult,
                });
              }
            });
            dispatch({
              type: Actions.ELEMENTS_FETCH_FAILED,
              serviceId,
              searchLocationId,
            });
            resolve(undefined);
            return;
          }
          const endevorMap = shouldFetchInventory
            ? createEndevorMap(searchLocation)(environmentStages)(systems)(
                subsystems
              )
            : undefined;
          const cachedEnvironmentStages = shouldFetchInventory
            ? createEndevorInventory(
                environmentStages,
                systems,
                subsystems,
                types
              )
            : undefined;
          const lastRefreshTimestamp = Date.now();
          dispatch({
            type: Actions.ELEMENTS_FETCHED,
            serviceId,
            searchLocationId,
            elements: elements.reduce(
              (acc: { [id: string]: CachedElement }, element) => {
                const newElementId =
                  toElementCompositeKey(serviceId)(searchLocationId)(element);
                acc[newElementId] = {
                  element,
                  elementIsUpTheMap: isElementUpTheMap(searchLocation)(element),
                  lastRefreshTimestamp,
                };
                return acc;
              },
              {}
            ),
            endevorMap,
            environmentStages: cachedEnvironmentStages,
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
  };

const createEndevorMap =
  (searchLocation: SearchLocation) =>
  (environmentStages: ReadonlyArray<EnvironmentStage>) =>
  (systems: ReadonlyArray<System>) =>
  (subsystems: ReadonlyArray<SubSystem>): EndevorMap | undefined => {
    const searchEnvironment = searchLocation.environment;
    const searchStage = searchLocation.stageNumber;
    if (
      !isDefined(searchLocation.subsystem) ||
      !isDefined(searchLocation.system)
    ) {
      return toEndevorMapWithWildcards(environmentStages)(systems)(subsystems)({
        environment: searchEnvironment,
        stageNumber: searchStage,
      });
    } else {
      return toEndevorMap(environmentStages)(systems)(subsystems)({
        environment: searchEnvironment,
        stageNumber: searchStage,
        system: searchLocation.system,
        subSystem: searchLocation.subsystem,
      });
    }
  };

const endevorInventoryPromises =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (progress: ProgressReporter, tasksNumber: number) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService, searchLocation: SearchLocation) =>
  (
    testTaskCompletionEmitter: vscode.EventEmitter<
      Error | ReadonlyArray<EnvironmentStageResponseObject> | undefined
    >,
    testTaskCompletion: Promise<
      Error | ReadonlyArray<EnvironmentStageResponseObject> | undefined
    >
  ) =>
  async (
    cancellationToken?: vscode.CancellationToken
  ): Promise<InventoryResult> => {
    const searchEnvironment = searchLocation.environment;
    const searchStage = searchLocation.stageNumber;
    const promiseResult = Promise.all([
      (async (): Promise<ReadonlyArray<EnvironmentStage> | Error> => {
        const environmentStagesResponse =
          await getAllEnvironmentStagesAndLogActivity(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
            })
          )(toSeveralTasksProgress(progress)(tasksNumber))(service)(
            searchLocation
          );
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
              logger.errorWithDetails(
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
              logger.errorWithDetails(
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
              logger.errorWithDetails(
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
          await searchForSystemsFromEnvironmentStageAndLogActivity(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
            })
          )(toSeveralTasksProgress(progress)(tasksNumber))(service)({
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
          logger.errorWithDetails(
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
        return systemStageIdToStageNumber(testResult)(systemsResponse.result);
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
          await searchForSubSystemsFromEnvironmentStageAndLogActivity(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
            })
          )(toSeveralTasksProgress(progress)(tasksNumber))(service)({
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
          logger.errorWithDetails(
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
      (async (): Promise<ReadonlyArray<ElementType> | Error> => {
        const testResult = await testTaskCompletion;
        if (
          isError(testResult) ||
          !isDefined(testResult) ||
          cancellationToken?.isCancellationRequested
        ) {
          return [];
        }
        const typesResponse = await searchForTypesInPlaceAndLogActivity(
          setLogActivityContext(dispatch, {
            serviceId,
            searchLocationId,
          })
        )(progress)(service)({
          environment: searchEnvironment,
          stageNumber: searchStage,
        })(searchLocation);
        if (cancellationToken?.isCancellationRequested) {
          return [];
        }
        if (isErrorEndevorResponse(typesResponse)) {
          const errorResponse = typesResponse;
          // TODO: format using all possible error details
          const error = new Error(
            `Unable to fetch types information because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          switch (errorResponse.type) {
            case ErrorResponseType.CONNECTION_ERROR:
            case ErrorResponseType.CERT_VALIDATION_ERROR: {
              logger.errorWithDetails(
                'Unable to connect to Endevor Web Services.',
                `${error.message}.`
              );
              break;
            }
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
              logger.errorWithDetails(
                'Endevor credentials are incorrect.',
                `${error.message}.`
              );
              break;
            }
            case ErrorResponseType.GENERIC_ERROR: {
              logger.errorWithDetails(
                'Unable to get types information from Endevor.',
                `${error.message}.`
              );
              break;
            }
            default:
              throw new UnreachableCaseError(errorResponse.type);
          }
          return error;
        }
        if (typesResponse.details && typesResponse.details.returnCode >= 4) {
          // TODO: format using all possible details
          logger.warnWithDetails(
            'Fetching types finished with warnings.',
            `Fetching types finished with warnings:${formatWithNewLines(
              typesResponse.details.messages
            )}`
          );
        }
        const types = typesResponse.result;
        return types;
      })(),
    ]);
    return promiseResult;
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
