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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  Element,
  ElementSearchLocation,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { searchForElements } from '../endevor';
import { logger } from '../globals';
import { isDefined, isError, isUnique } from '../utils';
import { Action, Actions } from './_doc/Actions';
import { Node } from '../tree/_doc/ServiceLocationTree';
import { EndevorMap, toSubsystemMapPathId } from '../_doc/Endevor';
import {
  ConnectionLocations,
  Connections,
  Id,
  InventoryLocationNames,
  InventoryLocations,
  Source,
  StorageGetters,
} from './storage/_doc/Storage';
import {
  CachedElement,
  EndevorCacheItem,
  EndevorService,
  EndevorServiceLocations,
  EndevorCredential,
  EndevorSearchLocation,
  EndevorSession,
  State,
  EndevorServiceDescriptions,
  EndevorSearchLocationDescriptions,
  EndevorId,
  EndevorSearchLocationStatus,
  ValidEndevorSearchLocationDescriptions,
  ValidEndevorServiceDescriptions,
  EndevorServiceStatus,
  ValidEndevorServiceDescription,
  InvalidServiceDescription,
  ValidEndevorSearchLocationDescription,
  InvalidEndevorSearchLocationDescription,
} from './_doc/v2/Store';
import {
  normalizeSearchLocation,
  toServiceLocationCompositeKey,
  toElementCompositeKey,
  toSearchPath,
  toServiceUrl,
} from './utils';
import { toCompositeKey } from './storage/utils';

export const make =
  (storageGetters: StorageGetters) =>
  async (
    state: () => State,
    refreshTree: (node?: Node) => void,
    updateState: (state: State) => void
  ) => {
    updateState(await readLatestState(storageGetters));
    refreshTree();

    const dispatch = async (action: Action): Promise<void> => {
      switch (action.type) {
        case Actions.ENDEVOR_CREDENTIAL_ADDED: {
          updateState(
            sessionReducer(state())(action.credential.id)({
              credentials: action.credential,
            })
          );
          break;
        }
        case Actions.ENDEVOR_SERVICE_API_VERSION_ADDED: {
          updateState(
            sessionReducer(state())(action.serviceId)({
              apiVersion: action.apiVersion,
            })
          );
          break;
        }
        case Actions.ENDEVOR_CACHE_FETCHED: {
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.endevorCachedItem)
          );
          break;
        }
        case Actions.ELEMENTS_FETCHED: {
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          const lastRefreshTimestamp = Date.now();
          let elements = {};
          elements = action.elements.reduce(
            (acc: { [id: string]: CachedElement }, element) => {
              const newElementId = toElementCompositeKey(action.serviceId)(
                action.searchLocationId
              )(element);
              acc[newElementId] = {
                element,
                lastRefreshTimestamp,
              };
              return acc;
            },
            {}
          );
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: existingCache?.endevorMap,
              elements,
            })
          );
          refreshTree();
          break;
        }
        case Actions.REFRESH: {
          let actionState = state();
          Object.entries(actionState.serviceLocations).forEach(
            ([, service]) => {
              Object.entries(service.value).forEach(([, searchLocation]) => {
                actionState = endevorCacheReducer(actionState)(service.id)(
                  searchLocation.id
                )(undefined);
              });
            }
          );
          updateState(actionState);
          refreshTree();
          break;
        }
        case Actions.ELEMENT_ADDED: {
          updateState(
            updateElementReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element)
          );
          refreshTree();
          const fetchedElements = await withNotificationProgress(
            'Fetching elements'
          )((progress) =>
            searchForElements(progress)(action.service)(action.element)
          );
          if (isError(fetchedElements)) {
            const error = fetchedElements;
            logger.warn(
              'Unable to fetch the updated list of elements from Endevor.',
              `${error.message}.`
            );
            break;
          }
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          let elements = {};
          const lastRefreshTimestamp = Date.now();
          elements = fetchedElements.reduce(
            (acc: { [id: string]: CachedElement }, element) => {
              const newElementId = toElementCompositeKey(action.serviceId)(
                action.searchLocationId
              )(element);
              acc[newElementId] = {
                element,
                lastRefreshTimestamp,
              };
              return acc;
            },
            {}
          );
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: existingCache?.endevorMap,
              elements,
            })
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_GENERATED_IN_PLACE:
        case Actions.ELEMENT_UPDATED_IN_PLACE:
        case Actions.ELEMENT_SIGNED_IN: {
          updateState(
            updateElementReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element)
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_SIGNED_OUT: {
          action.elements.forEach((element) => {
            updateState(
              updateElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(element)
            );
          });
          refreshTree();
          break;
        }
        case Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP:
        case Actions.ELEMENT_GENERATED_WITH_COPY_BACK: {
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.treePath.serviceId)(
                action.treePath.searchLocationId
              )
            ];
          if (
            !existingCache ||
            !existingCache.elements ||
            !existingCache.endevorMap
          ) {
            break;
          }
          const oldElementId = toElementCompositeKey(action.treePath.serviceId)(
            action.treePath.searchLocationId
          )(action.pathUpTheMap);
          const oldELement = existingCache.elements[oldElementId];
          if (!oldELement) {
            break;
          }
          const searchLocationEntry = toSubsystemMapPathId(
            action.treePath.searchLocation
          );
          const existingRoute = existingCache.endevorMap[searchLocationEntry];
          if (!existingRoute) {
            break;
          }
          const treeLocation = [searchLocationEntry, ...existingRoute].find(
            (route) => route === toSubsystemMapPathId(action.targetLocation)
          );
          if (!treeLocation) {
            break;
          }
          const {
            [oldElementId]: matchingCashedElement,
            ...existingCachedElements
          } = existingCache.elements;
          const newElement: Element = {
            ...action.targetLocation,
            extension: oldELement.element.extension,
            name: oldELement.element.name,
          };
          let elements = {
            ...existingCachedElements,
            [toElementCompositeKey(action.treePath.serviceId)(
              action.treePath.searchLocationId
            )(newElement)]: {
              element: newElement,
              lastRefreshTimestamp: Date.now(),
            },
          };
          updateState(
            endevorCacheReducer(state())(action.treePath.serviceId)(
              action.treePath.searchLocationId
            )({
              endevorMap: existingCache.endevorMap,
              elements,
            })
          );
          refreshTree();
          const fetchedElements = await withNotificationProgress(
            'Fetching elements'
          )((progress) =>
            searchForElements(progress)(action.fetchElementsArgs.service)(
              action.fetchElementsArgs.searchLocation
            )
          );
          if (isError(fetchedElements)) {
            const error = fetchedElements;
            logger.warn(
              'Unable to fetch the updated list of elements from Endevor.',
              `${error.message}.`
            );
            break;
          }
          elements = {};
          const lastRefreshTimestamp = Date.now();
          elements = fetchedElements.reduce(
            (acc: { [id: string]: CachedElement }, element) => {
              const newElementId = toElementCompositeKey(
                action.treePath.serviceId
              )(action.treePath.searchLocationId)(element);
              acc[newElementId] = {
                element,
                lastRefreshTimestamp,
              };
              return acc;
            },
            {}
          );
          updateState(
            endevorCacheReducer(state())(action.treePath.serviceId)(
              action.treePath.searchLocationId
            )({
              endevorMap: existingCache?.endevorMap,
              elements,
            })
          );
          refreshTree();
          break;
        }
        case Actions.ENDEVOR_SERVICE_HIDDEN: {
          updateState(
            removeServiceLocationReducer(state())(action.serviceId)()
          );
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SERVICE_DELETED: {
          updateState(
            removeServiceLocationReducer(state())(action.serviceId)()
          );
          updateState(removeServiceReducer(state())(action.serviceId));
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SERVICE_ADDED: {
          updateState(addServiceLocationReducer(state())(action.serviceId)());
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SERVICE_CREATED: {
          updateState(
            createServiceReducer(state())(
              {
                value: action.service.value,
                id: action.service.id,
              },
              action.service.credential
            )
          );
          updateState(addServiceLocationReducer(state())(action.service.id)());
          if (action.service.apiVersion) {
            updateState(
              sessionReducer(state())(action.service.id)({
                apiVersion: action.service.apiVersion,
              })
            );
          }
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SEARCH_LOCATION_CREATED: {
          updateState(
            createSearchLocationReducer(state())(action.searchLocation)
          );
          updateState(
            addServiceLocationReducer(state())(action.serviceId)(
              action.searchLocation.id
            )
          );
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SEARCH_LOCATION_ADDED: {
          updateState(
            addServiceLocationReducer(state())(action.serviceId)(
              action.searchLocationId
            )
          );
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SEARCH_LOCATION_HIDDEN: {
          updateState(
            removeServiceLocationReducer(state())(action.serviceId)(
              action.searchLocationId
            )
          );
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_SEARCH_LOCATION_DELETED: {
          Object.entries(state().serviceLocations).forEach(
            ([, serviceLocation]) => {
              updateState(
                removeServiceLocationReducer(state())(serviceLocation.id)(
                  action.searchLocationId
                )
              );
              updateState(
                removeSearchLocationReducer(state())(action.searchLocationId)
              );
            }
          );
          refreshTree();
          persistState(storageGetters)(state());
          break;
        }
        case Actions.ENDEVOR_MAP_BUILT: {
          if (!Object.keys(action.endevorMap).length) break;
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: action.endevorMap,
              elements: existingCache?.elements,
            })
          );
          break;
        }
        default:
          throw new UnreachableCaseError(action);
      }
    };
    return dispatch;
  };

const readLatestState = async (
  storageGetters: StorageGetters
): Promise<State> => {
  const state: State = {
    caches: {},
    services: {},
    sessions: {},
    searchLocations: {},
    serviceLocations: {},
  };
  const inventoryLocations = await storageGetters
    .getInventoryLocationsStorage()
    .get();
  if (isError(inventoryLocations)) {
    const error = inventoryLocations;
    logger.warn(
      'Unable to read the inventory locations from the extension storage.',
      `Unable to read the inventory locations from the extension storage because of ${error.message}.`
    );
  } else {
    state.searchLocations = inventoryLocations;
  }
  const connections = await storageGetters.getConnectionsStorage().get();
  if (isError(connections)) {
    const error = connections;
    logger.warn(
      'Unable to read the connections from the extension storage.',
      `Unable to read the connections from the extension storage because of ${error.message}.`
    );
  } else {
    state.services = connections;
  }
  if (!isError(connections) && !isError(inventoryLocations)) {
    const connectionLocations = await storageGetters
      .getConnectionLocationsStorage()
      .get();
    if (isError(connectionLocations)) {
      const error = connectionLocations;
      logger.warn(
        'Unable to read the connection locations from the extension storage.',
        `Unable to read the connection locations from the extension storage because of ${error.message}.`
      );
    } else {
      state.serviceLocations = connectionLocations;
    }
  }
  if (!isError(connections)) {
    for (const [name, connection] of Object.entries(connections)) {
      if (isDefined(connection)) {
        const credential = await storageGetters
          .getCredentialsStorage()
          .get(connection.id);
        if (isError(credential)) {
          const error = credential;
          logger.trace(
            `Unable to read the credentials for the service ${name} the extension storage because of ${error.message}.`
          );
        }
        if (!isError(credential) && isDefined(credential)) {
          state.services[name] = {
            ...connection,
            credential,
          };
        }
      }
    }
  }
  return state;
};

const persistState =
  (storageGetters: StorageGetters) => async (state: State) => {
    const updateInventoryLocationsResult = await storageGetters
      .getInventoryLocationsStorage()
      .store(
        Object.entries(state.searchLocations).reduce(
          (acc: InventoryLocations, [searchLocationKey, searchLocation]) => {
            if (!searchLocation) return acc;
            acc[searchLocationKey] = searchLocation;
            return acc;
          },
          {}
        )
      );
    if (isError(updateInventoryLocationsResult)) {
      const error = updateInventoryLocationsResult;
      logger.warn(
        'Unable to persist the inventory locations into the extension storage.',
        `Unable to persist the inventory locations into the extension storage because of ${error.message}.`
      );
    }
    const updateConnectionsResult = await storageGetters
      .getConnectionsStorage()
      .store(
        Object.entries(state.services).reduce(
          (acc: Connections, [serviceKey, service]) => {
            if (!service) return acc;
            acc[serviceKey] = service;
            return acc;
          },
          {}
        )
      );
    if (isError(updateConnectionsResult)) {
      const error = updateConnectionsResult;
      logger.warn(
        'Unable to persist the connections into the extension storage.',
        `Unable to persist the connections into the extension storage because of ${error.message}.`
      );
    }
    if (
      !isError(updateConnectionsResult) &&
      !isError(updateInventoryLocationsResult)
    ) {
      const updateConnectionLocationsResult = await storageGetters
        .getConnectionLocationsStorage()
        .store(state.serviceLocations);
      if (isError(updateConnectionLocationsResult)) {
        const error = updateConnectionLocationsResult;
        logger.warn(
          'Unable to persist the connection locations into the extension storage.',
          `Unable to persist the connection locations into the extension storage because of ${error.message}.`
        );
      }
    }
    if (!isError(updateConnectionsResult)) {
      for (const [connectionName, value] of Object.entries(state.services)) {
        if (value && value.credential) {
          const result = await storageGetters
            .getCredentialsStorage()
            .store(value.id, value.credential);
          if (isError(result)) {
            const error = result;
            logger.warn(
              `Unable to update credentials with name ${connectionName}`,
              `Unable to update credentials with name ${connectionName} because of ${error.message}.`
            );
          }
          continue;
        }
        const result = await storageGetters
          .getCredentialsStorage()
          .delete(connectionName);
        if (isError(result)) {
          const error = result;
          logger.trace(
            `Unable to update credentials with name ${connectionName} because of ${error.message}.`
          );
        }
      }
    }
  };

const sessionReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (updatedSession: EndevorSession | undefined): State => {
    const serviceKey = toCompositeKey(serviceId);
    const existingService = initialState.services[serviceKey];
    if (!existingService && updatedSession) {
      return initialState;
    }
    return {
      ...initialState,
      sessions: {
        ...initialState.sessions,
        [serviceKey]: {
          ...initialState.sessions[serviceKey],
          ...updatedSession,
        },
      },
    };
  };

const removeServiceReducer =
  (initialState: State) =>
  (serviceId: EndevorId): State => {
    const serviceKey = toCompositeKey(serviceId);
    const existingService = initialState.services[serviceKey];
    if (!existingService) {
      return initialState;
    }
    return {
      ...initialState,
      sessions: {
        ...initialState.sessions,
        [serviceKey]: undefined,
      },
      services: {
        ...initialState.services,
        [serviceKey]: undefined,
      },
    };
  };

const createServiceReducer =
  (initialState: State) =>
  (service: EndevorService, credentials?: EndevorCredential): State => {
    const serviceKey = toCompositeKey(service.id);
    const existingItem = initialState.services[serviceKey];
    if (existingItem) {
      return initialState;
    }
    return {
      ...initialState,
      services: {
        ...initialState.services,
        [serviceKey]: { ...service, credential: credentials },
      },
    };
  };

const removeServiceLocationReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId?: EndevorId): State => {
    const serviceKey = toCompositeKey(serviceId);
    const existingLocations = initialState.serviceLocations[serviceKey];
    if (!existingLocations) {
      return initialState;
    }
    if (
      searchLocationId &&
      !Object.keys(existingLocations.value).includes(
        toCompositeKey(searchLocationId)
      )
    ) {
      return initialState;
    }
    if (!searchLocationId) {
      const updatedCache = {
        ...initialState.caches,
      };
      Object.values(existingLocations.value).forEach((searchLocation) => {
        updatedCache[
          toServiceLocationCompositeKey(serviceId)(searchLocation.id)
        ] = undefined;
      });
      return {
        ...initialState,
        caches: updatedCache,
        serviceLocations: Object.entries(initialState.serviceLocations).reduce(
          (acc: ConnectionLocations, [serviceKey, serviceLocation]) => {
            if (serviceKey === toCompositeKey(serviceId)) return acc;
            acc[serviceKey] = serviceLocation;
            return acc;
          },
          {}
        ),
      };
    }
    const updatedCache = {
      ...initialState.caches,
      [toServiceLocationCompositeKey(serviceId)(searchLocationId)]: undefined,
    };
    return {
      ...initialState,
      caches: updatedCache,
      serviceLocations: {
        ...initialState.serviceLocations,
        [serviceKey]: {
          id: existingLocations.id,
          value: Object.entries(existingLocations.value).reduce(
            (
              acc: InventoryLocationNames,
              [searchLocationKey, searchLocation]
            ) => {
              if (searchLocationKey === toCompositeKey(searchLocationId))
                return acc;
              acc[searchLocationKey] = searchLocation;
              return acc;
            },
            {}
          ),
        },
      },
    };
  };

const addServiceLocationReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId?: EndevorId): State => {
    const serviceKey = toCompositeKey(serviceId);
    const existingItem = initialState.serviceLocations[serviceKey];
    if (!existingItem) {
      return {
        ...initialState,
        serviceLocations: {
          ...initialState.serviceLocations,
          [serviceKey]: {
            value: searchLocationId
              ? {
                  [toCompositeKey(searchLocationId)]: {
                    id: searchLocationId,
                  },
                }
              : {},
            id: serviceId,
          },
        },
      };
    }
    if (!searchLocationId) {
      return initialState;
    }
    if (
      !Object.keys(existingItem.value).includes(
        toCompositeKey(searchLocationId)
      )
    ) {
      return {
        ...initialState,
        serviceLocations: {
          ...initialState.serviceLocations,
          [serviceKey]: {
            ...existingItem,
            value: {
              ...existingItem.value,
              [toCompositeKey(searchLocationId)]: {
                id: searchLocationId,
              },
            },
          },
        },
      };
    }
    return initialState;
  };

const removeSearchLocationReducer =
  (initialState: State) =>
  (searchLocationId: EndevorId): State => {
    const searchLocationKey = toCompositeKey(searchLocationId);
    const existingSearchLocation =
      initialState.searchLocations[searchLocationKey];
    if (!existingSearchLocation) {
      return initialState;
    }
    return {
      ...initialState,
      searchLocations: {
        ...initialState.searchLocations,
        [searchLocationKey]: undefined,
      },
    };
  };

const createSearchLocationReducer =
  (initialState: State) =>
  (searchLocation: EndevorSearchLocation): State => {
    const searchLocationKey = toCompositeKey(searchLocation.id);
    const existingItem = initialState.searchLocations[searchLocationKey];
    if (existingItem) {
      return initialState;
    }
    return {
      ...initialState,
      searchLocations: {
        ...initialState.searchLocations,
        [searchLocationKey]: searchLocation,
      },
    };
  };

const endevorCacheReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (updatedCache: EndevorCacheItem | undefined): State => {
    const existingService =
      initialState.serviceLocations[toCompositeKey(serviceId)];
    if (!existingService) return initialState;
    if (!initialState.services[toCompositeKey(serviceId)]) return initialState;
    if (
      !Object.keys(existingService.value).includes(
        toCompositeKey(searchLocationId)
      )
    ) {
      return initialState;
    }
    if (!initialState.searchLocations[toCompositeKey(searchLocationId)])
      return initialState;
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [toServiceLocationCompositeKey(serviceId)(searchLocationId)]:
          updatedCache,
      },
    };
  };

const updateElementReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: Element): State => {
    const existingService =
      initialState.serviceLocations[toCompositeKey(serviceId)];
    if (!existingService) return initialState;
    if (!initialState.services[toCompositeKey(serviceId)]) return initialState;
    if (
      !Object.keys(existingService.value).includes(
        toCompositeKey(searchLocationId)
      )
    ) {
      return initialState;
    }
    if (!initialState.searchLocations[toCompositeKey(searchLocationId)])
      return initialState;
    const existingCache =
      initialState.caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [toServiceLocationCompositeKey(serviceId)(searchLocationId)]: {
          endevorMap: existingCache?.endevorMap
            ? existingCache.endevorMap
            : undefined,
          elements: {
            ...(existingCache?.elements ? existingCache.elements : {}),
            [toElementCompositeKey(serviceId)(searchLocationId)(element)]: {
              element,
              lastRefreshTimestamp: Date.now(),
            },
          },
        },
      },
    };
  };

// public API

export const getAllServiceNames = (
  state: () => State
): ReadonlyArray<string> => {
  return [
    ...Object.values(state().services)
      .filter(isDefined)
      .map((value) => value.id.name),
    ...Object.values(state().serviceLocations).map((value) => value.id.name),
  ].filter(isUnique);
};

export const getService =
  (state: () => State) =>
  (serviceId: EndevorId): EndevorService | undefined => {
    return state().services[toCompositeKey(serviceId)];
  };

export const getAllServiceDescriptions = (
  state: () => State
): EndevorServiceDescriptions => {
  return Object.entries(state().serviceLocations).reduce(
    (acc: EndevorServiceDescriptions, [serviceKey, serviceLocationValue]) => {
      const service = state().services[serviceKey];
      if (service) {
        acc[serviceKey] = toValidServiceDescription(state)(service);
        return acc;
      }
      acc[serviceKey] = toInvalidServiceDescription(state)(
        serviceLocationValue.id
      );
      return acc;
    },
    {}
  );
};

const toValidServiceDescription =
  (state: () => State) =>
  (endevorService: EndevorService): ValidEndevorServiceDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== endevorService.id.source)
        // workaround for ridicilous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().services[
              toCompositeKey({ name: endevorService.id.name, source })
            ] ||
            state().serviceLocations[
              toCompositeKey({ name: endevorService.id.name, source })
            ]
          );
        }).length >= 1;
    return {
      id: endevorService.id,
      status: EndevorServiceStatus.VALID,
      duplicated,
      url: toServiceUrl(
        endevorService.value.location,
        endevorService.credential?.value
      ),
    };
  };

const toInvalidServiceDescription =
  (state: () => State) =>
  (serviceId: Id): InvalidServiceDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== serviceId.source)
        // workaround for ridicilous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().services[
              toCompositeKey({ name: serviceId.name, source })
            ] ||
            state().serviceLocations[
              toCompositeKey({ name: serviceId.name, source })
            ]
          );
        }).length >= 1;
    return {
      id: serviceId,
      status: EndevorServiceStatus.INVALID,
      duplicated,
    };
  };

const toValidLocationDescription =
  (state: () => State) =>
  (
    endevorSearchLocation: EndevorSearchLocation
  ): ValidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== endevorSearchLocation.id.source)
        // workaround for ridicilous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().searchLocations[
              toCompositeKey({ name: endevorSearchLocation.id.name, source })
            ] ||
            Object.values(state().serviceLocations)
              .flatMap((value) => Object.keys(value.value))
              .find(
                (value) =>
                  toCompositeKey({
                    name: endevorSearchLocation.id.name,
                    source,
                  }) === value
              )
          );
        }).length >= 1;
    return {
      id: endevorSearchLocation.id,
      duplicated,
      status: EndevorSearchLocationStatus.VALID,
      path: toSearchPath(endevorSearchLocation.value) + '',
    };
  };

const toInvalidLocationDescription =
  (state: () => State) =>
  (locationId: Id): InvalidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== locationId.source)
        // workaround for ridicilous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().searchLocations[
              toCompositeKey({ name: locationId.name, source })
            ] ||
            Object.values(state().serviceLocations)
              .flatMap((value) => Object.keys(value.value))
              .find(
                (value) =>
                  toCompositeKey({
                    name: locationId.name,
                    source,
                  }) === value
              )
          );
        }).length >= 1;
    return {
      id: locationId,
      status: EndevorSearchLocationStatus.INVALID,
      duplicated,
    };
  };

export const getValidUnusedServiceDescriptions = (
  state: () => State
): ValidEndevorServiceDescriptions => {
  const usedServices = Object.keys(state().serviceLocations);
  return Object.entries(state().services)
    .filter(([serviceKey]) => !usedServices.includes(serviceKey))
    .reduce((acc: ValidEndevorServiceDescriptions, [serviceKey, service]) => {
      if (!service) return acc;
      acc[serviceKey] = toValidServiceDescription(state)(service);
      return acc;
    }, {});
};

export const getValidServiceDescriptionsBySearchLocationId =
  (state: () => State) =>
  (searchLocationId: EndevorId): ValidEndevorServiceDescriptions => {
    return Object.entries(state().serviceLocations)
      .filter(([, value]) => value.value[toCompositeKey(searchLocationId)])
      .reduce((acc: ValidEndevorServiceDescriptions, [serviceKey]) => {
        const service = state().services[serviceKey];
        if (service) {
          acc[serviceKey] = toValidServiceDescription(state)(service);
          return acc;
        }
        return acc;
      }, {});
  };

export const getAllServiceDescriptionsBySearchLocationId =
  (state: () => State) =>
  (searchLocationId: EndevorId): EndevorServiceDescriptions => {
    return Object.entries(state().serviceLocations)
      .filter(([, value]) => value.value[toCompositeKey(searchLocationId)])
      .reduce((acc: EndevorServiceDescriptions, [serviceKey, value]) => {
        const service = state().services[serviceKey];
        if (service) {
          acc[serviceKey] = toValidServiceDescription(state)(service);
          return acc;
        }
        acc[serviceKey] = toInvalidServiceDescription(state)(value.id);
        return acc;
      }, {});
  };

export const getApiVersion =
  (state: () => State) =>
  (serviceId: EndevorId): ServiceApiVersion | undefined => {
    return state().sessions[toCompositeKey(serviceId)]?.apiVersion;
  };

export const getCredential =
  (state: () => State) =>
  (serviceId: EndevorId): EndevorCredential | undefined => {
    return (
      state().sessions[toCompositeKey(serviceId)]?.credentials ||
      state().services[toCompositeKey(serviceId)]?.credential
    );
  };

export const getAllServiceLocations = (
  state: () => State
): EndevorServiceLocations => {
  return Object.entries(state().serviceLocations).reduce(
    (acc: EndevorServiceLocations, [serviceKey, serviceLocation]) => {
      const service = state().services[serviceKey];
      if (service) {
        const serviceDescription = toValidServiceDescription(state)(service);
        acc[serviceKey] = {
          ...serviceDescription,
          url: toServiceUrl(service.value.location, service.credential?.value),
          value: Object.entries(serviceLocation.value).reduce(
            (
              acc: EndevorSearchLocationDescriptions,
              [searchLocationKey, searchLocationValue]
            ) => {
              const searchLocation = state().searchLocations[searchLocationKey];
              acc[searchLocationKey] = searchLocation
                ? toValidLocationDescription(state)(searchLocation)
                : toInvalidLocationDescription(state)(searchLocationValue.id);
              return acc;
            },
            {}
          ),
        };
        return acc;
      }
      const serviceDescription = toInvalidServiceDescription(state)(
        serviceLocation.id
      );
      acc[serviceKey] = {
        ...serviceDescription,
        value: Object.entries(serviceLocation.value).reduce(
          (
            acc: EndevorSearchLocationDescriptions,
            [searchLocationKey, searchLocationValue]
          ) => {
            const searchLocation = state().searchLocations[searchLocationKey];
            acc[searchLocationKey] = searchLocation
              ? toValidLocationDescription(state)(searchLocation)
              : toInvalidLocationDescription(state)(searchLocationValue.id);
            return acc;
          },
          {}
        ),
      };
      return acc;
    },
    {}
  );
};

export const getAllSearchLocationNames = (
  state: () => State
): ReadonlyArray<string> => {
  return [
    ...Object.values(state().searchLocations)
      .filter(isDefined)
      .map((value) => value.id.name),
    ...Object.values(state().serviceLocations)
      .flatMap((value) => Object.values(value.value))
      .map((value) => value.id.name),
  ].filter(isUnique);
};

export const getSearchLocation =
  (state: () => State) =>
  (searchLocationId: EndevorId): ElementSearchLocation | undefined => {
    const inventoryLocation =
      state().searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return;
    }
    return normalizeSearchLocation(inventoryLocation.value);
  };

export const getAllSearchLocationDescriptions = (
  state: () => State
): EndevorSearchLocationDescriptions => {
  return Object.values(state().serviceLocations)
    .flatMap((value) => Object.entries(value.value))
    .reduce(
      (
        acc: EndevorSearchLocationDescriptions,
        [searchLocationKey, searchLocationValue]
      ) => {
        const searchLocation = state().searchLocations[searchLocationKey];
        acc[searchLocationKey] = searchLocation
          ? toValidLocationDescription(state)(searchLocation)
          : toInvalidLocationDescription(state)(searchLocationValue.id);
        return acc;
      },
      {}
    );
};

export const getValidUnusedSearchLocationDescriptionsForService =
  (state: () => State) =>
  (serviceId: EndevorId): ValidEndevorSearchLocationDescriptions => {
    const serviceSearchLocationKeys = Object.keys(
      state().serviceLocations[toCompositeKey(serviceId)]?.value || {}
    );
    return Object.entries(state().searchLocations)
      .filter(
        ([locationKey]) => !serviceSearchLocationKeys.includes(locationKey)
      )
      .reduce(
        (
          acc: ValidEndevorSearchLocationDescriptions,
          [searchLocationKey, searchLocation]
        ) => {
          if (!isDefined(searchLocation)) return acc;
          acc[searchLocationKey] =
            toValidLocationDescription(state)(searchLocation);
          return acc;
        },
        {}
      );
  };

export const getElements =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ReadonlyArray<CachedElement> | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache || !cache.elements) {
      return undefined;
    }
    return Object.values(cache.elements);
  };

export const getEndevorMap =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): EndevorMap | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (cache && cache.endevorMap) {
      return cache.endevorMap;
    }
    return;
  };

export const getEndevorCache =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): EndevorCacheItem | undefined => {
    return state().caches[
      toServiceLocationCompositeKey(serviceId)(searchLocationId)
    ];
  };
