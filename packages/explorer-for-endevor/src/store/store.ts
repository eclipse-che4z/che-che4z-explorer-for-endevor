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
import { searchForAllElements } from '../endevor';
import { logger } from '../globals';
import { isDefined, isError, isUnique } from '../utils';
import { Action, Actions } from './_doc/Actions';
import { Node } from '../tree/_doc/ServiceLocationTree';
import { EndevorMap, toSubsystemMapPathId } from '../_doc/Endevor';
import {
  ConnectionLocations,
  Connections,
  Credential,
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
  EndevorSearchLocation,
  EndevorSession,
  State,
  EndevorServiceDescriptions,
  EndevorSearchLocationDescriptions,
  EndevorId,
  EndevorSearchLocationStatus,
  ValidEndevorSearchLocationDescriptions,
  ExistingEndevorServiceDescriptions,
  EndevorServiceStatus,
  InvalidEndevorServiceDescription,
  ValidEndevorSearchLocationDescription,
  InvalidEndevorSearchLocationDescription,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorConfiguration,
  EndevorCredentialStatus,
  EndevorCredential,
  NonExistingServiceDescription,
  ValidEndevorServiceDescription,
  ValidEndevorConnection,
  EndevorServices,
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
        case Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED: {
          const serviceKey = toCompositeKey(action.sessionId);
          const persistedConnection = state().services[serviceKey]?.value;
          const sessionConnection = state().sessions[serviceKey]?.connection;
          const anyApiVersion = ServiceApiVersion.V2;
          let connection: ValidEndevorConnection | undefined = undefined;
          if (sessionConnection) {
            connection = {
              status: EndevorConnectionStatus.VALID,
              value: {
                ...sessionConnection.value,
                apiVersion: anyApiVersion,
              },
            };
          } else if (persistedConnection) {
            connection = {
              status: EndevorConnectionStatus.VALID,
              value: {
                ...persistedConnection,
                apiVersion: anyApiVersion,
              },
            };
          } else {
            break;
          }
          if (!connection) break;

          updateState(
            sessionReducer(state())(action.sessionId)({
              credentials: action.credential,
              connection,
            })
          );
          refreshTree();
          break;
        }
        case Actions.SESSION_ENDEVOR_CONNECTION_ADDED: {
          updateState(
            sessionReducer(state())(action.sessionId)({
              connection: action.connection,
            })
          );
          refreshTree();
          break;
        }
        case Actions.ENDEVOR_CONNECTION_TESTED: {
          const serviceKey = toCompositeKey(action.connectionId);
          const persistedConnection = state().services[serviceKey]?.value;
          const sessionConnection = state().sessions[serviceKey]?.connection;
          if (sessionConnection) {
            if (action.status.status === EndevorConnectionStatus.VALID) {
              updateState(
                sessionReducer(state())(action.connectionId)({
                  connection: {
                    status: action.status.status,
                    value: {
                      ...sessionConnection.value,
                      apiVersion: action.status.apiVersion,
                    },
                  },
                })
              );
            } else {
              updateState(
                sessionReducer(state())(action.connectionId)({
                  connection: {
                    status: action.status.status,
                    value: sessionConnection.value,
                  },
                })
              );
            }
            refreshTree();
            break;
          }
          if (persistedConnection) {
            if (action.status.status === EndevorConnectionStatus.VALID) {
              updateState(
                sessionReducer(state())(action.connectionId)({
                  connection: {
                    status: action.status.status,
                    value: {
                      ...persistedConnection,
                      apiVersion: action.status.apiVersion,
                    },
                  },
                })
              );
            } else {
              updateState(
                sessionReducer(state())(action.connectionId)({
                  connection: {
                    status: action.status.status,
                    value: persistedConnection,
                  },
                })
              );
            }
            refreshTree();
            break;
          }
          break;
        }
        case Actions.ENDEVOR_CREDENTIAL_TESTED: {
          const serviceKey = toCompositeKey(action.credentialId);
          const persistedConnection = state().services[serviceKey]?.value;
          const sessionConnection = state().sessions[serviceKey]?.connection;
          const anyApiVersion = ServiceApiVersion.V2;
          let connection: ValidEndevorConnection | undefined = undefined;
          if (sessionConnection) {
            connection = {
              status: EndevorConnectionStatus.VALID,
              value: {
                ...sessionConnection.value,
                apiVersion: anyApiVersion,
              },
            };
          } else if (persistedConnection) {
            connection = {
              status: EndevorConnectionStatus.VALID,
              value: {
                ...persistedConnection,
                apiVersion: anyApiVersion,
              },
            };
          } else {
            break;
          }
          if (!connection) break;

          const persistedCredential = state().services[serviceKey]?.credential;
          const sessionCredential = state().sessions[serviceKey]?.credentials;
          if (sessionCredential) {
            updateState(
              sessionReducer(state())(action.credentialId)({
                credentials: {
                  status: action.status,
                  value: sessionCredential.value,
                },
                connection,
              })
            );
            refreshTree();
            break;
          }
          if (persistedCredential) {
            updateState(
              sessionReducer(state())(action.credentialId)({
                credentials: {
                  status: action.status,
                  value: persistedCredential.value,
                },
                connection,
              })
            );
            refreshTree();
            break;
          }
          break;
        }
        case Actions.ENDEVOR_CACHE_FETCHED: {
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.endevorCachedItem)
          );
          updateState(
            sessionReducer(state())(action.serviceId)({
              connection: action.connection,
              credentials: action.credential,
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
          const searchLocation =
            state().searchLocations[toCompositeKey(action.searchLocationId)];
          if (!searchLocation) break;
          const session = state().sessions[toCompositeKey(action.serviceId)];
          if (!session || !session.connection || !session.credentials) break;
          const service = {
            credential: session.credentials.value,
            location: session.connection.value.location,
            rejectUnauthorized: session.connection.value.rejectUnauthorized,
          };
          updateState(
            updateElementReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element)
          );
          refreshTree();
          const fetchedElements = await withNotificationProgress(
            'Fetching elements'
          )((progress) => {
            return searchForAllElements(progress)(service)(
              searchLocation.value
            );
          });
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
          const searchLocation =
            state().searchLocations[
              toCompositeKey(action.treePath.searchLocationId)
            ];
          if (!searchLocation) break;
          const session =
            state().sessions[toCompositeKey(action.treePath.serviceId)];
          if (!session || !session.connection || !session.credentials) break;
          const service = {
            credential: session.credentials.value,
            location: session.connection.value.location,
            rejectUnauthorized: session.connection.value.rejectUnauthorized,
          };
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
            searchForAllElements(progress)(service)(searchLocation.value)
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
          if (
            action.connectionStatus.status === EndevorConnectionStatus.VALID
          ) {
            updateState(
              sessionReducer(state())(action.service.id)({
                connection: {
                  status: action.connectionStatus.status,
                  value: {
                    ...action.service.value,
                    apiVersion: action.connectionStatus.apiVersion,
                  },
                },
              })
            );
          }
          if (
            action.connectionStatus.status === EndevorConnectionStatus.INVALID
          ) {
            updateState(
              sessionReducer(state())(action.service.id)({
                connection: {
                  status: action.connectionStatus.status,
                  value: action.service.value,
                },
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
  (service: EndevorService, credentials?: Credential): State => {
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

export const getEndevorConnectionDetails =
  (state: () => State) =>
  (serviceId: EndevorId): EndevorConnection | undefined => {
    const serviceKey = toCompositeKey(serviceId);
    const sessionConnectionDetails = state().sessions[serviceKey]?.connection;
    if (sessionConnectionDetails) return sessionConnectionDetails;
    const persistentConnectionDetails = state().services[serviceKey]?.value;
    if (!persistentConnectionDetails) return;
    return {
      status: EndevorConnectionStatus.UNKNOWN,
      value: persistentConnectionDetails,
    };
  };

export const getCredential =
  (state: () => State) =>
  (serviceId: EndevorId): EndevorCredential | undefined => {
    const sessionCredential =
      state().sessions[toCompositeKey(serviceId)]?.credentials;
    if (sessionCredential) {
      return sessionCredential;
    }
    const persistentCredential =
      state().services[toCompositeKey(serviceId)]?.credential;
    if (!persistentCredential) return;
    return {
      status: EndevorCredentialStatus.UNKNOWN,
      value: persistentCredential.value,
    };
  };

export const getAllServiceDescriptions = (
  state: () => State
): EndevorServiceDescriptions => {
  return Object.entries(state().serviceLocations).reduce(
    (acc: EndevorServiceDescriptions, [serviceKey, serviceLocationValue]) => {
      const service = state().services[serviceKey];
      if (!service) {
        acc[serviceKey] = toNonExistingServiceDescription(state)(
          serviceLocationValue.id
        );
        return acc;
      }
      const sessionDetails = state().sessions[serviceKey];
      if (
        !sessionDetails?.connection ||
        sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.connection.status === EndevorConnectionStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        !sessionDetails.credentials ||
        sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownCredentialServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidCredentialServiceDescription(state)(service);
        return acc;
      }
      acc[serviceKey] = toValidServiceDescription(state)(service);
      return acc;
    },
    {}
  );
};

const toValidServiceDescription =
  (state: () => State) =>
  (endevorService: EndevorService): ValidEndevorServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(endevorService.id);
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

const isDuplicatedService =
  (services: EndevorServices, serviceLocations: ConnectionLocations) =>
  (endevorId: EndevorId): boolean => {
    return (
      Object.values(Source)
        .filter((source) => source !== endevorId.source)
        // workaround for ridiculous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            services[toCompositeKey({ name: endevorId.name, source })] ||
            serviceLocations[toCompositeKey({ name: endevorId.name, source })]
          );
        }).length >= 1
    );
  };

const toNonExistingServiceDescription =
  (state: () => State) =>
  (serviceId: Id): NonExistingServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.NON_EXISTING,
      duplicated,
    };
  };

const toUnknownConnectionServiceDescription =
  (state: () => State) =>
  ({
    id: serviceId,
    value,
    credential,
  }: EndevorService): ValidEndevorServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.UNKNOWN_CONNECTION,
      duplicated,
      url: toServiceUrl(value.location, credential?.value),
    };
  };

const toInvalidCredentialServiceDescription =
  (state: () => State) =>
  ({
    id: serviceId,
    value,
    credential,
  }: EndevorService): InvalidEndevorServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.INVALID_CREDENTIAL,
      duplicated,
      url: toServiceUrl(value.location, credential?.value),
    };
  };

const toInvalidConnectionServiceDescription =
  (state: () => State) =>
  ({
    id: serviceId,
    value,
    credential,
  }: EndevorService): InvalidEndevorServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.INVALID_CONNECTION,
      duplicated,
      url: toServiceUrl(value.location, credential?.value),
    };
  };

const toUnknownCredentialServiceDescription =
  (state: () => State) =>
  ({
    id: serviceId,
    value,
    credential,
  }: EndevorService): ValidEndevorServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.UNKNOWN_CREDENTIAL,
      duplicated,
      url: toServiceUrl(value.location, credential?.value),
    };
  };

export const getAllExistingServiceDescriptions = (
  state: () => State
): ExistingEndevorServiceDescriptions => {
  return Object.entries(state().services).reduce(
    (acc: ExistingEndevorServiceDescriptions, [serviceKey, service]) => {
      if (!service) return acc;
      const sessionDetails = state().sessions[serviceKey];
      if (
        !sessionDetails ||
        !sessionDetails.connection ||
        sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        !sessionDetails.credentials ||
        sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownCredentialServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.connection.status === EndevorConnectionStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidCredentialServiceDescription(state)(service);
        return acc;
      }
      acc[serviceKey] = toValidServiceDescription(state)(service);
      return acc;
    },
    {}
  );
};

export const getExistingUnusedServiceDescriptions = (
  state: () => State
): ExistingEndevorServiceDescriptions => {
  const usedServices = Object.keys(state().serviceLocations);
  return Object.entries(state().services)
    .filter(([serviceKey]) => !usedServices.includes(serviceKey))
    .reduce(
      (acc: ExistingEndevorServiceDescriptions, [serviceKey, service]) => {
        if (!service) return acc;
        const sessionDetails = state().sessions[serviceKey];
        if (
          !sessionDetails ||
          !sessionDetails.connection ||
          sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownConnectionServiceDescription(state)(service);
          return acc;
        }
        if (
          !sessionDetails.credentials ||
          sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownCredentialServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.connection.status === EndevorConnectionStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidConnectionServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidCredentialServiceDescription(state)(service);
          return acc;
        }
        acc[serviceKey] = toValidServiceDescription(state)(service);
        return acc;
      },
      {}
    );
};

export const getExistingUsedServiceDescriptions = (
  state: () => State
): ExistingEndevorServiceDescriptions => {
  return Object.keys(state().serviceLocations).reduce(
    (acc: ExistingEndevorServiceDescriptions, serviceKey) => {
      const service = state().services[serviceKey];
      if (!service) return acc;
      const sessionDetails = state().sessions[serviceKey];
      if (
        !sessionDetails ||
        !sessionDetails.connection ||
        sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        !sessionDetails.credentials ||
        sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
      ) {
        acc[serviceKey] = toUnknownCredentialServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.connection.status === EndevorConnectionStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidConnectionServiceDescription(state)(service);
        return acc;
      }
      if (
        sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
      ) {
        acc[serviceKey] = toInvalidCredentialServiceDescription(state)(service);
        return acc;
      }
      acc[serviceKey] = toValidServiceDescription(state)(service);
      return acc;
    },
    {}
  );
};

export const getExistingServiceDescriptionsBySearchLocationId =
  (state: () => State) =>
  (searchLocationId: EndevorId): ExistingEndevorServiceDescriptions => {
    return Object.entries(state().serviceLocations)
      .filter(([, value]) => value.value[toCompositeKey(searchLocationId)])
      .reduce((acc: ExistingEndevorServiceDescriptions, [serviceKey]) => {
        const service = state().services[serviceKey];
        if (!service) {
          return acc;
        }
        const sessionDetails = state().sessions[serviceKey];
        if (
          !sessionDetails ||
          !sessionDetails.connection ||
          sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownConnectionServiceDescription(state)(service);
          return acc;
        }
        if (
          !sessionDetails.credentials ||
          sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownCredentialServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.connection.status === EndevorConnectionStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidConnectionServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidCredentialServiceDescription(state)(service);
          return acc;
        }
        acc[serviceKey] = toValidServiceDescription(state)(service);
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
        if (!service) {
          acc[serviceKey] = toNonExistingServiceDescription(state)(value.id);
          return acc;
        }
        const sessionDetails = state().sessions[serviceKey];
        if (
          !sessionDetails ||
          !sessionDetails.connection ||
          sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownConnectionServiceDescription(state)(service);
          return acc;
        }
        if (
          !sessionDetails.credentials ||
          sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
        ) {
          acc[serviceKey] =
            toUnknownCredentialServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidCredentialServiceDescription(state)(service);
          return acc;
        }
        if (
          sessionDetails.connection.status === EndevorConnectionStatus.INVALID
        ) {
          acc[serviceKey] =
            toInvalidConnectionServiceDescription(state)(service);
          return acc;
        }
        acc[serviceKey] = toValidServiceDescription(state)(service);
        return acc;
      }, {});
  };

export const getAllServiceLocations = (
  state: () => State
): EndevorServiceLocations => {
  const toSearchLocationDescriptions = (
    inventoryLocationNames: InventoryLocationNames
  ): EndevorSearchLocationDescriptions => {
    return Object.entries(inventoryLocationNames).reduce(
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
  return Object.entries(state().serviceLocations).reduce(
    (acc: EndevorServiceLocations, [serviceKey, serviceLocation]) => {
      const service = state().services[serviceKey];
      if (service) {
        const sessionDetails = state().sessions[serviceKey];
        if (
          !sessionDetails?.connection ||
          sessionDetails.connection.status === EndevorConnectionStatus.UNKNOWN
        ) {
          const serviceDescription =
            toUnknownConnectionServiceDescription(state)(service);
          acc[serviceKey] = {
            ...serviceDescription,
            url: toServiceUrl(
              service.value.location,
              service.credential?.value
            ),
            value: toSearchLocationDescriptions(serviceLocation.value),
          };
          return acc;
        }
        if (
          sessionDetails.connection.status === EndevorConnectionStatus.INVALID
        ) {
          const serviceDescription =
            toInvalidConnectionServiceDescription(state)(service);
          acc[serviceKey] = {
            ...serviceDescription,
            url: toServiceUrl(
              service.value.location,
              service.credential?.value
            ),
            value: toSearchLocationDescriptions(serviceLocation.value),
          };
          return acc;
        }
        if (
          !sessionDetails.credentials ||
          sessionDetails.credentials.status === EndevorCredentialStatus.UNKNOWN
        ) {
          const serviceDescription =
            toUnknownCredentialServiceDescription(state)(service);
          acc[serviceKey] = {
            ...serviceDescription,
            url: toServiceUrl(
              service.value.location,
              service.credential?.value
            ),
            value: toSearchLocationDescriptions(serviceLocation.value),
          };
          return acc;
        }
        if (
          sessionDetails.credentials.status === EndevorCredentialStatus.INVALID
        ) {
          const serviceDescription =
            toInvalidCredentialServiceDescription(state)(service);
          acc[serviceKey] = {
            ...serviceDescription,
            url: toServiceUrl(
              service.value.location,
              service.credential?.value
            ),
            value: toSearchLocationDescriptions(serviceLocation.value),
          };
          return acc;
        }
        const serviceDescription = toValidServiceDescription(state)(service);
        acc[serviceKey] = {
          ...serviceDescription,
          url: toServiceUrl(service.value.location, service.credential?.value),
          value: toSearchLocationDescriptions(serviceLocation.value),
        };
        return acc;
      }
      const serviceDescription = toNonExistingServiceDescription(state)(
        serviceLocation.id
      );
      acc[serviceKey] = {
        ...serviceDescription,
        value: toSearchLocationDescriptions(serviceLocation.value),
      };
      return acc;
    },
    {}
  );
};

const toValidLocationDescription =
  (state: () => State) =>
  (
    endevorSearchLocation: EndevorSearchLocation
  ): ValidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== endevorSearchLocation.id.source)
        // workaround for ridiculous typescript limitation
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
        // workaround for ridiculous typescript limitation
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
  (
    searchLocationId: EndevorId
  ): Omit<ElementSearchLocation, 'configuration'> | undefined => {
    const inventoryLocation =
      state().searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return;
    }
    return normalizeSearchLocation(inventoryLocation.value);
  };

export const getEndevorConfiguration =
  (state: () => State) =>
  (searchLocationId: EndevorId): EndevorConfiguration | undefined => {
    const inventoryLocation =
      state().searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return;
    }
    return inventoryLocation.value.configuration;
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

export const getAllValidSearchLocationDescriptions = (
  state: () => State
): ValidEndevorSearchLocationDescriptions => {
  return Object.entries(state().searchLocations).reduce(
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
