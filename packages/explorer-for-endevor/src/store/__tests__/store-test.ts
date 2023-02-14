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

/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Element, SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import { toSubsystemMapPathId } from '../../_doc/Endevor';
import { toCompositeKey } from '../storage/utils';
import {
  ConnectionLocationsStorage,
  ConnectionsStorage,
  CredentialsStorage,
  InventoryLocationsStorage,
  Source,
  StorageGetters,
} from '../storage/_doc/Storage';
import {
  getElementsInPlace,
  getFirstFoundElements,
  make as makeStore,
} from '../store';
import { toElementCompositeKey, toServiceLocationCompositeKey } from '../utils';
import { Actions } from '../_doc/Actions';
import {
  CachedElement,
  CachedElements,
  EndevorCacheVersion,
  EndevorId,
  State,
} from '../_doc/v2/Store';

jest.mock('vscode', () => ({}), { virtual: true });
jest.mock(
  '../../globals',
  () => ({
    logger: {
      trace: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    reporter: {
      sendTelemetryEvent: jest.fn(),
    },
  }),
  { virtual: true }
);

describe('store actions callbacks', () => {
  describe('elements in place fetched callback', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    const readOnlyConnectionLocationStorage: ConnectionLocationsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {
              [toCompositeKey(inventoryLocationId)]: {
                id: inventoryLocationId,
              },
            },
          },
        };
      },
    } as unknown as ConnectionLocationsStorage;
    const readOnlyConnectionsStorage: ConnectionsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {},
          },
        };
      },
    } as unknown as ConnectionsStorage;
    const readOnlyInventoryLocationsStorage: InventoryLocationsStorage = {
      get() {
        return {
          [toCompositeKey(inventoryLocationId)]: {
            id: inventoryLocationId,
            value: {},
          },
        };
      },
    } as unknown as InventoryLocationsStorage;
    const emptyCredentialStorage: CredentialsStorage = {
      get() {
        return undefined;
      },
    } as unknown as CredentialsStorage;
    const mockedGetters: StorageGetters = {
      getConnectionLocationsStorage: () => readOnlyConnectionLocationStorage,
      getConnectionsStorage: () => readOnlyConnectionsStorage,
      getCredentialsStorage: () => emptyCredentialStorage,
      getInventoryLocationsStorage: () => readOnlyInventoryLocationsStorage,
    };
    it('should put elements using existing map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const elementsInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(elementsInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...elementsInPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_IN_PLACE_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const actualElements =
        actualCache?.mapItemsContent[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ];
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });
    });
    it('should put elements using provided map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      // act
      const elementsInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...elementsInPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      const anotherInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      await dispatch({
        type: Actions.ELEMENTS_IN_PLACE_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        subSystemsInPlace: [elementsInPlaceLocation, anotherInPlaceLocation],
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const actualElements =
        actualCache?.mapItemsContent[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ];
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });

      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]?.length
      ).toEqual(0);
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(anotherInPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(anotherInPlaceLocation)
        ]?.length
      ).toEqual(0);
    });
    it('should overwrite existing map structure with provided action map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const outdatedLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(outdatedLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementsInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...elementsInPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_IN_PLACE_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        subSystemsInPlace: [elementsInPlaceLocation],
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]?.length
      ).toEqual(0);

      expect(
        actualCache?.endevorMap.value[toSubsystemMapPathId(outdatedLocation)]
      ).toBeUndefined();
    });
    it('should put elements creating map structure on the fly', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      // act
      const elementsInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...elementsInPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_IN_PLACE_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const actualElements =
        actualCache?.mapItemsContent[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ];
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });

      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorMap.value[
          toSubsystemMapPathId(elementsInPlaceLocation)
        ]?.length
      ).toEqual(0);
    });
    it('should overwrite all elements within the whole search location cache', async () => {
      // arrange
      const searchLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const existingElement: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...searchLocation,
          type: 'TEST-TYPE',
          name: 'EXISTING-ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(searchLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(searchLocation)]: {
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  existingElement.element
                )]: existingElement,
              },
              // any version
              cacheVersion: EndevorCacheVersion.OUTDATED,
            },
          },
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...searchLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_IN_PLACE_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualElements =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.mapItemsContent[toSubsystemMapPathId(searchLocation)];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(Object.keys(actualElements!.elements).length).toEqual(
        Object.keys(fetchedElements).length
      );
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });
      expect(
        actualElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            existingElement.element
          )
        ]
      ).toBeUndefined();
    });
  });
  describe('elements up the map fetched callback', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    const readOnlyConnectionLocationStorage: ConnectionLocationsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {
              [toCompositeKey(inventoryLocationId)]: {
                id: inventoryLocationId,
              },
            },
          },
        };
      },
    } as unknown as ConnectionLocationsStorage;
    const readOnlyConnectionsStorage: ConnectionsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {},
          },
        };
      },
    } as unknown as ConnectionsStorage;
    const readOnlyInventoryLocationsStorage: InventoryLocationsStorage = {
      get() {
        return {
          [toCompositeKey(inventoryLocationId)]: {
            id: inventoryLocationId,
            value: {},
          },
        };
      },
    } as unknown as InventoryLocationsStorage;
    const emptyCredentialStorage: CredentialsStorage = {
      get() {
        return undefined;
      },
    } as unknown as CredentialsStorage;
    const mockedGetters: StorageGetters = {
      getConnectionLocationsStorage: () => readOnlyConnectionLocationStorage,
      getConnectionsStorage: () => readOnlyConnectionsStorage,
      getCredentialsStorage: () => emptyCredentialStorage,
      getInventoryLocationsStorage: () => readOnlyInventoryLocationsStorage,
    };
    it('should put elements using existing map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [
                toSubsystemMapPathId(upTheMapLocation),
              ],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const inPlaceElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(inPlaceElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementInPlace.element
          )
        ]
      ).toBeDefined();

      const upTheMapElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(upTheMapLocation)];
      expect(
        upTheMapElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementUpTheMap.element
          )
        ]
      ).toBeDefined();
    });
    it('should put elements with version from the existing map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      const endevorMapCacheVersion = EndevorCacheVersion.OUTDATED;
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [
                toSubsystemMapPathId(upTheMapLocation),
              ],
            },
            cacheVersion: endevorMapCacheVersion,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const inPlaceElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(inPlaceElements?.cacheVersion).toEqual(endevorMapCacheVersion);
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementInPlace.element
          )
        ]
      ).toBeDefined();

      const upTheMapElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(upTheMapLocation)];
      expect(
        upTheMapElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementUpTheMap.element
          )
        ]
      ).toBeDefined();
    });
    it('should put elements only for locations from the known map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementFromDifferentRoute: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          system: 'SYSSSS',
          type: 'TEST-TYPE',
          name: 'I"m from different system',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementFromDifferentRoute.element
        )]: elementFromDifferentRoute,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache).toBeDefined();
      expect(
        Object.keys(actualCache ? actualCache.mapItemsContent : {}).length
      ).toEqual(1);

      const inPlaceElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementInPlace.element
          )
        ]
      ).toBeDefined();
    });
    it('should not put elements without map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache).toBeUndefined();
    });
    it('should not put elements with empty map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {},
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache).toEqual({
        endevorMap: {
          value: {},
          cacheVersion: EndevorCacheVersion.UP_TO_DATE,
        },
        mapItemsContent: {},
      });
    });
    it('should put elements using provided map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: {
          [toSubsystemMapPathId(inPlaceLocation)]: [
            toSubsystemMapPathId(upTheMapLocation),
          ],
        },
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const inPlaceElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(inPlaceElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementInPlace.element
          )
        ]
      ).toBeDefined();

      const upTheMapElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(upTheMapLocation)];
      expect(upTheMapElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        upTheMapElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementUpTheMap.element
          )
        ]
      ).toBeDefined();
    });
    it('should overwrite existing map structure with provided action map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const upTheMapLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId({
                environment: 'SOME_ENV',
                stageNumber: '2',
                system: 'SYSYSSSS',
                subSystem: 'TEST',
              })]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementUpTheMap.element
        )]: elementUpTheMap,
      };
      const fetchedMap = {
        [toSubsystemMapPathId(inPlaceLocation)]: [
          toSubsystemMapPathId(upTheMapLocation),
        ],
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: fetchedMap,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.value).toEqual(fetchedMap);
    });
    it('should overwrite all elements within the whole search location cache', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const nonRelatedLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS3',
      };
      const outdatedInPlaceElement: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'I"m outdated :(',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const nonRelatedElement: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...nonRelatedLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [],
              [toSubsystemMapPathId(nonRelatedLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  outdatedInPlaceElement.element
                )]: outdatedInPlaceElement,
              },
            },
            [toSubsystemMapPathId(nonRelatedLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  nonRelatedElement.element
                )]: nonRelatedElement,
              },
            },
          },
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          configuration: 'CONFIG',
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          lastActionCcid: 'LAST-CCID',
        },
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_UP_THE_MAP_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const inPlaceElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            elementInPlace.element
          )
        ]
      ).toBeDefined();
      expect(
        inPlaceElements?.elements[
          toElementCompositeKey(serviceId)(inventoryLocationId)(
            outdatedInPlaceElement.element
          )
        ]
      ).toBeUndefined();

      const otherElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(nonRelatedLocation)];
      expect(otherElements).toBeUndefined();
    });
  });
  describe('refresh cache callback', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    const readOnlyConnectionLocationStorage: ConnectionLocationsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {
              [toCompositeKey(inventoryLocationId)]: {
                id: inventoryLocationId,
              },
            },
          },
        };
      },
    } as unknown as ConnectionLocationsStorage;
    const readOnlyConnectionsStorage: ConnectionsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {},
          },
        };
      },
    } as unknown as ConnectionsStorage;
    const readOnlyInventoryLocationsStorage: InventoryLocationsStorage = {
      get() {
        return {
          [toCompositeKey(inventoryLocationId)]: {
            id: inventoryLocationId,
            value: {},
          },
        };
      },
    } as unknown as InventoryLocationsStorage;
    const emptyCredentialStorage: CredentialsStorage = {
      get() {
        return undefined;
      },
    } as unknown as CredentialsStorage;
    const mockedGetters: StorageGetters = {
      getConnectionLocationsStorage: () => readOnlyConnectionLocationStorage,
      getConnectionsStorage: () => readOnlyConnectionsStorage,
      getCredentialsStorage: () => emptyCredentialStorage,
      getInventoryLocationsStorage: () => readOnlyInventoryLocationsStorage,
    };
    it('should make only the elements outdated for the service location', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const location: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const element: Element = {
        configuration: 'TEST',
        ...location,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(location)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(location)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  element
                )]: cachedElementVersion,
              },
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.REFRESH,
      });
      // assert
      expect(
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.endevorMap.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
      expect(
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.mapItemsContent[toSubsystemMapPathId(location)]?.cacheVersion
      ).toEqual(EndevorCacheVersion.OUTDATED);
    });
    it('should make the empty location node outdated for the service location', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const emptyLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(emptyLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.REFRESH,
      });
      // assert
      expect(
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.mapItemsContent[toSubsystemMapPathId(emptyLocation)]?.cacheVersion
      ).toEqual(EndevorCacheVersion.OUTDATED);
    });
    it('should make the empty map outdated for the service location', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {},
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      await dispatch({
        type: Actions.REFRESH,
      });
      // assert
      expect(
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.endevorMap.cacheVersion
      ).toEqual(EndevorCacheVersion.OUTDATED);
    });
  });
  describe('elements fetch failed callback', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    const readOnlyConnectionLocationStorage: ConnectionLocationsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {
              [toCompositeKey(inventoryLocationId)]: {
                id: inventoryLocationId,
              },
            },
          },
        };
      },
    } as unknown as ConnectionLocationsStorage;
    const readOnlyConnectionsStorage: ConnectionsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {},
          },
        };
      },
    } as unknown as ConnectionsStorage;
    const readOnlyInventoryLocationsStorage: InventoryLocationsStorage = {
      get() {
        return {
          [toCompositeKey(inventoryLocationId)]: {
            id: inventoryLocationId,
            value: {},
          },
        };
      },
    } as unknown as InventoryLocationsStorage;
    const emptyCredentialStorage: CredentialsStorage = {
      get() {
        return undefined;
      },
    } as unknown as CredentialsStorage;
    const mockedGetters: StorageGetters = {
      getConnectionLocationsStorage: () => readOnlyConnectionLocationStorage,
      getConnectionsStorage: () => readOnlyConnectionsStorage,
      getCredentialsStorage: () => emptyCredentialStorage,
      getInventoryLocationsStorage: () => readOnlyInventoryLocationsStorage,
    };
    it('should mark the existing elements and map up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const location: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const element: Element = {
        configuration: 'TEST',
        ...location,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(location)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(location)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  element
                )]: cachedElementVersion,
              },
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_FAILED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(location)]
          ?.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
    });
    it('should mark the empty location node up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const emptyLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(emptyLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {},
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_FAILED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(emptyLocation)]
          ?.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
    });
    it('should mark the existing empty cache value up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            cacheVersion: EndevorCacheVersion.OUTDATED,
            value: {},
          },
          mapItemsContent: {},
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_FAILED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
    });
    it('should create an up to date cache value', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_FAILED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(actualCache?.mapItemsContent).toEqual({});
    });
  });
  describe('elements fetch cancelled callback', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    const readOnlyConnectionLocationStorage: ConnectionLocationsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {
              [toCompositeKey(inventoryLocationId)]: {
                id: inventoryLocationId,
              },
            },
          },
        };
      },
    } as unknown as ConnectionLocationsStorage;
    const readOnlyConnectionsStorage: ConnectionsStorage = {
      get() {
        return {
          [toCompositeKey(serviceId)]: {
            id: serviceId,
            value: {},
          },
        };
      },
    } as unknown as ConnectionsStorage;
    const readOnlyInventoryLocationsStorage: InventoryLocationsStorage = {
      get() {
        return {
          [toCompositeKey(inventoryLocationId)]: {
            id: inventoryLocationId,
            value: {},
          },
        };
      },
    } as unknown as InventoryLocationsStorage;
    const emptyCredentialStorage: CredentialsStorage = {
      get() {
        return undefined;
      },
    } as unknown as CredentialsStorage;
    const mockedGetters: StorageGetters = {
      getConnectionLocationsStorage: () => readOnlyConnectionLocationStorage,
      getConnectionsStorage: () => readOnlyConnectionsStorage,
      getCredentialsStorage: () => emptyCredentialStorage,
      getInventoryLocationsStorage: () => readOnlyInventoryLocationsStorage,
    };
    it('should mark the existing elements and map up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const location: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const element: Element = {
        configuration: 'TEST',
        ...location,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(location)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(location)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  element
                )]: cachedElementVersion,
              },
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_CANCELED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(location)]
          ?.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
    });
    it('should mark the empty location node up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      const emptyLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(emptyLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {},
            },
          },
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_CANCELED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(emptyLocation)]
          ?.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
    });
    it('should mark the existing empty cache value up to date', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            cacheVersion: EndevorCacheVersion.OUTDATED,
            value: {},
          },
          mapItemsContent: {},
        },
      };
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_CANCELED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
    });
    it('should create an up to date cache value', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        }
      );
      // act
      await dispatch({
        type: Actions.ELEMENTS_FETCH_CANCELED,
        serviceId,
        searchLocationId: inventoryLocationId,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorMap.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(actualCache?.mapItemsContent).toEqual({});
    });
  });
});

describe('store getters', () => {
  describe('getting elements in place', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    it('should return elements from a particular route', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: Element = {
        configuration: 'TEST',
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element: elementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementInPlace
                )]: cachedElementVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[toSubsystemMapPathId(inPlaceLocation)]
      ).toEqual([cachedElementVersion]);
    });
    it('should return elements from several routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        configuration: 'TEST',
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstElementVersion = {
        element: firstElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      const secondElementInPlace: Element = {
        configuration: 'TEST',
        ...secondInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedSecondElementVersion = {
        element: secondElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  firstElementInPlace
                )]: cachedFirstElementVersion,
              },
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  secondElementInPlace
                )]: cachedSecondElementVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(firstInPlaceLocation)
        ]
      ).toEqual([cachedFirstElementVersion]);
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(secondInPlaceLocation)
        ]
      ).toEqual([cachedSecondElementVersion]);
    });
    it('should return the worst cache version from several routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {},
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.OUTDATED
      );
    });
    it('should return the worst cache version from the map structure', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.OUTDATED
      );
    });
    it('should return all existing map routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        configuration: 'TEST',
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstElementVersion = {
        element: firstElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  firstElementInPlace
                )]: cachedFirstElementVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(firstInPlaceLocation)
        ]
      ).toEqual([cachedFirstElementVersion]);
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(emptyInPlaceLocation)
        ]
      ).toEqual([]);
    });
    it('should return empty elements list', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(emptyInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(emptyInPlaceLocation)
        ]
      ).toEqual([]);
    });
    it('should return just the cache version', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {},
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const actualElements = getElementsInPlace(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements).toEqual({
        cacheVersion: EndevorCacheVersion.UP_TO_DATE,
        elementsPerRoute: {},
      });
    });
  });
  describe('getting first found elements', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    it('should return elements from a particular route', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: Element = {
        configuration: 'TEST',
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedInPlaceElementVersion = {
        element: elementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const upTheMapFirstLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      const elementUpTheMapOne: Element = {
        configuration: 'TEST',
        ...upTheMapFirstLocation,
        type: elementInPlace.type,
        name: elementInPlace.name,
        lastActionCcid: 'LAST-CCID',
      };
      const elementUpTheMapTwo: Element = {
        configuration: 'TEST',
        ...upTheMapFirstLocation,
        type: elementInPlace.type,
        name: 'ELM2',
        lastActionCcid: 'LAST-CCID',
      };
      const elementUpTheMapThree: Element = {
        configuration: 'TEST',
        ...upTheMapFirstLocation,
        type: 'TYPE2',
        name: elementUpTheMapTwo.name,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedUpTheMapElementOneVersion = {
        element: elementUpTheMapOne,
        lastRefreshTimestamp: Date.now(),
      };
      const cachedUpTheMapElementTwoVersion = {
        element: elementUpTheMapTwo,
        lastRefreshTimestamp: Date.now(),
      };
      const cachedUpTheMapElementThreeVersion = {
        element: elementUpTheMapThree,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(inPlaceLocation)]: [
                toSubsystemMapPathId(upTheMapFirstLocation),
              ],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementInPlace
                )]: cachedInPlaceElementVersion,
              },
            },
            [toSubsystemMapPathId(upTheMapFirstLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementUpTheMapOne
                )]: cachedUpTheMapElementOneVersion,
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementUpTheMapTwo
                )]: cachedUpTheMapElementTwoVersion,
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementUpTheMapThree
                )]: cachedUpTheMapElementThreeVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[toSubsystemMapPathId(inPlaceLocation)]
      ).toEqual([
        cachedInPlaceElementVersion,
        cachedUpTheMapElementTwoVersion,
        cachedUpTheMapElementThreeVersion,
      ]);
    });
    it('should return elements from several independent routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        configuration: 'TEST',
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      const secondElementInPlace: Element = {
        configuration: 'TEST',
        ...secondInPlaceLocation,
        type: 'TYPE2',
        name: 'ELM2',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedSecondElementInPlaceVersion = {
        element: secondElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  firstElementInPlace
                )]: cachedFirstInPlaceElementVersion,
              },
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  secondElementInPlace
                )]: cachedSecondElementInPlaceVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(firstInPlaceLocation)
        ]
      ).toEqual([cachedFirstInPlaceElementVersion]);
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(secondInPlaceLocation)
        ]
      ).toEqual([cachedSecondElementInPlaceVersion]);
    });
    it('should return elements from several routes with common root', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        configuration: 'TEST',
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const emptySecondInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        subSystem: 'SUBSYS2',
      };
      const commonUpTheMapLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        stageNumber: '2',
      };
      const elementUpTheMap: Element = {
        configuration: 'TEST',
        ...commonUpTheMapLocation,
        type: firstElementInPlace.type,
        name: firstElementInPlace.name,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedUpTheMapElementVersion = {
        element: elementUpTheMap,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [
                toSubsystemMapPathId(commonUpTheMapLocation),
              ],
              [toSubsystemMapPathId(emptySecondInPlaceLocation)]: [
                toSubsystemMapPathId(commonUpTheMapLocation),
              ],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  firstElementInPlace
                )]: cachedFirstInPlaceElementVersion,
              },
            },
            [toSubsystemMapPathId(commonUpTheMapLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  elementUpTheMap
                )]: cachedUpTheMapElementVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(firstInPlaceLocation)
        ]
      ).toEqual([cachedFirstInPlaceElementVersion]);
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(emptySecondInPlaceLocation)
        ]
      ).toEqual([cachedUpTheMapElementVersion]);
    });
    it('should return the worst cache version from several routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {},
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.OUTDATED
      );
    });
    it('should return the worst cache version from the existing map structure', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
            [toSubsystemMapPathId(secondInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.OUTDATED
      );
    });
    it('should return all map routes', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        configuration: 'TEST',
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        lastRefreshTimestamp: Date.now(),
      };
      const secondEmptyInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondEmptyInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(firstInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.OUTDATED,
              elements: {
                [toElementCompositeKey(serviceId)(inventoryLocationId)(
                  firstElementInPlace
                )]: cachedFirstInPlaceElementVersion,
              },
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(firstInPlaceLocation)
        ]
      ).toEqual([cachedFirstInPlaceElementVersion]);
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(secondEmptyInPlaceLocation)
        ]
      ).toEqual([]);
    });
    it('should return empty elements list', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {
            [toSubsystemMapPathId(emptyInPlaceLocation)]: {
              cacheVersion: EndevorCacheVersion.UP_TO_DATE,
              elements: {},
            },
          },
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(emptyInPlaceLocation)
        ]
      ).toEqual([]);
    });
    it('should return empty elements list for map items', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {},
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(
        actualElements?.elementsPerRoute[
          toSubsystemMapPathId(emptyInPlaceLocation)
        ]
      ).toEqual([]);
    });
    it('should return just the cache version', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorMap: {
            value: {},
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const actualElements = getFirstFoundElements(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualElements).toEqual({
        cacheVersion: EndevorCacheVersion.UP_TO_DATE,
        elementsPerRoute: {},
      });
    });
  });
});
