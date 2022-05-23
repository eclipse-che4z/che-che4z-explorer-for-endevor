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
  ElementSearchLocation,
  Service,
  Element,
} from '@local/endevor/_doc/Endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { searchForElements } from '../endevor';
import { logger, reporter } from '../globals';
import { toElementId, toSearchLocationNode } from '../tree/endevor';
import { isError, replaceWith } from '../utils';
import {
  Action,
  Actions,
  ElementsUpdated,
  LocationConfigChanged,
  ElementAdded,
  ElementUpdatedInPlace,
  ElementSignedIn,
  ElementSignedOut,
  EndevorMapBuilt,
  ElementGeneratedInPlace,
  ElementGeneratedWithCopyBack,
  ElementUpdatedFromUpTheMap,
  EndevorServiceChanged,
  EndevorSearchLocationChanged,
} from '../_doc/Actions';
import { Node } from '../_doc/ElementTree';
import { EndevorMap, toSubsystemMapPathId } from '../_doc/Endevor';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from '../_doc/settings';
import {
  CachedElement,
  CachedElements,
  EndevorCacheItem,
  State,
  StateItem,
} from '../_doc/Store';
import { ElementsFetchingStatus, TelemetryEvents } from '../_doc/Telemetry';

export const make = (
  initialState: State,
  refreshTree: (state: State, node?: Node) => void
) => {
  let state: State = initialState;
  refreshTree(state);

  const dispatch = async (action: Action): Promise<void> => {
    switch (action.type) {
      case Actions.ENDEVOR_SERVICE_CHANGED: {
        state = serviceReducer(state)(action);
        refreshTree(state);
        break;
      }
      case Actions.ENDEVOR_SEARCH_LOCATION_CHANGED: {
        state = searchLocationReducer(state)(action);
        refreshTree(state);
        break;
      }
      case Actions.LOCATION_CONFIG_CHANGED: {
        state = locationsReducer(state)(action);
        refreshTree(state);
        break;
      }
      case Actions.ENDEVOR_MAP_BUILT: {
        state = endevorMapBuiltReducer(state)(action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENTS_FETCHED: {
        state = replaceElementsReducer(state)(action);
        refreshTree(
          state,
          toSearchLocationNode(action.serviceName)(action.searchLocationName)
        );
        break;
      }
      case Actions.REFRESH: {
        state = cleanupElementsAndProfilesCacheReducer(state);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_ADDED: {
        state = addedElementReducer(state, action);
        refreshTree(state);
        state = await fetchingElementsReducer(state)(
          action.serviceName,
          action.service
        )(action.searchLocationName, action.searchLocation);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_UPDATED_IN_PLACE: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_SIGNED_IN: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_SIGNED_OUT: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_GENERATED_IN_PLACE: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP:
      case Actions.ELEMENT_GENERATED_WITH_COPY_BACK: {
        state = addedElementFromTheMapReducer(state, action);
        refreshTree(state);
        state = await fetchingElementsReducer(state)(
          action.treePath.serviceName,
          action.fetchElementsArgs.service
        )(
          action.treePath.searchLocationName,
          action.fetchElementsArgs.searchLocation
        );
        refreshTree(state);
        break;
      }
      default:
        throw new UnreachableCaseError(action);
    }
  };
  return dispatch;
};

export const toState = (locations: ReadonlyArray<LocationConfig>): State => {
  const result = locations.map((locationConfig) => {
    return {
      serviceName: locationConfig.service,
      cachedElements: locationConfig.elementLocations.map((locationItem) => {
        return {
          searchLocationName: locationItem,
          endevorMap: {},
          elements: {},
        };
      }),
    };
  });
  return result;
};

const serviceReducer =
  (initialState: State) =>
  ({ serviceName, service }: EndevorServiceChanged): State => {
    const existingStateItem = initialState.find(
      (stateItem) => stateItem.serviceName === serviceName
    );
    if (!existingStateItem) return initialState;
    const updatedItem: StateItem = {
      cachedElements: existingStateItem.cachedElements,
      serviceName: existingStateItem.serviceName,
      service,
    };
    return replaceWith(initialState)(
      (value1: StateItem, value2: StateItem) =>
        value1.serviceName === value2.serviceName,
      updatedItem
    );
  };

const searchLocationReducer =
  (initialState: State) =>
  ({
    serviceName,
    searchLocationName,
    searchLocation,
  }: EndevorSearchLocationChanged): State => {
    const existingItem = initialState.find((stateItem) => {
      return stateItem.serviceName === serviceName;
    });
    if (!existingItem) return initialState;
    const existingCache = existingItem.cachedElements.find(
      (element) => element.searchLocationName === searchLocationName
    );
    if (!existingCache) return initialState;
    const updatedCacheItem: EndevorCacheItem = {
      searchLocationName: existingCache.searchLocationName,
      searchLocation,
      endevorMap: existingCache.endevorMap,
      elements: existingCache.elements,
    };
    const updatedItem: StateItem = {
      serviceName: existingItem.serviceName,
      service: existingItem.service,
      cachedElements: replaceWith(existingItem.cachedElements)(
        (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
          value1.searchLocationName === value2.searchLocationName,
        updatedCacheItem
      ),
    };
    return replaceWith(initialState)(
      (value1: StateItem, value2: StateItem) =>
        value1.serviceName === value2.serviceName,
      updatedItem
    );
  };

const locationsReducer =
  (initialState: State) =>
  ({ payload }: LocationConfigChanged): State => {
    const updatedStateLocations = toState(payload);
    return updatedStateLocations.map((updatedLocation) => {
      const existingStateItem = initialState.find(
        (stateItem) => updatedLocation.serviceName === stateItem.serviceName
      );
      if (!existingStateItem) {
        return updatedLocation;
      }
      return {
        serviceName: existingStateItem.serviceName,
        service: existingStateItem.service,
        cachedElements: updatedLocation.cachedElements.map((updatedCache) => {
          const existingLocation = existingStateItem.cachedElements.find(
            (existingCache) =>
              existingCache.searchLocationName ===
              updatedCache.searchLocationName
          );
          if (!existingLocation) return updatedCache;
          return existingLocation;
        }),
      };
    });
  };

const endevorMapBuiltReducer =
  (initialState: State) =>
  ({ serviceName, searchLocationName, endevorMap }: EndevorMapBuilt): State => {
    const existingItem = initialState.find((stateItem) => {
      return stateItem.serviceName === serviceName;
    });
    if (!existingItem) return initialState;
    const existingCache = existingItem.cachedElements.find(
      (element) => element.searchLocationName === searchLocationName
    );
    if (!existingCache) return initialState;
    const updatedCacheItem: EndevorCacheItem = {
      searchLocationName: existingCache.searchLocationName,
      searchLocation: existingCache.searchLocation,
      endevorMap,
      elements: existingCache.elements,
    };
    const updatedItem: StateItem = {
      serviceName: existingItem.serviceName,
      service: existingItem.service,
      cachedElements: replaceWith(existingItem.cachedElements)(
        (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
          value1.searchLocationName === value2.searchLocationName,
        updatedCacheItem
      ),
    };
    return replaceWith(initialState)(
      (value1: StateItem, value2: StateItem) =>
        value1.serviceName === value2.serviceName,
      updatedItem
    );
  };

const addedElementFromTheMapReducer = (
  initialState: State,
  elementAddedAction: ElementGeneratedWithCopyBack | ElementUpdatedFromUpTheMap
): State => {
  const existingItem = initialState.find((stateItem) => {
    return stateItem.serviceName === elementAddedAction.treePath.serviceName;
  });
  if (!existingItem) return initialState;
  const existingCache = existingItem.cachedElements.find(
    (element) =>
      element.searchLocationName ===
      elementAddedAction.treePath.searchLocationName
  );
  if (!existingCache) return initialState;
  const oldElementId = toElementId(elementAddedAction.treePath.serviceName)(
    elementAddedAction.treePath.searchLocationName
  )(elementAddedAction.pathUpTheMap);
  const searchLocationEntry = toSubsystemMapPathId(
    elementAddedAction.treePath.searchLocation
  );
  const existingRoute = existingCache.endevorMap[searchLocationEntry];
  if (!existingRoute) return initialState;
  const treeLocation = [searchLocationEntry, ...existingRoute].find(
    (route) => route === toSubsystemMapPathId(elementAddedAction.targetLocation)
  );
  if (!treeLocation) return initialState;
  const oldELement = existingCache.elements[oldElementId];
  if (!oldELement) return initialState;
  const { [oldElementId]: matchingCashedElement, ...existingCachedElements } =
    existingCache.elements;
  const newElement: Element = {
    ...elementAddedAction.targetLocation,
    extension: oldELement.element.extension,
    name: oldELement.element.name,
  };
  const newElementId = toElementId(elementAddedAction.treePath.serviceName)(
    elementAddedAction.treePath.searchLocationName
  )(newElement);
  const updatedCachedElements: CachedElements = {
    ...existingCachedElements,
    [newElementId]: {
      element: newElement,
      lastRefreshTimestamp: Date.now(),
    },
  };
  const updatedCacheItem: EndevorCacheItem = {
    searchLocationName: existingCache.searchLocationName,
    searchLocation: existingCache.searchLocation,
    endevorMap: existingCache.endevorMap,
    elements: updatedCachedElements,
  };
  const updatedItem: StateItem = {
    serviceName: existingItem.serviceName,
    service: existingItem.service,
    cachedElements: replaceWith(existingItem.cachedElements)(
      (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
        value1.searchLocationName === value2.searchLocationName,
      updatedCacheItem
    ),
  };
  return replaceWith(initialState)(
    (value1: StateItem, value2: StateItem) =>
      value1.serviceName === value2.serviceName,
    updatedItem
  );
};

const addedElementReducer = (
  initialState: State,
  elementAddedAction: ElementAdded
): State => {
  const existingItem = initialState.find((stateItem) => {
    return stateItem.serviceName === elementAddedAction.serviceName;
  });
  if (!existingItem) return initialState;
  const existingCache = existingItem.cachedElements.find(
    (element) =>
      element.searchLocationName === elementAddedAction.searchLocationName
  );
  if (!existingCache) return initialState;
  const existingCachedElements = existingCache.elements;
  const newElementId = toElementId(elementAddedAction.serviceName)(
    elementAddedAction.searchLocationName
  )(elementAddedAction.element);
  const updatedCachedElements: CachedElements = {
    ...existingCachedElements,
    [newElementId]: {
      element: elementAddedAction.element,
      lastRefreshTimestamp: Date.now(),
    },
  };
  const updatedCacheItem: EndevorCacheItem = {
    searchLocationName: existingCache.searchLocationName,
    searchLocation: existingCache.searchLocation,
    endevorMap: existingCache.endevorMap,
    elements: updatedCachedElements,
  };
  const updatedItem: StateItem = {
    serviceName: existingItem.serviceName,
    service: existingItem.service,
    cachedElements: replaceWith(existingItem.cachedElements)(
      (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
        value1.searchLocationName === value2.searchLocationName,
      updatedCacheItem
    ),
  };
  return replaceWith(initialState)(
    (value1: StateItem, value2: StateItem) =>
      value1.serviceName === value2.serviceName,
    updatedItem
  );
};

const fetchingElementsReducer =
  (state: State) =>
  (serviceName: EndevorServiceName, endevorService: Service) =>
  async (
    searchLocationName: ElementLocationName,
    elementsSearchLocation: ElementSearchLocation
  ): Promise<State> => {
    const elements = await withNotificationProgress('Fetching elements')(
      (progress) =>
        searchForElements(progress)(endevorService)(elementsSearchLocation)
    );
    if (isError(elements)) {
      const error = elements;
      logger.warn(
        'Unable to fetch the updated list of elements from Endevor.',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
        status: ElementsFetchingStatus.GENERIC_ERROR,
        error,
      });
      return state;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
      elementsAmount: elements.length,
    });
    return replaceElementsReducer(state)({
      serviceName,
      searchLocationName,
      elements,
      type: Actions.ELEMENTS_FETCHED,
    });
  };

const cleanupElementsAndProfilesCacheReducer = (initialState: State): State => {
  return initialState.map((stateItem) => {
    return {
      serviceName: stateItem.serviceName,
      cachedElements: stateItem.cachedElements.map((element) => {
        return {
          searchLocationName: element.searchLocationName,
          endevorMap: element.endevorMap,
          elements: {},
        };
      }),
    };
  });
};

const smartElementReducer = (
  initialState: State,
  {
    serviceName,
    searchLocationName,
    elements,
  }:
    | ElementUpdatedInPlace
    | ElementGeneratedInPlace
    | ElementSignedOut
    | ElementSignedIn
): State => {
  const existingStateItem = initialState.find((existingItem) => {
    return existingItem.serviceName === serviceName;
  });
  if (!existingStateItem) return initialState;
  const existingCache = existingStateItem.cachedElements.find(
    (existingCache) => existingCache.searchLocationName === searchLocationName
  );
  if (!existingCache) return initialState;
  const cachedElements: CachedElements = {};
  const latestElementVersion = Date.now();
  const updatedElements = {
    ...existingCache.elements,
    ...elements.reduce((accum, element) => {
      const newElementId =
        toElementId(serviceName)(searchLocationName)(element);
      return {
        ...accum,
        [newElementId]: {
          element,
          lastRefreshTimestamp: latestElementVersion,
        },
      };
    }, cachedElements),
  };
  const updatedCacheItem: EndevorCacheItem = {
    searchLocationName: existingCache.searchLocationName,
    searchLocation: existingCache.searchLocation,
    endevorMap: existingCache.endevorMap,
    elements: updatedElements,
  };
  const updatedStateItem: StateItem = {
    serviceName: existingStateItem.serviceName,
    service: existingStateItem.service,
    cachedElements: replaceWith(existingStateItem.cachedElements)(
      (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
        value1.searchLocationName === value2.searchLocationName,
      updatedCacheItem
    ),
  };
  return replaceWith(initialState)(
    (value1: StateItem, value2: StateItem) =>
      value1.serviceName === value2.serviceName,
    updatedStateItem
  );
};

const replaceElementsReducer =
  (initialState: State) =>
  ({ serviceName, searchLocationName, elements }: ElementsUpdated): State => {
    const existingStateItem = initialState.find((existingItem) => {
      return existingItem.serviceName === serviceName;
    });
    if (!existingStateItem) return initialState;
    const existingCache = existingStateItem.cachedElements.find(
      (existingCache) => existingCache.searchLocationName === searchLocationName
    );
    if (!existingCache) return initialState;
    const cachedElements: CachedElements = {};
    const latestElementVersion = Date.now();
    const updatedCacheItem: EndevorCacheItem = {
      searchLocationName: existingCache.searchLocationName,
      searchLocation: existingCache.searchLocation,
      endevorMap: existingCache.endevorMap,
      elements: elements.reduce((accum, element) => {
        const newElementId =
          toElementId(serviceName)(searchLocationName)(element);
        return {
          ...accum,
          [newElementId]: {
            element,
            lastRefreshTimestamp: latestElementVersion,
          },
        };
      }, cachedElements),
    };
    const updatedStateItem: StateItem = {
      serviceName: existingStateItem.serviceName,
      service: existingStateItem.service,
      cachedElements: replaceWith(existingStateItem.cachedElements)(
        (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
          value1.searchLocationName === value2.searchLocationName,
        updatedCacheItem
      ),
    };
    return replaceWith(initialState)(
      (value1: StateItem, value2: StateItem) =>
        value1.serviceName === value2.serviceName,
      updatedStateItem
    );
  };

export const getService =
  (state: State) =>
  (serviceName: EndevorServiceName): Service | undefined => {
    return state.find((stateItem) => {
      const serviceExists = stateItem.serviceName === serviceName;
      if (serviceExists) return true;
      return false;
    })?.service;
  };

export const getSearchLocation =
  (state: State) =>
  (serviceName: EndevorServiceName) =>
  (
    searchLocationName: ElementLocationName
  ): ElementSearchLocation | undefined => {
    const existingService = state.find((stateItem) => {
      const serviceExists = stateItem.serviceName === serviceName;
      return serviceExists;
    });
    if (!existingService) return undefined;
    const existingLocation = existingService.cachedElements.find((element) => {
      const searchLocationExists =
        element.searchLocationName === searchLocationName;
      return searchLocationExists;
    });
    if (!existingLocation) return undefined;
    return existingLocation.searchLocation;
  };

export const getLocations = (state: State): ReadonlyArray<LocationConfig> => {
  return state.map((stateItem) => {
    return {
      service: stateItem.serviceName,
      elementLocations: stateItem.cachedElements.map(
        (element) => element.searchLocationName
      ),
    };
  });
};

export const getElements =
  (state: State) =>
  (serviceName: EndevorServiceName) =>
  (searchLocationName: ElementLocationName): ReadonlyArray<CachedElement> => {
    const existingService = state.find((stateItem) => {
      const serviceExists = stateItem.serviceName === serviceName;
      return serviceExists;
    });
    if (!existingService) return [];
    const existingLocation = existingService.cachedElements.find((element) => {
      const searchLocationExists =
        element.searchLocationName === searchLocationName;
      return searchLocationExists;
    });
    if (!existingLocation) return [];
    return Object.values(existingLocation.elements);
  };

export const getEndevorMap =
  (state: State) =>
  (serviceName: EndevorServiceName) =>
  (searchLocationName: ElementLocationName): EndevorMap | undefined => {
    const existingService = state.find((stateItem) => {
      const serviceExists = stateItem.serviceName === serviceName;
      return serviceExists;
    });
    if (!existingService) return;
    const existingLocation = existingService.cachedElements.find((element) => {
      const searchLocationExists =
        element.searchLocationName === searchLocationName;
      return searchLocationExists;
    });
    if (!existingLocation) return;
    return existingLocation.endevorMap;
  };
