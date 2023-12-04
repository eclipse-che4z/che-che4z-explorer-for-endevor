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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  Element,
  ElementType,
  ServiceApiVersion,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { logger } from '../globals';
import { isDefined, isElementUpTheMap, isError, isUnique } from '../utils';
import { Action, Actions } from './_doc/Actions';
import { Node } from '../tree/_doc/ServiceLocationTree';
import {
  EndevorMap,
  SearchLocation,
  SubsystemMapPathId,
} from '../api/_doc/Endevor';
import {
  ConnectionLocations,
  Connections,
  Credential,
  CredentialsStorage,
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
  ValidEndevorSearchLocationDescriptions,
  ExistingEndevorServiceDescriptions,
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorConfiguration,
  EndevorCredentialStatus,
  EndevorCredentialDescription,
  ValidEndevorConnection,
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
  CachedEndevorInventory,
  ElementFilters,
  ElementTypesFilter,
  EndevorToken,
  EndevorTokenStatus,
  ActivityRecord,
  EndevorReport,
  ActivityRecords,
  CachedTypes,
  EmptyTypesFilter,
  ValidEndevorSessionCredential,
  CachedEnvironmentStages,
  EndevorSessionCredential,
} from './_doc/v2/Store';
import {
  normalizeSearchLocation,
  toServiceLocationCompositeKey,
  toElementCompositeKey,
  isElementsCcidFilter,
  isElementsNameFilter,
  isElementsUpTheMapFilter,
  getAllFilteredElements,
  isElementsTypeFilter,
  byFilterOrder,
  toNonExistingServiceDescription,
  toInvalidLocationDescription,
  toValidLocationDescription,
  toExistingServiceDescription,
  toSubsystemMapPathId,
  isEmptyTypesFilter,
  typeMatchesFilter,
  toEnvironmentStageMapPathId,
} from './utils';
import { toCompositeKey } from './storage/utils';
import { isBearerTokenCredential } from '@local/endevor/utils';
import { ElementHistoryData } from '@local/views/tree/_doc/ChangesTree';

export const make =
  (storageGetters: StorageGetters) =>
  async (
    state: () => State,
    refreshTree: (node?: Node) => void,
    refreshActivity: (node?: Node) => void,
    updateState: (state: State) => void,
    emitElementsUpdatedEvent: (
      serviceId: EndevorId,
      searchLocationId: EndevorId,
      elements: ReadonlyArray<Element>
    ) => void
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
      switch (action.type) {
        case Actions.ACTIVITY_RECORD_ADDED: {
          const time = Date.now();
          const reports: ReadonlyArray<EndevorReport> = action.reportIds
            ? Object.keys(action.reportIds)
                .map((reportName) => {
                  const reportId = action.reportIds
                    ? action.reportIds[reportName]
                    : undefined;
                  return {
                    name: reportName,
                    id: reportId || '',
                    objectName: action.actionName,
                  };
                })
                .filter((report) => report.id)
            : [];
          const logEntry: ActivityRecord = {
            time,
            name: action.actionName,
            details: {
              searchLocationId: action.searchLocationId,
              serviceId: action.serviceId,
              element: action.element,
              messages: action.messages,
              returnCode: action.returnCode,
              reports,
            },
          };
          state().activityEntries.unshift(logEntry);
          refreshActivity();
          break;
        }
        case Actions.SESSION_ENDEVOR_TOKEN_ADDED: {
          const serviceKey = toCompositeKey(action.sessionId);
          const persistedConnection = state().services[serviceKey]?.value;
          const sessionConnection = state().sessions[serviceKey]?.connection;
          const anyApiVersion = ServiceApiVersion.V2;

          let connection: ValidEndevorConnection | undefined;
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

          let credential: ValidEndevorSessionCredential | undefined;
          if (action.credential) {
            // if the basic credentials are provided (a disabled token case only)
            const storageCredential = await readCredentialFromStorage(
              storageGetters.getCredentialsStorage
            )(action.sessionId);
            if (
              storageCredential &&
              action.sessionId.source === Source.INTERNAL
            ) {
              // for the internal connections only
              // update the credentials directly in the stored connection if they were set there before
              storeCredentialToStorage(storageGetters.getCredentialsStorage)(
                action.sessionId,
                {
                  id: action.sessionId,
                  value: action.credential.value,
                }
              );
              // in that case save only a status in the session
              credential = {
                status: EndevorCredentialStatus.VALID,
              };
            } else {
              // otherwise, store the provided credentials and the status in the session for both: internal & sync'ed connections
              credential = {
                status: EndevorCredentialStatus.VALID,
                value: action.credential.value,
              };
            }
          } else {
            // when the basic credentials are not provided (an enabled token case)
            // store the status and whatever is specified in the session (including undefined)
            const sessionCredential = state().sessions[serviceKey]?.credential;
            credential = {
              status: EndevorCredentialStatus.VALID,
              value: sessionCredential?.value,
            };
          }

          updateState(
            sessionReducer(state())(action.sessionId)({
              id: action.sessionId,
              tokens: {
                [action.configuration]: action.token,
              },
              connection,
              credential,
            })
          );
          refreshTree();
          break;
        }
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
              id: action.sessionId,
              credential: action.credential,
              connection,
            })
          );
          refreshTree();
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

          const sessionCredential = state().sessions[serviceKey]?.credential;
          let credential: EndevorSessionCredential = {
            status: action.status,
          };
          if (sessionCredential) {
            credential = {
              ...credential,
              value: sessionCredential.value,
            };
          }

          updateState(
            sessionReducer(state())(action.credentialId)({
              id: action.credentialId,
              credential,
              connection,
            })
          );
          refreshTree();
          break;
        }
        case Actions.SESSION_ENDEVOR_CONNECTION_ADDED: {
          updateState(
            sessionReducer(state())(action.sessionId)({
              id: action.sessionId,
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
                  id: action.connectionId,
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
                  id: action.connectionId,
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
                  id: action.connectionId,
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
                  id: action.connectionId,
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
                endevorInventory: {
                  endevorMap: {},
                  environmentStages: {},
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
              endevorInventory: {
                ...existingCache.endevorInventory,
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
                endevorInventory: {
                  endevorMap: {},
                  environmentStages: {},
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
              endevorInventory: {
                ...existingCache.endevorInventory,
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
        case Actions.ELEMENTS_FETCHED: {
          const endevorInventory = getUpdatedEndevorInventory(state)(
            action.serviceId
          )(action.searchLocationId)(
            action.endevorMap,
            action.environmentStages
          );
          if (!endevorInventory) break;

          const newState = endevorCacheReducer(state())(action.serviceId)(
            action.searchLocationId
          )({
            endevorInventory,
            mapItemsContent: Object.entries(action.elements).reduce(
              (acc: ElementsAccum, [elementId, element]) => {
                element.outOfDate = false;
                const elementsLocation = toSubsystemMapPathId(element.element);
                const existingItemsContent = acc[elementsLocation];
                if (existingItemsContent) {
                  existingItemsContent.elements[elementId] = element;
                  return acc;
                }
                acc[elementsLocation] = {
                  cacheVersion: endevorInventory.cacheVersion,
                  elements: {
                    [elementId]: element,
                  },
                };
                return acc;
              },
              {}
            ),
          });
          updateState(newState);
          if (newState.changedElements?.length) {
            emitElementsUpdatedEvent(
              action.serviceId,
              action.searchLocationId,
              newState.changedElements
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
                    Object.keys(existingCache.endevorInventory.endevorMap)
                      .length === 0;
                  actionState = endevorCacheReducer(state())(service.id)(
                    searchLocation.id
                  )({
                    // TODO: switch to a more understandable map status (EMPTY or something like this),
                    // because the check for empty object is not reliable enough
                    endevorInventory: emptyMap
                      ? {
                          endevorMap: {},
                          environmentStages: {},
                          cacheVersion: EndevorCacheVersion.OUTDATED,
                        }
                      : existingCache.endevorInventory,
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
          )(action.searchLocationId)(action.element, true, true);
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
              endevorInventory: existingCache.endevorInventory,
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
          emitElementsUpdatedEvent(action.serviceId, action.searchLocationId, [
            action.element,
          ]);
          refreshTree();
          break;
        }
        case Actions.ELEMENT_UPDATED_IN_PLACE: {
          const updatedElements = findUpdatedElements(state())(
            action.serviceId
          )(action.searchLocationId)([action.element]);
          updateState(
            updateElementReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element, true, true)
          );
          emitElementsUpdatedEvent(
            action.serviceId,
            action.searchLocationId,
            updatedElements
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_MOVED: {
          if (!action.sourceElement && !action.targetElement) {
            return;
          }
          const updatedState = !action.bypassElementDelete
            ? removeElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(action.sourceElement)
            : updateSelectedSubsystemElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(action.sourceElement, true);
          const upTheMapFilter = getElementsUpTheMapFilterValue(state)(
            action.serviceId
          )(action.searchLocationId);

          updateState(
            upTheMapFilter?.value && action.targetElement
              ? updateElementReducer(updatedState)(action.serviceId)(
                  action.searchLocationId
                )(action.targetElement, true, true)
              : updatedState
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_GENERATED_IN_PLACE:
        case Actions.ELEMENT_SIGNED_IN: {
          updateState(
            updateElementReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element, false, true)
          );
          refreshTree();
          break;
        }
        case Actions.SELECTED_ELEMENTS_FETCHED: {
          const updatedElements = findUpdatedElements(state())(
            action.serviceId
          )(action.searchLocationId)(action.elements);
          action.elements.forEach((element) => {
            updateState(
              updateSelectedSubsystemElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(element, false)
            );
          });
          emitElementsUpdatedEvent(
            action.serviceId,
            action.searchLocationId,
            updatedElements
          );
          refreshTree();
          break;
        }
        case Actions.SELECTED_ELEMENTS_UPDATED: {
          const updatedElements = findUpdatedElements(state())(
            action.serviceId
          )(action.searchLocationId)(
            action.elements.map((element) => ({
              ...element,
              id: element.name,
            }))
          );
          action.elements.forEach((element) => {
            updateState(
              updateSelectedSubsystemElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(element, true)
            );
          });
          emitElementsUpdatedEvent(
            action.serviceId,
            action.searchLocationId,
            updatedElements
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_SIGNED_OUT: {
          action.elements.forEach((element) => {
            updateState(
              updateElementReducer(state())(action.serviceId)(
                action.searchLocationId
              )(element, false, true)
            );
          });
          refreshTree();
          break;
        }
        case Actions.ELEMENT_HISTORY_PRINTED: {
          updateState(
            updateElementHistoryReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.element)(action.historyData)
          );
          break;
        }
        case Actions.SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE: {
          updateState(
            updateSubsystemElementsReducer(state())(action.serviceId)(
              action.searchLocationId
            )(action.subSystemMapPath)(action.lastActionCcid, true)
          );
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
          const updatedElements = findUpdatedElements(state())(
            action.treePath.serviceId
          )(action.treePath.searchLocationId)([newElement], true);
          const optimisticStateUpdate = endevorCacheReducer(state())(
            action.treePath.serviceId
          )(action.treePath.searchLocationId)({
            endevorInventory: existingCache.endevorInventory,
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
                          elementIsUpTheMap: isElementUpTheMap(
                            action.treePath.searchLocation
                          )(newElement),
                          lastRefreshTimestamp: Date.now(),
                          outOfDate: true,
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
              endevorInventory: optimisticlyUpdatedCache.endevorInventory,
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
          emitElementsUpdatedEvent(
            action.treePath.serviceId,
            action.treePath.searchLocationId,
            updatedElements
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
          updateState(sessionReducer(state())(action.serviceId)(undefined));
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
            updateServiceReducer(state())({
              value: action.service.value,
              id: action.service.id,
            })
          );
          if (action.service.credential) {
            storeCredentialToStorage(storageGetters.getCredentialsStorage)(
              action.service.id,
              action.service.credential
            );
          }
          updateState(addServiceLocationReducer(state())(action.service.id)());
          if (
            action.connectionStatus.status === EndevorConnectionStatus.VALID
          ) {
            updateState(
              sessionReducer(state())(action.service.id)({
                id: action.service.id,
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
                id: action.service.id,
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
        case Actions.ENDEVOR_SERVICE_UPDATED: {
          updateState(
            updateServiceReducer(state())({
              id: action.serviceId,
              value: action.connection.value,
            })
          );
          let credential: EndevorSessionCredential | undefined;
          if (action.credential) {
            storeCredentialToStorage(storageGetters.getCredentialsStorage)(
              action.serviceId,
              {
                id: action.serviceId,
                value: action.credential.value,
              }
            );
            credential = {
              status: action.credential.status,
            };
          }
          updateState(removeSessionTokensReducer(state())(action.serviceId));
          updateState(
            sessionReducer(state())(action.serviceId)({
              id: action.serviceId,
              connection: action.connection,
              credential,
            })
          );
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
        case Actions.ELEMENT_NAMES_FILTER_UPDATED:
        case Actions.ELEMENT_TYPES_FILTER_UPDATED: {
          updateState(
            filtersReducer(state())(action.serviceId)(action.searchLocationId)(
              action.updatedFilter
            )
          );
          refreshTree();
          break;
        }
        case Actions.ELEMENT_TOGGLE_FILTER_UPDATED: {
          const stateWithUpdatedFilters = filtersReducer(state())(
            action.serviceId
          )(action.searchLocationId)(action.updatedFilter);
          updateState(stateWithUpdatedFilters);
          if (
            action.updatedFilter.type ===
            ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER
          ) {
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
                  endevorInventory: {
                    ...existingCache.endevorInventory,
                    cacheVersion: EndevorCacheVersion.OUTDATED,
                  },
                })
              );
            }
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
    activityEntries: [],
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
            acc[serviceKey] = {
              id: service.id,
              value: {
                rejectUnauthorized: false,
                location: service.value.location,
              },
            };
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
  };

const readCredentialFromStorage =
  (getCredentialsStorage: () => CredentialsStorage) =>
  async (serviceId: EndevorId) => {
    const credential = await getCredentialsStorage().get(serviceId);
    if (isError(credential)) {
      const error = credential;
      logger.warn(
        `Unable to read credentials for service ${serviceId.name} from the extension storage.`,
        `Unable to read credentials for service ${serviceId.name} from the extension storage because of error:\n${error.message}.`
      );
      return;
    }
    return credential;
  };

const storeCredentialToStorage =
  (getCredentialsStorage: () => CredentialsStorage) =>
  async (serviceId: EndevorId, credential: Credential) => {
    const result = await getCredentialsStorage().store(serviceId, credential);
    if (isError(result)) {
      const error = result;
      logger.warn(
        `Unable to update credentials for service ${serviceId.name} from the extension storage.`,
        `Unable to update credentials for service ${serviceId.name} because of error:\n${error.message}.`
      );
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
    if (!updatedSession) {
      return {
        ...initialState,
        sessions: {
          ...initialState.sessions,
          [serviceKey]: undefined,
        },
      };
    }
    return {
      ...initialState,
      sessions: {
        ...initialState.sessions,
        [serviceKey]: {
          ...initialState.sessions[serviceKey],
          ...updatedSession,
          tokens: {
            ...initialState.sessions[serviceKey]?.tokens,
            ...updatedSession?.tokens,
          },
        },
      },
    };
  };

const removeSessionTokensReducer =
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
        [serviceKey]: {
          ...initialState.sessions[serviceKey],
          tokens: undefined,
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

const updateServiceReducer =
  (initialState: State) =>
  (service: EndevorService): State => {
    return {
      ...initialState,
      services: {
        ...initialState.services,
        [toCompositeKey(service.id)]: service,
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
  (
    updatedCache: CacheItem | undefined
  ): State & { changedElements?: Element[] } => {
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
    const serviceLocationKey =
      toServiceLocationCompositeKey(serviceId)(searchLocationId);
    const changedElements: Element[] = [];
    if (updatedCache && updatedCache.mapItemsContent) {
      Object.values(updatedCache.mapItemsContent).forEach((mapLocation) => {
        const elements = mapLocation?.elements;
        if (elements) {
          Object.values(elements).forEach((element) => {
            const originalElement = getElement(() => initialState)(serviceId)(
              searchLocationId
            )(element.element);
            if (
              originalElement &&
              (element.element.processorGroup !==
                originalElement.element.processorGroup ||
                element.element.fingerprint !==
                  originalElement.element.fingerprint)
            ) {
              changedElements.push(element.element);
            }
            element.historyData = originalElement?.historyData;
          });
        }
      });
    }
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [serviceLocationKey]: updatedCache,
      },
      changedElements,
    };
  };

const updateSubsystemElementsReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (subSystemMapPath: SubSystemMapPath) =>
  (lastActionCcid?: string, outOfDate?: boolean): State => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return initialState;
    const subSystemLocation = toSubsystemMapPathId(subSystemMapPath);
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[subSystemLocation];
    if (!elementsInTheSameLocation) return initialState;
    const updatedElements: { [id: string]: CachedElement } = {};
    Object.entries(elementsInTheSameLocation.elements).forEach(
      ([id, cashedElement]) => {
        const historyData = updatedElements[id]?.historyData;
        updatedElements[id] = {
          element: { ...cashedElement.element, lastActionCcid },
          elementIsUpTheMap: cashedElement.elementIsUpTheMap,
          lastRefreshTimestamp: Date.now(),
          historyData,
          outOfDate,
        };
      }
    );
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [toServiceLocationCompositeKey(serviceId)(searchLocationId)]: {
          ...existingCache,
          mapItemsContent: {
            ...existingCache.mapItemsContent,
            [subSystemLocation]: {
              cacheVersion:
                elementsInTheSameLocation?.cacheVersion ||
                EndevorCacheVersion.UP_TO_DATE,
              elements: {
                ...updatedElements,
              },
            },
          },
        },
      },
    };
  };

const updateElementReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: Element, wipeHistory?: boolean, outOfDate?: boolean): State => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return initialState;
    const elementsLocation = toSubsystemMapPathId(element);
    const elementLocationNotInMap = !Object.entries(
      existingCache.endevorInventory.endevorMap
    )
      .flatMap(([searchLocationItem, route]) => {
        return [searchLocationItem, ...route];
      })
      .find((mapLocation) => mapLocation === elementsLocation);
    if (elementLocationNotInMap) return initialState;
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[elementsLocation];
    const inventoryLocation =
      initialState.searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return initialState;
    }
    // TODO normalize inventory location when reading from storage
    const normalizedInventoryLocation = normalizeSearchLocation(
      inventoryLocation.value
    );
    const elementId =
      toElementCompositeKey(serviceId)(searchLocationId)(element);
    const historyData = wipeHistory
      ? undefined
      : elementsInTheSameLocation?.elements[elementId]?.historyData;
    const outOfDateFlag =
      outOfDate !== undefined && outOfDate !== null
        ? outOfDate
        : elementsInTheSameLocation?.elements[elementId]?.outOfDate;
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
                [elementId]: {
                  element,
                  elementIsUpTheMap: isElementUpTheMap(
                    normalizedInventoryLocation
                  )(element),
                  lastRefreshTimestamp: Date.now(),
                  historyData,
                  outOfDate: outOfDateFlag,
                },
              },
            },
          },
        },
      },
    };
  };

const removeElementReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (elementToRemove: Element): State => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return initialState;
    const elementsLocation = toSubsystemMapPathId(elementToRemove);
    const elementLocationNotInMap = !Object.entries(
      existingCache.endevorInventory.endevorMap
    )
      .flatMap(([searchLocationItem, route]) => {
        return [searchLocationItem, ...route];
      })
      .find((mapLocation) => mapLocation === elementsLocation);
    if (elementLocationNotInMap) return initialState;
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[elementsLocation];
    if (!elementsInTheSameLocation) return initialState;
    const inventoryLocation =
      initialState.searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return initialState;
    }
    const updatedElements: { [id: string]: CachedElement } = {};
    Object.entries(elementsInTheSameLocation.elements).forEach(
      ([id, cashedElement]) => {
        if (
          cashedElement.element.name == elementToRemove.name &&
          cashedElement.element.environment == elementToRemove.environment &&
          cashedElement.element.stageNumber == elementToRemove.stageNumber &&
          cashedElement.element.system == elementToRemove.system &&
          cashedElement.element.subSystem == elementToRemove.subSystem &&
          cashedElement.element.type == elementToRemove.type
        ) {
          return;
        }
        updatedElements[id] = cashedElement;
      }
    );
    const updatedLocation = Object.entries(updatedElements).length
      ? {
          [elementsLocation]: {
            cacheVersion:
              elementsInTheSameLocation?.cacheVersion ||
              EndevorCacheVersion.UP_TO_DATE,
            elements: {
              ...updatedElements,
            },
          },
        }
      : {};
    return {
      ...initialState,
      caches: {
        ...initialState.caches,
        [toServiceLocationCompositeKey(serviceId)(searchLocationId)]: {
          ...existingCache,
          mapItemsContent: {
            ...existingCache.mapItemsContent,
            ...updatedLocation,
          },
        },
      },
    };
  };

const updateSelectedSubsystemElementReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (elementToUpdate: Omit<Element, 'id'>, outOfDate?: boolean): State => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return initialState;
    const elementsLocation = toSubsystemMapPathId(elementToUpdate);
    const elementLocationNotInMap = !Object.entries(
      existingCache.endevorInventory.endevorMap
    )
      .flatMap(([searchLocationItem, route]) => {
        return [searchLocationItem, ...route];
      })
      .find((mapLocation) => mapLocation === elementsLocation);
    if (elementLocationNotInMap) return initialState;
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[elementsLocation];
    if (!elementsInTheSameLocation) return initialState;
    const inventoryLocation =
      initialState.searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return initialState;
    }
    const updatedElements: { [id: string]: CachedElement } = {};
    Object.entries(elementsInTheSameLocation.elements).forEach(
      ([id, cashedElement]) => {
        if (
          cashedElement.element.name == elementToUpdate.name &&
          cashedElement.element.environment == elementToUpdate.environment &&
          cashedElement.element.stageNumber == elementToUpdate.stageNumber &&
          cashedElement.element.system == elementToUpdate.system &&
          cashedElement.element.subSystem == elementToUpdate.subSystem &&
          cashedElement.element.type == elementToUpdate.type
        ) {
          const outOfDateFlag =
            outOfDate !== undefined && outOfDate !== null
              ? outOfDate
              : elementsInTheSameLocation?.elements[id]?.outOfDate;
          updatedElements[id] = {
            element: {
              ...elementToUpdate,
              lastActionCcid: elementToUpdate.lastActionCcid,
              id: cashedElement.element.id,
              noSource: cashedElement.element.noSource,
              processorGroup:
                elementToUpdate.processorGroup ||
                cashedElement.element.processorGroup,
              vvll: elementToUpdate.vvll || cashedElement.element.vvll,
              signoutId:
                elementToUpdate.signoutId || cashedElement.element.signoutId,
              componentVvll:
                elementToUpdate.componentVvll ||
                cashedElement.element.componentVvll,
            },
            elementIsUpTheMap: cashedElement.elementIsUpTheMap,
            lastRefreshTimestamp: Date.now(),
            outOfDate: outOfDateFlag,
          };
        } else {
          updatedElements[id] = {
            element: cashedElement.element,
            elementIsUpTheMap: cashedElement.elementIsUpTheMap,
            lastRefreshTimestamp: Date.now(),
          };
        }
      }
    );
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
                ...updatedElements,
              },
            },
          },
        },
      },
    };
  };

const updateElementHistoryReducer =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: Element) =>
  (historyData?: ElementHistoryData): State => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return initialState;
    const elementsLocation = toSubsystemMapPathId(element);
    const elementLocationNotInMap = !Object.entries(
      existingCache.endevorInventory.endevorMap
    )
      .flatMap(([searchLocationItem, route]) => {
        return [searchLocationItem, ...route];
      })
      .find((mapLocation) => mapLocation === elementsLocation);
    if (elementLocationNotInMap) return initialState;
    const elementsInTheSameLocation =
      existingCache.mapItemsContent[elementsLocation];
    const existingCachedElement =
      elementsInTheSameLocation?.elements[
        toElementCompositeKey(serviceId)(searchLocationId)(element)
      ];
    if (!existingCachedElement) return initialState;
    existingCachedElement.historyData = historyData;
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
                [toElementCompositeKey(serviceId)(searchLocationId)(element)]:
                  existingCachedElement,
              },
            },
          },
        },
      },
    };
  };

const getExistingCache =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): CacheItem | undefined => {
    const existingService =
      initialState.serviceLocations[toCompositeKey(serviceId)];
    if (!existingService) return;
    if (!initialState.services[toCompositeKey(serviceId)]) return;
    if (
      !Object.keys(existingService.value).includes(
        toCompositeKey(searchLocationId)
      )
    ) {
      return;
    }
    if (!initialState.searchLocations[toCompositeKey(searchLocationId)]) return;
    return initialState.caches[
      toServiceLocationCompositeKey(serviceId)(searchLocationId)
    ];
  };

const getUpdatedEndevorInventory =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (
    endevorMap?: EndevorMap,
    environmentStages?: CachedEnvironmentStages
  ): CachedEndevorInventory | undefined => {
    const existingCache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    const searchLocation =
      state().searchLocations[toCompositeKey(searchLocationId)]?.value;
    const startEnvironmentStage = searchLocation
      ? toEnvironmentStageMapPathId(searchLocation).toUpperCase()
      : undefined;
    return endevorMap && environmentStages
      ? {
          cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          endevorMap,
          environmentStages,
          startEnvironmentStage,
        }
      : existingCache?.endevorInventory === undefined
      ? undefined
      : Object.values(existingCache.endevorInventory.endevorMap).length === 0
      ? undefined
      : existingCache.endevorInventory;
  };

const findUpdatedElements =
  (initialState: State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (
    elements: ReadonlyArray<Element>,
    includeNewElements?: boolean
  ): ReadonlyArray<Element> => {
    const existingCache =
      getExistingCache(initialState)(serviceId)(searchLocationId);
    if (!existingCache) return [];
    return elements.filter((element) => {
      const elementsLocation = toSubsystemMapPathId(element);
      const elementLocationNotInMap = !Object.entries(
        existingCache.endevorInventory.endevorMap
      )
        .flatMap(([searchLocationItem, route]) => {
          return [searchLocationItem, ...route];
        })
        .find((mapLocation) => mapLocation === elementsLocation);
      if (elementLocationNotInMap) return false;
      const elementsInTheSameLocation =
        existingCache.mapItemsContent[elementsLocation];
      const inventoryLocation =
        initialState.searchLocations[toCompositeKey(searchLocationId)];
      if (!inventoryLocation) {
        return false;
      }
      const elementId =
        toElementCompositeKey(serviceId)(searchLocationId)(element);
      const cachedElement = elementsInTheSameLocation?.elements[elementId];
      if (!cachedElement) {
        return includeNewElements;
      }
      return (
        cachedElement.element.processorGroup !== element.processorGroup ||
        cachedElement.element.fingerprint !== element.fingerprint
      );
    });
  };

// public API

export const getAllElementFilterValues =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ReadonlyArray<ElementFilter> => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return [];
    return Object.values(existingFilters).sort(byFilterOrder);
  };

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

export const getElementTypesFilterValue =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): ElementTypesFilter | undefined => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return;
    const filter = existingFilters[ElementFilterType.ELEMENT_TYPES_FILTER];
    if (!filter || !isElementsTypeFilter(filter)) return undefined;
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

export const getEmptyTypesFilterValue =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): EmptyTypesFilter | undefined => {
    const existingFilters =
      state().filters[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!existingFilters) return;
    const filter = existingFilters[ElementFilterType.EMPTY_TYPES_FILTER];
    if (!filter || !isEmptyTypesFilter(filter)) return undefined;
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
  (getCredentialsStorage: () => CredentialsStorage) =>
  async (
    serviceId: EndevorId
  ): Promise<EndevorCredentialDescription | undefined> => {
    const sessionCredential =
      state().sessions[toCompositeKey(serviceId)]?.credential;
    if (sessionCredential && sessionCredential.value) {
      return {
        ...sessionCredential,
        value: sessionCredential.value,
        isPersistent: false,
      };
    }
    const storageCredential = await readCredentialFromStorage(
      getCredentialsStorage
    )(serviceId);
    if (!storageCredential) return;
    return {
      status: sessionCredential
        ? sessionCredential.status
        : EndevorCredentialStatus.UNKNOWN,
      value: storageCredential.value,
      isPersistent: true,
    };
  };

export const getToken =
  (state: () => State) =>
  (getCredentialsStorage: () => CredentialsStorage) =>
  (serviceId: EndevorId) =>
  async (
    configuration: EndevorConfiguration
  ): Promise<EndevorToken | undefined> => {
    const storageCredential = await readCredentialFromStorage(
      getCredentialsStorage
    )(serviceId);
    // check for API ML token first
    if (storageCredential && isBearerTokenCredential(storageCredential.value)) {
      return {
        status: EndevorTokenStatus.ENABLED,
        value: storageCredential.value,
      };
    }
    // otherwise return Endevor token if exists
    const sessionTokens = state().sessions[toCompositeKey(serviceId)]?.tokens;
    if (!sessionTokens) return;
    return sessionTokens[configuration];
  };

export const getAllServiceDescriptions =
  (state: () => State) =>
  async (
    getCredentialsStorage: () => CredentialsStorage
  ): Promise<EndevorServiceDescriptions> => {
    return (
      await Promise.all(
        Object.entries(state().serviceLocations).map(
          async ([serviceKey, serviceLocation]) => ({
            serviceKey,
            serviceId: serviceLocation.id,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              serviceLocation.id
            ),
          })
        )
      )
    ).reduce(
      (
        acc: EndevorServiceDescriptions,
        { serviceKey, serviceId, credential }
      ) => {
        const service = state().services[serviceKey];
        if (!service) {
          acc[serviceKey] = toNonExistingServiceDescription(state)(serviceId);
          return acc;
        }
        acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
          ...service,
          credential,
        });
        return acc;
      },
      {}
    );
  };

export const getAllExistingServiceDescriptions =
  (state: () => State) =>
  async (
    getCredentialsStorage: () => CredentialsStorage
  ): Promise<ExistingEndevorServiceDescriptions> => {
    return (
      await Promise.all(
        Object.entries(state().services).map(async ([serviceKey, service]) => {
          if (!service) return;
          return {
            serviceKey,
            service,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              service.id
            ),
          };
        })
      )
    )
      .filter(isDefined)
      .reduce(
        (
          acc: ExistingEndevorServiceDescriptions,
          { serviceKey, service, credential }
        ) => {
          if (!service) return acc;
          acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
            ...service,
            credential,
          });
          return acc;
        },
        {}
      );
  };

export const getExistingUnusedServiceDescriptions =
  (state: () => State) =>
  async (
    getCredentialsStorage: () => CredentialsStorage
  ): Promise<ExistingEndevorServiceDescriptions> => {
    const usedServices = Object.keys(state().serviceLocations);
    return (
      await Promise.all(
        Object.entries(state().services)
          .filter(([serviceKey]) => !usedServices.includes(serviceKey))
          .map(async ([serviceKey, service]) => {
            if (!service) return;
            return {
              serviceKey,
              service,
              credential: await readCredentialFromStorage(
                getCredentialsStorage
              )(service.id),
            };
          })
      )
    )
      .filter(isDefined)
      .reduce(
        (
          acc: ExistingEndevorServiceDescriptions,
          { serviceKey, service, credential }
        ) => {
          if (!service) return acc;
          acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
            ...service,
            credential,
          });
          return acc;
        },
        {}
      );
  };

export const getExistingUsedServiceDescriptions =
  (state: () => State) =>
  async (
    getCredentialsStorage: () => CredentialsStorage
  ): Promise<ExistingEndevorServiceDescriptions> => {
    return (
      await Promise.all(
        Object.entries(state().serviceLocations).map(
          async ([serviceKey, serviceLocation]) => ({
            serviceKey,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              serviceLocation.id
            ),
          })
        )
      )
    ).reduce(
      (acc: ExistingEndevorServiceDescriptions, { serviceKey, credential }) => {
        const service = state().services[serviceKey];
        if (!service) return acc;
        acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
          ...service,
          credential,
        });
        return acc;
      },
      {}
    );
  };

export const getExistingServiceDescriptionsBySearchLocationId =
  (state: () => State) =>
  (getCredentialsStorage: () => CredentialsStorage) =>
  async (
    searchLocationId: EndevorId
  ): Promise<ExistingEndevorServiceDescriptions> => {
    return (
      await Promise.all(
        Object.entries(state().serviceLocations)
          .filter(([, value]) => value.value[toCompositeKey(searchLocationId)])
          .map(async ([serviceKey, serviceLocation]) => ({
            serviceKey,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              serviceLocation.id
            ),
          }))
      )
    ).reduce(
      (acc: ExistingEndevorServiceDescriptions, { serviceKey, credential }) => {
        const service = state().services[serviceKey];
        if (!service) return acc;
        acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
          ...service,
          credential,
        });
        return acc;
      },
      {}
    );
  };

export const getAllServiceDescriptionsBySearchLocationId =
  (state: () => State) =>
  (getCredentialsStorage: () => CredentialsStorage) =>
  async (searchLocationId: EndevorId): Promise<EndevorServiceDescriptions> => {
    return (
      await Promise.all(
        Object.entries(state().serviceLocations)
          .filter(([, value]) => value.value[toCompositeKey(searchLocationId)])
          .map(async ([serviceKey, serviceLocation]) => ({
            serviceKey,
            serviceId: serviceLocation.id,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              serviceLocation.id
            ),
          }))
      )
    ).reduce(
      (
        acc: EndevorServiceDescriptions,
        { serviceKey, serviceId, credential }
      ) => {
        const service = state().services[serviceKey];
        if (!service) {
          acc[serviceKey] = toNonExistingServiceDescription(state)(serviceId);
          return acc;
        }
        acc[serviceKey] = toExistingServiceDescription(state)(serviceKey, {
          ...service,
          credential,
        });
        return acc;
      },
      {}
    );
  };

export const getAllServiceLocations =
  (state: () => State) =>
  async (
    getCredentialsStorage: () => CredentialsStorage
  ): Promise<EndevorServiceLocations> => {
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
    return (
      await Promise.all(
        Object.entries(state().serviceLocations).map(
          async ([serviceKey, serviceLocation]) => ({
            serviceKey,
            serviceLocation,
            credential: await readCredentialFromStorage(getCredentialsStorage)(
              serviceLocation.id
            ),
          })
        )
      )
    ).reduce(
      (
        acc: EndevorServiceLocations,
        { serviceKey, serviceLocation, credential }
      ) => {
        const service = state().services[serviceKey];
        if (!service) {
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
        }
        const serviceDescription = toExistingServiceDescription(state)(
          serviceKey,
          {
            ...service,
            credential,
          }
        );
        acc[serviceKey] = {
          ...serviceDescription,
          value: toSearchLocationDescriptions(serviceLocation.value)(
            service.id
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
  (searchLocationId: EndevorId): SearchLocation | undefined => {
    const inventoryLocation =
      state().searchLocations[toCompositeKey(searchLocationId)];
    if (!inventoryLocation) {
      return;
    }
    return normalizeSearchLocation(inventoryLocation.value);
  };

export const getEndevorConfigurationBySearchLocationId =
  (state: () => State) =>
  (searchLocationId: EndevorId): EndevorConfiguration | undefined => {
    return state().searchLocations[toCompositeKey(searchLocationId)]?.value
      .configuration;
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
    let filteredElements: ReadonlyArray<CachedElement> = cachedElements;
    getAllElementFilterValues(state)(serviceId)(searchLocationId).forEach(
      (filter) => {
        filteredElements = getAllFilteredElements(filteredElements)(filter);
      }
    );
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
    const elementsPerRoute = Object.keys(
      cache.endevorInventory.endevorMap
    ).reduce((acc: RoutesAccum, inPlaceLocation) => {
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
    }, {});
    const mapVersion = cache.endevorInventory.cacheVersion;
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
      Object.entries(cache.endevorInventory.endevorMap).reduce(
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
              elementsInRoute[
                `${element.element.type}/${element.element.name}`
              ] = element;
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
    const mapVersion = cache.endevorInventory.cacheVersion;
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

export const getElement =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: Element): CachedElement | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache) {
      return undefined;
    }
    const elementLocation = toSubsystemMapPathId(element);
    const elementsInLocation = cache.mapItemsContent[elementLocation];
    return elementsInLocation?.elements[
      toElementCompositeKey(serviceId)(searchLocationId)(element)
    ];
  };

export const getElementHistoryData =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: Element): ElementHistoryData | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache) {
      return undefined;
    }
    const elementLocation = toSubsystemMapPathId(element);
    const elementsInLocation = cache.mapItemsContent[elementLocation];
    return elementsInLocation?.elements[
      toElementCompositeKey(serviceId)(searchLocationId)(element)
    ]?.historyData;
  };

export const getEndevorInventory =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): CachedEndevorInventory | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    return cache?.endevorInventory;
  };

export const getEndevorEnvironmentStages =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): CachedEnvironmentStages | undefined => {
    const cache =
      state().caches[
        toServiceLocationCompositeKey(serviceId)(searchLocationId)
      ];
    if (!cache?.endevorInventory) {
      return;
    }
    return cache.endevorInventory.environmentStages;
  };

export const getFilteredEndevorTypes =
  (state: () => State) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): CachedTypes | undefined => {
    const existingEnvironmentStages =
      getEndevorEnvironmentStages(state)(serviceId)(searchLocationId);
    if (!existingEnvironmentStages) {
      return;
    }
    const filter =
      getElementTypesFilterValue(state)(serviceId)(searchLocationId);
    return Object.values(existingEnvironmentStages).reduce(
      (acc: { [id: string]: ElementType }, environmentStage) => {
        Object.values(environmentStage.systems).forEach((system) => {
          Object.entries(system.types)
            .filter(([, type]) => !filter || typeMatchesFilter(type)(filter))
            .forEach(([id, type]) => (acc[id] = type));
        });
        return acc;
      },
      {}
    );
  };

export const getActivityRecords = (state: () => State): ActivityRecords =>
  state().activityEntries;
