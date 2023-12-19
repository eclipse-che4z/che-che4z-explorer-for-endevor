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

/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  Element,
  ElementType,
  EnvironmentStage,
  SubSystem,
  SubSystemMapPath,
  System,
} from '@local/endevor/_doc/Endevor';
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
  getFilteredEndevorTypes,
  getFirstFoundElements,
  make as makeStore,
} from '../store';
import {
  createEndevorInventory,
  toElementCompositeKey,
  toEnvironmentStageMapPathId,
  toServiceLocationCompositeKey,
  toSubsystemMapPathId,
  toTypeMapPathId,
} from '../utils';
import { Actions } from '../_doc/Actions';
import {
  CachedElement,
  CachedElements,
  CachedEndevorInventory,
  ElementFilterType,
  EndevorCacheVersion,
  EndevorId,
  State,
} from '../_doc/v2/Store';
import { EndevorMap } from '../../api/_doc/Endevor';

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
jest.mock('../../utils');

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
const typeInPlace: ElementType = {
  ...inPlaceLocation,
  type: 'TESTTYPE',
  nextType: 'NEXTTYPE',
};
const typeUpTheMap: ElementType = {
  ...typeInPlace,
  stageNumber: '2',
};
const inPlaceSubsystem: SubSystem = {
  ...inPlaceLocation,
  nextSubSystem: 'NEXTSUB',
};
const upTheMapSubsystem: SubSystem = {
  ...inPlaceSubsystem,
  stageNumber: '2',
};
const inPlaceSystem: System = {
  ...inPlaceLocation,
  nextSystem: 'NEXTSYS',
};
const upTheMapSystem: System = {
  ...inPlaceSystem,
  stageNumber: '2',
};
const inPlaceEnvStage: EnvironmentStage = {
  environment: 'ENV',
  stageNumber: '1',
};
const upTheMapEnvStage: EnvironmentStage = {
  environment: 'ENV',
  stageNumber: '2',
};

const makeEndevorInventory = (
  useDefaultInPlace: boolean,
  useDefaultUpTheMap: boolean,
  cacheVersion?: EndevorCacheVersion,
  additionalInventory?: {
    environmentStages?: EnvironmentStage[];
    systems?: System[];
    subsystems?: SubSystem[];
    types?: ElementType[];
  }
): CachedEndevorInventory => {
  const invEnvStages = additionalInventory?.environmentStages || [];
  const invSystems = additionalInventory?.systems || [];
  const invSubsystems = additionalInventory?.subsystems || [];
  const invTypes = additionalInventory?.types || [];
  const route = [];
  if (useDefaultInPlace) {
    invSubsystems.unshift(inPlaceSubsystem);
    invSystems.unshift(inPlaceSystem);
    invEnvStages.unshift(inPlaceEnvStage);
    invTypes.unshift(typeInPlace);
    route.push(toSubsystemMapPathId(inPlaceSubsystem));
  }
  if (useDefaultUpTheMap) {
    invSubsystems.unshift(upTheMapSubsystem);
    invSystems.unshift(upTheMapSystem);
    invEnvStages.unshift(upTheMapEnvStage);
    invTypes.unshift(typeUpTheMap);
    route.push(toSubsystemMapPathId(upTheMapSubsystem));
  }
  const endevorMap: EndevorMap = {
    [toSubsystemMapPathId(inPlaceSubsystem)]: route,
  };
  return {
    endevorMap,
    environmentStages: createEndevorInventory(
      invEnvStages,
      invSystems,
      invSubsystems,
      invTypes
    ),
    cacheVersion: cacheVersion || EndevorCacheVersion.UP_TO_DATE,
  };
};

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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, false),
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };

      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
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
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      // act
      const anotherInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'OTHERSYS',
        subSystem: 'OTHERSUB',
      };
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      const endevorInventory = makeEndevorInventory(true, true);
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: {
          ...endevorInventory.endevorMap,
          [toSubsystemMapPathId(anotherInPlaceLocation)]: [],
        },
        environmentStages: endevorInventory.environmentStages,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const actualElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });

      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]?.length
      ).toEqual(2);
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(anotherInPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorInventory.endevorMap[
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(outdatedLocation)]: [],
            },
            environmentStages: {},
            cacheVersion: EndevorCacheVersion.OUTDATED,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      const endevorInventory = makeEndevorInventory(true, true);
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: endevorInventory.endevorMap,
        environmentStages: endevorInventory.environmentStages,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]?.length
      ).toEqual(2);

      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(outdatedLocation)
        ]
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      const endevorInventory = makeEndevorInventory(true, true);
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: endevorInventory.endevorMap,
        environmentStages: endevorInventory.environmentStages,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];

      const actualElements =
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)];
      expect(actualElements?.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      Object.keys(fetchedElements).forEach((elementId) => {
        expect(actualElements?.elements[elementId]).toBeDefined();
      });

      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]
      ).toBeDefined();
      expect(
        actualCache?.endevorInventory.endevorMap[
          toSubsystemMapPathId(inPlaceLocation)
        ]?.length
      ).toEqual(2);
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const existingElement: CachedElement = {
        element: {
          ...searchLocation,
          type: 'TEST-TYPE',
          name: 'EXISTING-ELM',
          id: 'EXISTING-ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, false),
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
          ...searchLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, true),
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
        type: Actions.ELEMENTS_FETCHED,
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const endevorMapCacheVersion = EndevorCacheVersion.OUTDATED;
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            true,
            endevorMapCacheVersion
          ),
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
        type: Actions.ELEMENTS_FETCHED,
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
    it('should not put elements without map structure', async () => {
      // arrange
      let storeState: State = {
        filters: {},
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
        type: Actions.ELEMENTS_FETCHED,
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {},
            environmentStages: {},
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
        type: Actions.ELEMENTS_FETCHED,
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
        endevorInventory: {
          endevorMap: {},
          environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
      const endevorInventory = makeEndevorInventory(true, true);
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: endevorInventory.endevorMap,
        environmentStages: endevorInventory.environmentStages,
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const originalEnvStage: EnvironmentStage = {
        environment: 'SOME_ENV',
        stageNumber: '2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId({
                ...originalEnvStage,
                system: 'SYSYSSSS',
                subSystem: 'TEST',
              })]: [],
            },
            environmentStages: {
              [toEnvironmentStageMapPathId(originalEnvStage)]: {
                environmentStage: originalEnvStage,
                systems: {},
              },
            },
            cacheVersion: EndevorCacheVersion.UP_TO_DATE,
          },
          mapItemsContent: {},
        },
      };
      // act
      const elementInPlace: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const elementUpTheMap: CachedElement = {
        element: {
          ...upTheMapLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: true,
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
      const endevorInventory = makeEndevorInventory(true, true);
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
        serviceId,
        searchLocationId: inventoryLocationId,
        elements: fetchedElements,
        endevorMap: endevorInventory.endevorMap,
        environmentStages: endevorInventory.environmentStages,
      });
      // assert
      const actualCache =
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ];
      expect(actualCache?.endevorInventory.endevorMap).toEqual(
        endevorInventory.endevorMap
      );
      expect(actualCache?.endevorInventory.environmentStages).toEqual(
        endevorInventory.environmentStages
      );
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const nonRelatedLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS3',
      };
      const outdatedInPlaceElement: CachedElement = {
        element: {
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'I"m outdated :(',
          id: 'BLAHBLAH',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const nonRelatedElement: CachedElement = {
        element: {
          ...nonRelatedLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(inPlaceLocation)]: [],
              [toSubsystemMapPathId(nonRelatedLocation)]: [],
            },
            environmentStages: {},
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
          ...inPlaceLocation,
          type: 'TEST-TYPE',
          name: 'ELM',
          id: 'ELM',
          noSource: false,
          lastActionCcid: 'LAST-CCID',
        },
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const fetchedElements: CachedElements = {
        [toElementCompositeKey(serviceId)(inventoryLocationId)(
          elementInPlace.element
        )]: elementInPlace,
      };
      await dispatch({
        type: Actions.ELEMENTS_FETCHED,
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const element: Element = {
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, false),
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
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
        ]?.endevorInventory.cacheVersion
      ).toEqual(EndevorCacheVersion.UP_TO_DATE);
      expect(
        storeState.caches[
          toServiceLocationCompositeKey(serviceId)(inventoryLocationId)
        ]?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)]?.cacheVersion
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const emptyLocation = inPlaceLocation;
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, true),
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {},
            environmentStages: {},
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
        ]?.endevorInventory.cacheVersion
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const element: Element = {
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            false,
            EndevorCacheVersion.OUTDATED
          ),
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)]
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const emptyLocation = inPlaceLocation;
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            false,
            EndevorCacheVersion.OUTDATED
          ),
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            cacheVersion: EndevorCacheVersion.OUTDATED,
            endevorMap: {},
            environmentStages: {},
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(actualCache?.mapItemsContent).toEqual({});
      expect(actualCache?.endevorInventory.endevorMap).toEqual({});
      expect(actualCache?.endevorInventory.environmentStages).toEqual({});
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const element: Element = {
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            false,
            EndevorCacheVersion.OUTDATED
          ),
          mapItemsContent: {
            [toSubsystemMapPathId(inPlaceLocation)]: {
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(
        actualCache?.mapItemsContent[toSubsystemMapPathId(inPlaceLocation)]
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      const emptyLocation = inPlaceLocation;
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            false,
            EndevorCacheVersion.OUTDATED
          ),
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
        }
      );
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            cacheVersion: EndevorCacheVersion.OUTDATED,
            endevorMap: {},
            environmentStages: {},
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
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
        activityEntries: [],
        editElements: [],
      };
      const dispatch = await makeStore(mockedGetters)(
        () => storeState,
        () => {
          // do nothing
        },
        () => {
          // do nothing
        },
        (updatedValue) => {
          storeState = updatedValue;
        },
        () => {
          // do nothing
        },
        async () => {
          return [];
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
      expect(actualCache?.endevorInventory.cacheVersion).toEqual(
        EndevorCacheVersion.UP_TO_DATE
      );
      expect(actualCache?.mapItemsContent).toEqual({});
      expect(actualCache?.endevorInventory.endevorMap).toEqual({});
      expect(actualCache?.endevorInventory.environmentStages).toEqual({});
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
        activityEntries: [],
        editElements: [],
      };
      const elementInPlace: Element = {
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedElementVersion = {
        element: elementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, false),
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
        activityEntries: [],
        editElements: [],
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstElementVersion = {
        element: firstElementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS2',
        subSystem: 'SUBSYS',
      };
      const secondElementInPlace: Element = {
        ...secondInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedSecondElementVersion = {
        element: secondElementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstElementVersion = {
        element: firstElementInPlace,
        elementIsUpTheMap: false,
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {},
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const inPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const elementInPlace: Element = {
        ...inPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedInPlaceElementVersion = {
        element: elementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const upTheMapFirstLocation: SubSystemMapPath = {
        ...inPlaceLocation,
        stageNumber: '2',
      };
      const elementUpTheMapOne: Element = {
        ...upTheMapFirstLocation,
        type: elementInPlace.type,
        name: elementInPlace.name,
        id: elementInPlace.name,
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const elementUpTheMapTwo: Element = {
        ...upTheMapFirstLocation,
        type: elementInPlace.type,
        name: 'ELM2',
        id: 'ELM2',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const elementUpTheMapThree: Element = {
        ...upTheMapFirstLocation,
        type: 'TYPE2',
        name: elementUpTheMapTwo.name,
        id: elementUpTheMapTwo.name,
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedUpTheMapElementOneVersion = {
        element: elementUpTheMapOne,
        elementIsUpTheMap: true,
        lastRefreshTimestamp: Date.now(),
      };
      const cachedUpTheMapElementTwoVersion = {
        element: elementUpTheMapTwo,
        elementIsUpTheMap: true,
        lastRefreshTimestamp: Date.now(),
      };
      const cachedUpTheMapElementThreeVersion = {
        element: elementUpTheMapThree,
        elementIsUpTheMap: true,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(inPlaceLocation)]: [
                toSubsystemMapPathId(upTheMapFirstLocation),
              ],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const secondInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      const secondElementInPlace: Element = {
        ...secondInPlaceLocation,
        type: 'TYPE2',
        name: 'ELM2',
        id: 'ELM2',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedSecondElementInPlaceVersion = {
        element: secondElementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        elementIsUpTheMap: false,
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
        ...commonUpTheMapLocation,
        type: firstElementInPlace.type,
        name: firstElementInPlace.name,
        id: firstElementInPlace.name,
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedUpTheMapElementVersion = {
        element: elementUpTheMap,
        elementIsUpTheMap: true,
        lastRefreshTimestamp: Date.now(),
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [
                toSubsystemMapPathId(commonUpTheMapLocation),
              ],
              [toSubsystemMapPathId(emptySecondInPlaceLocation)]: [
                toSubsystemMapPathId(commonUpTheMapLocation),
              ],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
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
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const firstInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      const firstElementInPlace: Element = {
        ...firstInPlaceLocation,
        type: 'TYPE',
        name: 'ELM',
        id: 'ELM',
        noSource: false,
        lastActionCcid: 'LAST-CCID',
      };
      const cachedFirstInPlaceElementVersion = {
        element: firstElementInPlace,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
      };
      const secondEmptyInPlaceLocation: SubSystemMapPath = {
        ...firstInPlaceLocation,
        system: 'SYS2',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(firstInPlaceLocation)]: [],
              [toSubsystemMapPathId(secondEmptyInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      const emptyInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUBSYS',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {
              [toSubsystemMapPathId(emptyInPlaceLocation)]: [],
            },
            environmentStages: {},
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
        activityEntries: [],
        editElements: [],
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: {
            endevorMap: {},
            environmentStages: {},
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
  describe('getting types', () => {
    const serviceId: EndevorId = {
      name: 'test-service',
      source: Source.INTERNAL,
    };
    const inventoryLocationId: EndevorId = {
      name: 'test-inventory',
      source: Source.INTERNAL,
    };
    it('should return types from a particular location', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {},
        activityEntries: [],
        editElements: [],
      };
      const anotherInPlaceLocation: SubSystemMapPath = {
        environment: 'ENV',
        stageNumber: '1',
        system: 'OTHERSYS',
        subSystem: 'OTHERSUB',
      };
      const anotherSystemInPlace: System = {
        ...anotherInPlaceLocation,
        system: 'OTHERSYS',
        nextSystem: 'NEXTSYS',
      };
      const anotherTypeInPlace: ElementType = {
        ...anotherInPlaceLocation,
        type: 'OTHERTYPE',
        nextType: 'NEXTTYPE',
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(
            true,
            false,
            EndevorCacheVersion.UP_TO_DATE,
            {
              systems: [anotherSystemInPlace],
              types: [anotherTypeInPlace],
            }
          ),
          mapItemsContent: {},
        },
      };
      // act
      const actualTypes = getFilteredEndevorTypes(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualTypes).toEqual({
        [toTypeMapPathId(typeInPlace)]: typeInPlace,
        [toTypeMapPathId(anotherTypeInPlace)]: anotherTypeInPlace,
      });
    });
    it('should return types matching filter', () => {
      // arrange
      const storeState: State = {
        sessions: {},
        searchLocations: {},
        serviceLocations: {},
        services: {},
        caches: {},
        filters: {
          [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
            ELEMENT_TYPES_FILTER: {
              type: ElementFilterType.ELEMENT_TYPES_FILTER,
              value: ['TEST*'],
            },
          },
        },
        activityEntries: [],
        editElements: [],
      };
      storeState.caches = {
        [toServiceLocationCompositeKey(serviceId)(inventoryLocationId)]: {
          endevorInventory: makeEndevorInventory(true, false),
          mapItemsContent: {},
        },
      };
      // act
      const actualTypes = getFilteredEndevorTypes(() => storeState)(serviceId)(
        inventoryLocationId
      );
      // assert
      expect(actualTypes).toEqual({
        [toTypeMapPathId(typeInPlace)]: typeInPlace,
      });
    });
  });
});
