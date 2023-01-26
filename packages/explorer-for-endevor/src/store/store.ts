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
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { logger } from '../globals';
import { isDefined, isError, isUnique } from '../utils';
import { Action, Actions } from './_doc/Actions';
import { Node } from '../tree/_doc/ServiceLocationTree';
import { SubsystemMapPathId, toSubsystemMapPathId } from '../_doc/Endevor';
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
  EndevorCacheVersion,
  CachedElement,
  CacheItem,
  ElementId,
  ElementsPerRoute,
  ElementFilter,
  ElementsUpTheMapFilter,
  ElementCcidsFilter,
  ElementNamesFilter,
  ElementFilterType,
  CachedEndevorMap,
  ElementFilters,
  ServiceLocationFilters,
} from './_doc/v2/Store';
import {
  normalizeSearchLocation,
  toServiceLocationCompositeKey,
  toElementCompositeKey,
  toSearchPath,
  toServiceUrl,
  isElementsCcidFilter,
  isElementsNameFilter,
  isElementsUpTheMapFilter,
  getAllFilteredElements,
} from './utils';
import { toCompositeKey } from './storage/utils';
import { DEFAULT_TREE_IN_PLACE_SEARCH_MODE } from '../constants';

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
      type ElementsAccum = {
        [elementsLocation: SubsystemMapPathId]: {
          cacheVersion: EndevorCacheVersion;
          elements: {
            [id: ElementId]: CachedElement;
          };
        };
      };
      type MapAccum = {
        [endevorMapNode: SubsystemMapPathId]: [];
      };
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
        case Actions.ELEMENTS_FETCH_CANCELED: {
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          if (!existingCache) {
            updateState(
              endevorCacheReducer(state())(action.serviceId)(
                action.searchLocationId
              )({
                endevorMap: {
                  value: {},
                  cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                },
                mapItemsContent: {},
              })
            );
            refreshTree();
            break;
          }
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: {
                ...existingCache.endevorMap,
                cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              },
              mapItemsContent: {
                ...Object.entries(existingCache.mapItemsContent).reduce(
                  (acc: ElementsAccum, [entryId, entryValue]) => {
                    if (entryValue) {
                      acc[entryId] = {
                        ...entryValue,
                        cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                      };
                    }
                    return acc;
                  },
                  {}
                ),
              },
            })
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENTS_FETCH_FAILED: {
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          if (!existingCache) {
            updateState(
              endevorCacheReducer(state())(action.serviceId)(
                action.searchLocationId
              )({
                endevorMap: {
                  value: {},
                  cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                },
                mapItemsContent: {},
              })
            );
            if (action.connection) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  connection: action.connection,
                })
              );
            }
            if (action.credential) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  credentials: action.credential,
                })
              );
            }
            refreshTree();
            break;
          }
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: {
                ...existingCache.endevorMap,
                cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              },
              mapItemsContent: {
                ...Object.entries(existingCache.mapItemsContent).reduce(
                  (acc: ElementsAccum, [entryId, entryValue]) => {
                    if (entryValue) {
                      acc[entryId] = {
                        ...entryValue,
                        cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                      };
                    }
                    return acc;
                  },
                  {}
                ),
              },
            })
          );
          if (action.connection) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                connection: action.connection,
              })
            );
          }
          if (action.credential) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                credentials: action.credential,
              })
            );
          }
          refreshTree();
          break;
        }
        case Actions.ELEMENTS_IN_PLACE_FETCHED: {
          if (!action.elements) {
            if (action.connection) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  connection: action.connection,
                })
              );
            }
            if (action.credential) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  credentials: action.credential,
                })
              );
            }
            refreshTree();
            break;
          }
          const endevorMap = action.subSystemsInPlace
            ? {
                value: action.subSystemsInPlace.reduce(
                  (acc: MapAccum, subSystem: SubSystemMapPath) => {
                    acc[toSubsystemMapPathId(subSystem)] = [];
                    return acc;
                  },
                  {}
                ),
                cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              }
            : undefined;
          if (endevorMap) {
            const actionMapItems = Object.entries(action.elements).reduce(
              (acc: ElementsAccum, [elementId, element]) => {
                const elementsLocation = toSubsystemMapPathId(element.element);
                const elementLocationNotInMap =
                  !endevorMap.value[elementsLocation];
                if (elementLocationNotInMap) return acc;
                const existingElementsLocation = acc[elementsLocation];
                if (existingElementsLocation) {
                  existingElementsLocation.elements[elementId] = element;
                  return acc;
                }
                acc[elementsLocation] = {
                  cacheVersion: endevorMap.cacheVersion,
                  elements: {
                    [elementId]: element,
                  },
                };
                return acc;
              },
              {}
            );
            updateState(
              endevorCacheReducer(state())(action.serviceId)(
                action.searchLocationId
              )({
                endevorMap,
                mapItemsContent: actionMapItems,
              })
            );
            if (action.connection) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  connection: action.connection,
                })
              );
            }
            if (action.credential) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  credentials: action.credential,
                })
              );
            }
            refreshTree();
            break;
          }
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )(
              Object.entries(action.elements).reduce(
                (
                  acc: {
                    endevorMap: {
                      cacheVersion: EndevorCacheVersion;
                      value: MapAccum;
                    };
                    mapItemsContent: ElementsAccum;
                  },
                  [elementId, element]
                ) => {
                  const elementsLocation = toSubsystemMapPathId(
                    element.element
                  );
                  const existingElementsLocation =
                    acc.endevorMap.value[elementsLocation];
                  const existingItemsContent =
                    acc.mapItemsContent[elementsLocation];
                  if (existingElementsLocation && existingItemsContent) {
                    existingItemsContent.elements[elementId] = element;
                    return acc;
                  }
                  acc.endevorMap.value[elementsLocation] = [];
                  acc.mapItemsContent[elementsLocation] = {
                    cacheVersion: acc.endevorMap.cacheVersion,
                    elements: {
                      [elementId]: element,
                    },
                  };
                  return acc;
                },
                {
                  endevorMap: {
                    cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                    value: {},
                  },
                  mapItemsContent: {},
                }
              )
            )
          );
          if (action.connection) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                connection: action.connection,
              })
            );
          }
          if (action.credential) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                credentials: action.credential,
              })
            );
          }
          refreshTree();
          break;
        }
        case Actions.ELEMENTS_UP_THE_MAP_FETCHED: {
          if (!action.elements) {
            if (action.connection) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  connection: action.connection,
                })
              );
            }
            if (action.credential) {
              updateState(
                sessionReducer(state())(action.serviceId)({
                  credentials: action.credential,
                })
              );
            }
            refreshTree();
            break;
          }
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          const endevorMap = action.endevorMap
            ? {
                cacheVersion: EndevorCacheVersion.UP_TO_DATE,
                value: action.endevorMap,
              }
            : existingCache?.endevorMap === undefined
            ? undefined
            : Object.values(existingCache.endevorMap.value).length === 0
            ? undefined
            : existingCache.endevorMap;
          if (!endevorMap) break;
          const fullMap = Object.entries(endevorMap.value).flatMap(
            ([searchLocationItem, route]) => {
              return [searchLocationItem, ...route];
            }
          );
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap,
              mapItemsContent: Object.entries(action.elements).reduce(
                (acc: ElementsAccum, [elementId, element]) => {
                  const elementLocation = toSubsystemMapPathId(element.element);
                  const elementLocationNotInMap = !fullMap.find(
                    (mapLocation) => mapLocation === elementLocation
                  );
                  if (elementLocationNotInMap) return acc;
                  const existingElementsLocation = acc[elementLocation];
                  if (existingElementsLocation) {
                    existingElementsLocation.elements[elementId] = element;
                    return acc;
                  }
                  acc[elementLocation] = {
                    cacheVersion: endevorMap.cacheVersion,
                    elements: {
                      [elementId]: element,
                    },
                  };
                  return acc;
                },
                {}
              ),
            })
          );
          if (action.connection) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                connection: action.connection,
              })
            );
          }
          if (action.credential) {
            updateState(
              sessionReducer(state())(action.serviceId)({
                credentials: action.credential,
              })
            );
          }
          refreshTree();
          break;
        }
        case Actions.REFRESH: {
          let actionState = state();
          Object.entries(actionState.serviceLocations).forEach(
            ([, service]) => {
              Object.entries(service.value).forEach(([, searchLocation]) => {
                const existingCache =
                  state().caches[
                    toServiceLocationCompositeKey(service.id)(searchLocation.id)
                  ];
                if (existingCache) {
                  const emptyMap =
                    Object.keys(existingCache.endevorMap.value).length === 0;
                  actionState = endevorCacheReducer(state())(service.id)(
                    searchLocation.id
                  )({
                    // TODO: switch to a more understandable map status (EMPTY or something like this),
                    // because the check for empty object is not reliable enough
                    endevorMap: emptyMap
                      ? {
                          value: {},
                          cacheVersion: EndevorCacheVersion.OUTDATED,
                        }
                      : existingCache.endevorMap,
                    mapItemsContent: {
                      ...Object.entries(existingCache.mapItemsContent).reduce(
                        (acc: ElementsAccum, [entryId, entryValue]) => {
                          if (entryValue) {
                            acc[entryId] = {
                              ...entryValue,
                              cacheVersion: EndevorCacheVersion.OUTDATED,
                            };
                          }
                          return acc;
                        },
                        {}
                      ),
                    },
                  });
                  updateState(actionState);
                }
              });
            }
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_ADDED: {
          const optimisticStateUpdate = updateElementReducer(state())(
            action.serviceId
          )(action.searchLocationId)(action.element);
          updateState(optimisticStateUpdate);
          refreshTree();
          const existingCache =
            state().caches[
              toServiceLocationCompositeKey(action.serviceId)(
                action.searchLocationId
              )
            ];
          if (!existingCache) break;
          updateState(
            endevorCacheReducer(state())(action.serviceId)(
              action.searchLocationId
            )({
              endevorMap: existingCache.endevorMap,
              mapItemsContent: {
                ...Object.entries(existingCache.mapItemsContent).reduce(
                  (acc: ElementsAccum, [entryId, entryValue]) => {
                    if (entryValue) {
                      acc[entryId] = {
                        ...entryValue,
                        cacheVersion: EndevorCacheVersion.OUTDATED,
                      };
                    }
                    return acc;
                  },
                  {}
                ),
              },
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
          if (!existingCache) {
            break;
          }
          const oldElementLocationId = toSubsystemMapPathId(
            action.pathUpTheMap
          );
          const oldElementLocation =
            existingCache.mapItemsContent[oldElementLocationId];
          if (!oldElementLocation) break;
          const oldElementId = toElementCompositeKey(action.treePath.serviceId)(
            action.treePath.searchLocationId
          )(action.pathUpTheMap);
          const oldElement = oldElementLocation.elements[oldElementId];
          if (!oldElement) {
            break;
          }
          const targetElementLocationId = toSubsystemMapPathId(
            action.targetElement
          );
          const {
            [oldElementId]: matchingCashedElement,
            ...existingCachedElements
          } = oldElementLocation.elements;
          const newElement: Element = {
            ...action.targetElement,
            extension: oldElement.element.extension,
            name: oldElement.element.name,
          };
          const optimisticStateUpdate = endevorCacheReducer(state())(
            action.treePath.serviceId
          )(action.treePath.searchLocationId)({
            endevorMap: existingCache.endevorMap,
            mapItemsContent: {
              ...Object.entries(existingCache.mapItemsContent).reduce(
                (acc: ElementsAccum, [entryId, elementsInMapPart]) => {
                  if (!elementsInMapPart) return acc;
                  if (entryId === oldElementLocationId) {
                    acc[entryId] = {
                      cacheVersion: elementsInMapPart.cacheVersion,
                      elements: existingCachedElements,
                    };
                    return acc;
                  }
                  if (entryId === targetElementLocationId) {
                    acc[entryId] = {
                      cacheVersion: elementsInMapPart.cacheVersion,
                      elements: {
                        ...elementsInMapPart.elements,
                        [toElementCompositeKey(action.treePath.serviceId)(
                          action.treePath.searchLocationId
                        )(newElement)]: {
                          element: newElement,
                          lastRefreshTimestamp: Date.now(),
                        },
                      },
                    };
                    return acc;
                  }
                  acc[entryId] = elementsInMapPart;
                  return acc;
                },
                {}
              ),
            },
          });
          updateState(optimisticStateUpdate);
          refreshTree();
          const optimisticlyUpdatedCache =
            optimisticStateUpdate.caches[
              toServiceLocationCompositeKey(action.treePath.serviceId)(
                action.treePath.searchLocationId
              )
            ];
          if (!optimisticlyUpdatedCache) break;
          updateState(
            endevorCacheReducer(state())(action.treePath.serviceId)(
              action.treePath.searchLocationId
            )({
              endevorMap: optimisticlyUpdatedCache.endevorMap,
              mapItemsContent: {
                ...Object.entries(
                  optimisticlyUpdatedCache.mapItemsContent
                ).reduce((acc: ElementsAccum, [entryId, entryValue]) => {
                  if (entryValue) {
                    acc[entryId] = {
                      ...entryValue,
                      cacheVersion: EndevorCacheVersion.OUTDATED,
                    };
                  }
                  return acc;
                }, {}),
              },
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
        case Actions.ELEMENT_CCIDS_FILTER_UPDATED:
        case Actions.ELEMENT_NAMES_FILTER_UPDATED: {
          updateState(
            filtersReducer(state())(action.serviceId)(action.searchLocationId)(
              action.updatedFilter
            )
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_UP_THE_MAP_FILTER_UPDATED: {
          const stateWithUpdatedFilters = filtersReducer(state())(
            action.serviceId
          )(action.searchLocationId)(action.updatedFilter);
          updateState(stateWithUpdatedFilters);
          const serviceLocationId = toServiceLocationCompositeKey(
            action.serviceId
          )(action.searchLocationId);
          const switchToFirstFound = action.updatedFilter.value === true;
          if (switchToFirstFound) {
            const existingCache = state().caches[serviceLocationId];
            if (!existingCache) {
              refreshTree();
              break;
            }
            updateState(
              endevorCacheReducer(stateWithUpdatedFilters)(action.serviceId)(
                action.searchLocationId
              )({
                ...existingCache,
                endevorMap: {
                  cacheVersion: EndevorCacheVersion.OUTDATED,
                  value: existingCache.endevorMap.value,
                },
              })
            );
            refreshTree();
            break;
          }
          refreshTree();
          break;
        }
        case Actions.ENDEVOR_SEARCH_LOCATION_FILTERS_CLEARED: {
          updateState(
            clearFiltersReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.filtersCleared)
          );
          refreshTree();
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
    filters: {},
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

const filtersReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (updatedFilter: ElementFilter): State => {
    const serviceLocationKey =
      toServiceLocationCompositeKey(serviceId)(searchLocationId);
    const existingFilters = initialState.filters[serviceLocationKey];
    if (existingFilters) {
      return {
        ...initialState,
        filters: {
          ...initialState.filters,
          [serviceLocationKey]: {
            ...existingFilters,
            [updatedFilter.type]: updatedFilter,
          },
        },
      };
    }
    return {
      ...initialState,
      filters: {
        ...initialState.filters,
        [serviceLocationKey]: {
          [updatedFilter.type]: updatedFilter,
        },
      },
    };
  };

const clearFiltersReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (clearedFilters: ReadonlyArray<ElementFilterType>): State => {
    const serviceLocationKey =
      toServiceLocationCompositeKey(serviceId)(searchLocationId);
    const existingFilters = initialState.filters[serviceLocationKey];
    if (!existingFilters) return initialState;
    const updatedFilters = Object.entries(existingFilters).reduce(
      (acc: ElementFilters, [filterName, filterValue]) => {
        if (clearedFilters.includes(filterValue.type)) return acc;
        acc[serviceLocationKey] = {
          ...acc[serviceLocationKey],
          [filterName]: filterValue,
        };
        return acc;
      },
      { [serviceLocationKey]: {} }
    );
    return {
      ...initialState,
      filters: {
        ...initialState.filters,
        ...updatedFilters,
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
  (updatedCache: CacheItem | undefined): State => {
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
    if (!existingCache) return initialState;
    const elementsLocation = toSubsystemMapPathId(element);
    const elementLocationNotInMap = !Object.entries(
      existingCache.endevorMap.value
    )
      .flatMap(([searchLocationItem, route]) => {
        return [searchLocationItem, ...route];
      })
      .find((mapLocation) => mapLocation === elementsLocation);
    if (elementLocationNotInMap) return initialState;
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[elementsLocation];
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [toServiceLocationCompositeKey(serviceId)(searchLocationId)]: {
          ...existingCache,
          mapItemsContent: {
            ...existingCache.mapItemsContent,
            [elementsLocation]: {
              cacheVersion:
                elementsInTheSameLocation?.cacheVersion ||
                EndevorCacheVersion.UP_TO_DATE,
              elements: {
                ...elementsInTheSameLocation?.elements,
                [toElementCompositeKey(serviceId)(searchLocationId)(element)]: {
                  element,
                  lastRefreshTimestamp: Date.now(),
                },
              },
            },
          },
        },
      },
    };
  };

// public API

export const getElementNamesFilterValue =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ElementNamesFilter | undefined => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return;
    const filter = existingFilters[ElementFilterType.ELEMENT_NAMES_FILTER];
    if (!filter || !isElementsNameFilter(filter)) return undefined;
    return filter;
  };

export const getElementCcidsFilterValue =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ElementCcidsFilter | undefined => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return;
    const filter = existingFilters[ElementFilterType.ELEMENT_CCIDS_FILTER];
    if (!filter || !isElementsCcidFilter(filter)) return undefined;
    return filter;
  };

export const getElementsUpTheMapFilterValue =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ElementsUpTheMapFilter | undefined => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return;
    const filter =
      existingFilters[ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER];
    if (!filter || !isElementsUpTheMapFilter(filter)) return undefined;
    return filter;
  };

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
  const toSearchLocationDescriptions =
    (inventoryLocationNames: InventoryLocationNames) =>
    (serviceId: Id): EndevorSearchLocationDescriptions => {
      return Object.entries(inventoryLocationNames).reduce(
        (
          acc: EndevorSearchLocationDescriptions,
          [searchLocationKey, searchLocationValue]
        ) => {
          const searchLocation = state().searchLocations[searchLocationKey];
          acc[searchLocationKey] = searchLocation
            ? toValidLocationDescription(state)(searchLocation)(
                state().filters[
                  toServiceLocationCompositeKey(serviceId)(searchLocation.id)
                ]
              )
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
            value: toSearchLocationDescriptions(serviceLocation.value)(
              service.id
            ),
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
            value: toSearchLocationDescriptions(serviceLocation.value)(
              service.id
            ),
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
            value: toSearchLocationDescriptions(serviceLocation.value)(
              service.id
            ),
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
            value: toSearchLocationDescriptions(serviceLocation.value)(
              service.id
            ),
          };
          return acc;
        }
        const serviceDescription = toValidServiceDescription(state)(service);
        acc[serviceKey] = {
          ...serviceDescription,
          url: toServiceUrl(service.value.location, service.credential?.value),
          value: toSearchLocationDescriptions(serviceLocation.value)(
            serviceLocation.id
          ),
        };
        return acc;
      }
      const serviceDescription = toNonExistingServiceDescription(state)(
        serviceLocation.id
      );
      acc[serviceKey] = {
        ...serviceDescription,
        value: toSearchLocationDescriptions(serviceLocation.value)(
          serviceLocation.id
        ),
      };
      return acc;
    },
    {}
  );
};

const toValidLocationDescription =
  (state: () => State) =>
  (endevorSearchLocation: EndevorSearchLocation) =>
  (
    availableFilters: ServiceLocationFilters | undefined
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
    if (availableFilters) {
      const firstFoundSearchFilter =
        availableFilters[ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER];
      if (
        firstFoundSearchFilter &&
        isElementsUpTheMapFilter(firstFoundSearchFilter)
      ) {
        return {
          id: endevorSearchLocation.id,
          duplicated,
          status: EndevorSearchLocationStatus.VALID,
          path: toSearchPath(endevorSearchLocation.value) + '',
          searchForFirstFoundElements: firstFoundSearchFilter.value,
        };
      }
    }
    return {
      id: endevorSearchLocation.id,
      duplicated,
      status: EndevorSearchLocationStatus.VALID,
      path: toSearchPath(endevorSearchLocation.value) + '',
      searchForFirstFoundElements: DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
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
    .flatMap((serviceLocation) =>
      Object.entries(serviceLocation.value).map(
        ([locationKey, locationValue]) => {
          return {
            serviceId: serviceLocation.id,
            location: {
              key: locationKey,
              searchLocationId: locationValue.id,
            },
          };
        }
      )
    )
    .reduce((acc: EndevorSearchLocationDescriptions, serviceLocationItem) => {
      const searchLocationValue =
        state().searchLocations[serviceLocationItem.location.key];
      acc[serviceLocationItem.location.key] = searchLocationValue
        ? toValidLocationDescription(state)(searchLocationValue)(
            state().filters[
              toServiceLocationCompositeKey(serviceLocationItem.serviceId)(
                searchLocationValue.id
              )
            ]
          )
        : toInvalidLocationDescription(state)(
            serviceLocationItem.location.searchLocationId
          );
      return acc;
    }, {});
};

export const getAllValidSearchLocationDescriptions = (
  state: () => State
): ValidEndevorSearchLocationDescriptions => {
  return Object.values(state().serviceLocations)
    .flatMap((serviceLocation) =>
      Object.entries(serviceLocation.value).map(
        ([locationKey, locationValue]) => {
          return {
            serviceId: serviceLocation.id,
            location: {
              key: locationKey,
              searchLocationId: locationValue.id,
            },
          };
        }
      )
    )
    .reduce(
      (acc: ValidEndevorSearchLocationDescriptions, serviceLocationItem) => {
        const searchLocationValue =
          state().searchLocations[serviceLocationItem.location.key];
        if (searchLocationValue) {
          acc[serviceLocationItem.location.key] = toValidLocationDescription(
            state
          )(searchLocationValue)(
            state().filters[
              toServiceLocationCompositeKey(serviceLocationItem.serviceId)(
                searchLocationValue.id
              )
            ]
          );
        }
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
          acc[searchLocationKey] = toValidLocationDescription(state)(
            searchLocation
          )(
            state().filters[
              toServiceLocationCompositeKey(serviceId)(searchLocation.id)
            ]
          );
          return acc;
        },
        {}
      );
  };

export const getAllElements =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (
    searchLocationId: EndevorId
  ):
    | Readonly<{
        cacheVersion: EndevorCacheVersion;
        elements: ReadonlyArray<CachedElement>;
      }>
    | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache) {
      return undefined;
    }
    type ElementsCacheAccum = {
      cacheVersion: EndevorCacheVersion;
      elements: Array<CachedElement>;
    };
    const initialVersion = EndevorCacheVersion.UP_TO_DATE;
    return Object.values(cache.mapItemsContent).reduce(
      (acc: ElementsCacheAccum, elementsInMapPart) => {
        if (!elementsInMapPart) {
          return acc;
        }
        if (elementsInMapPart.cacheVersion !== initialVersion) {
          acc.cacheVersion = elementsInMapPart.cacheVersion;
        }
        acc.elements.push(...Object.values(elementsInMapPart.elements));
        return acc;
      },
      {
        elements: [],
        cacheVersion: initialVersion,
      }
    );
  };

const filterCachedElements =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (
    cachedElements: ReadonlyArray<CachedElement>
  ): ReadonlyArray<CachedElement> => {
    const elementNamesFilter =
      getElementNamesFilterValue(state)(serviceId)(searchLocationId);
    const elementCcidsFilter =
      getElementCcidsFilterValue(state)(serviceId)(searchLocationId);
    let filteredElements: ReadonlyArray<CachedElement> = cachedElements;
    if (elementNamesFilter) {
      filteredElements =
        getAllFilteredElements(filteredElements)(elementNamesFilter);
    }
    if (elementCcidsFilter) {
      filteredElements =
        getAllFilteredElements(filteredElements)(elementCcidsFilter);
    }
    return filteredElements;
  };

export const getElementsInPlace =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (
    searchLocationId: EndevorId
  ):
    | Readonly<{
        cacheVersion: EndevorCacheVersion;
        elementsPerRoute: ElementsPerRoute;
      }>
    | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache) {
      return;
    }
    type RoutesAccum = {
      [routeId: SubsystemMapPathId]: ReadonlyArray<CachedElement>;
    };
    const initialCacheVersion = EndevorCacheVersion.UP_TO_DATE;
    let overallCacheVersion: EndevorCacheVersion | undefined;
    const elementsPerRoute = Object.keys(cache.endevorMap.value).reduce(
      (acc: RoutesAccum, inPlaceLocation) => {
        const elements = cache.mapItemsContent[inPlaceLocation];
        if (!elements) {
          acc[inPlaceLocation] = [];
          return acc;
        }
        if (!overallCacheVersion) {
          overallCacheVersion = initialCacheVersion;
        }
        if (elements.cacheVersion !== initialCacheVersion) {
          overallCacheVersion = elements.cacheVersion;
        }
        acc[inPlaceLocation] = filterCachedElements(state)(serviceId)(
          searchLocationId
        )(Object.values(elements.elements));
        return acc;
      },
      {}
    );
    const mapVersion = cache.endevorMap.cacheVersion;
    if (overallCacheVersion) {
      if (mapVersion !== initialCacheVersion) {
        overallCacheVersion = mapVersion;
      }
      return {
        cacheVersion: overallCacheVersion,
        elementsPerRoute,
      };
    }
    if (mapVersion && !overallCacheVersion) {
      return {
        cacheVersion: mapVersion,
        elementsPerRoute,
      };
    }
    return;
  };

export const getFirstFoundElements =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (
    searchLocationId: EndevorId
  ):
    | Readonly<{
        cacheVersion: EndevorCacheVersion;
        elementsPerRoute: ElementsPerRoute;
      }>
    | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache) {
      return;
    }
    type ElementsAccum = {
      [elementName: string]: CachedElement;
    };
    type RoutesAccum = {
      [routeId: SubsystemMapPathId]: ElementsAccum;
    };
    const initialCacheVersion = EndevorCacheVersion.UP_TO_DATE;
    let overallCacheVersion: EndevorCacheVersion | undefined;
    const elementsPerRoute = Object.entries(
      Object.entries(cache.endevorMap.value).reduce(
        (acc: RoutesAccum, [inPlaceLocation, routeItems]) => {
          const reversedRoute = [...[...routeItems].reverse(), inPlaceLocation];
          reversedRoute.forEach((location) => {
            const locationData = cache.mapItemsContent[location];
            if (!locationData) return acc;
            if (!overallCacheVersion) {
              overallCacheVersion = initialCacheVersion;
            }
            if (locationData.cacheVersion !== initialCacheVersion) {
              overallCacheVersion = locationData.cacheVersion;
            }
            const elementsInLocation = Object.values(locationData.elements);
            const elementsInRoute = acc[inPlaceLocation] ?? {};
            elementsInLocation.forEach((element) => {
              elementsInRoute[element.element.name] = element;
            });
            acc[inPlaceLocation] = elementsInRoute;
            return;
          });
          const noElementsInRoute = !acc[inPlaceLocation];
          if (noElementsInRoute) {
            acc[inPlaceLocation] = {};
          }
          return acc;
        },
        {}
      )
    ).reduce(
      (
        acc: {
          [searchLocation: SubsystemMapPathId]: ReadonlyArray<CachedElement>;
        },
        [routeId, elementsAccum]
      ) => {
        acc[routeId] = filterCachedElements(state)(serviceId)(searchLocationId)(
          Object.values(elementsAccum)
        );
        return acc;
      },
      {}
    );
    const mapVersion = cache.endevorMap.cacheVersion;
    if (overallCacheVersion) {
      if (mapVersion !== initialCacheVersion) {
        overallCacheVersion = mapVersion;
      }
      return {
        cacheVersion: overallCacheVersion,
        elementsPerRoute,
      };
    }
    if (mapVersion && !overallCacheVersion) {
      return {
        cacheVersion: mapVersion,
        elementsPerRoute,
      };
    }
    return;
  };

export const getEndevorMap =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): CachedEndevorMap | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    return cache?.endevorMap;
  };
