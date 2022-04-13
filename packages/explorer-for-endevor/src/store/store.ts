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
import { BaseCredential } from '@local/endevor/_doc/Credential';
import { ElementSearchLocation, Service } from '@local/endevor/_doc/Endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { searchForElements } from '../endevor';
import { logger, reporter } from '../globals';
import {
  toElementId,
  toSearchLocationNode,
  toServiceNode,
} from '../tree/endevor';
import { isError, replaceWith } from '../utils';
import {
  Action,
  Actions,
  ElementsUpdated,
  EndevorCredentialAdded,
  LocationConfigChanged,
  ElementAdded,
  ElementUpdated,
  ElementGenerated,
  ElementSignedin,
  ElementSignedout,
  EndevorMapBuilt,
} from '../_doc/Actions';
import { Node } from '../_doc/ElementTree';
import { EndevorMap } from '../_doc/Endevor';
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
      case Actions.ENDEVOR_CREDENTIAL_ADDED: {
        state = credentialReducer(state)(action);
        refreshTree(state, toServiceNode(action.serviceName)([]));
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
        state = removingLocalElementsCacheReducer(state);
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
      case Actions.ELEMENT_UPDATED: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_GENERATED: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_SIGNEDIN: {
        state = smartElementReducer(state, action);
        refreshTree(state);
        break;
      }
      case Actions.ELEMENT_SIGNEDOUT: {
        state = smartElementReducer(state, action);
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
          searchLocation: locationItem,
          endevorMap: {},
          elements: {},
        };
      }),
    };
  });
  return result;
};

const credentialReducer =
  (initialState: State) =>
  ({ serviceName, credential }: EndevorCredentialAdded): State => {
    const existingStateItem = initialState.find(
      (stateItem) => stateItem.serviceName === serviceName
    );
    if (!existingStateItem) return initialState;
    const updatedItem = {
      cachedElements: existingStateItem.cachedElements,
      serviceName: existingStateItem.serviceName,
      credential,
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
        credential: existingStateItem.credential,
        cachedElements: updatedLocation.cachedElements.map((updatedCache) => {
          const existingLocation = existingStateItem.cachedElements.find(
            (existingCache) =>
              existingCache.searchLocation === updatedCache.searchLocation
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
      (element) => element.searchLocation === searchLocationName
    );
    if (!existingCache) return initialState;
    const updatedCacheItem = {
      searchLocation: existingCache.searchLocation,
      endevorMap,
      elements: existingCache.elements,
    };
    const updatedItem = {
      serviceName: existingItem.serviceName,
      credential: existingItem.credential,
      cachedElements: replaceWith(existingItem.cachedElements)(
        (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
          value1.searchLocation === value2.searchLocation,
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
      element.searchLocation === elementAddedAction.searchLocationName
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
  const updatedCacheItem = {
    searchLocation: existingCache.searchLocation,
    endevorMap: existingCache.endevorMap,
    elements: updatedCachedElements,
  };
  const updatedItem = {
    serviceName: existingItem.serviceName,
    credential: existingItem.credential,
    cachedElements: replaceWith(existingItem.cachedElements)(
      (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
        value1.searchLocation === value2.searchLocation,
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

const removingLocalElementsCacheReducer = (initialState: State): State => {
  return initialState.map((stateItem) => {
    return {
      serviceName: stateItem.serviceName,
      credential: stateItem.credential,
      cachedElements: stateItem.cachedElements.map((element) => {
        return {
          searchLocation: element.searchLocation,
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
  }: ElementUpdated | ElementGenerated | ElementSignedout | ElementSignedin
): State => {
  const existingStateItem = initialState.find((existingItem) => {
    return existingItem.serviceName === serviceName;
  });
  if (!existingStateItem) return initialState;
  const existingCache = existingStateItem.cachedElements.find(
    (existingCache) => existingCache.searchLocation === searchLocationName
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
  const updatedCacheItem = {
    searchLocation: existingCache.searchLocation,
    endevorMap: existingCache.endevorMap,
    elements: updatedElements,
  };
  const updatedStateItem = {
    serviceName: existingStateItem.serviceName,
    credential: existingStateItem.credential,
    cachedElements: replaceWith(existingStateItem.cachedElements)(
      (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
        value1.searchLocation === value2.searchLocation,
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
      (existingCache) => existingCache.searchLocation === searchLocationName
    );
    if (!existingCache) return initialState;
    const cachedElements: CachedElements = {};
    const latestElementVersion = Date.now();
    const updatedCacheItem = {
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
    const updatedStateItem = {
      serviceName: existingStateItem.serviceName,
      credential: existingStateItem.credential,
      cachedElements: replaceWith(existingStateItem.cachedElements)(
        (value1: EndevorCacheItem, value2: EndevorCacheItem) =>
          value1.searchLocation === value2.searchLocation,
        updatedCacheItem
      ),
    };
    return replaceWith(initialState)(
      (value1: StateItem, value2: StateItem) =>
        value1.serviceName === value2.serviceName,
      updatedStateItem
    );
  };

export const getCredential =
  (state: State) =>
  (serviceName: EndevorServiceName): BaseCredential | undefined => {
    return state.find((stateItem) => {
      const serviceExists = stateItem.serviceName === serviceName;
      if (serviceExists) return true;
      return false;
    })?.credential;
  };

export const getLocations = (state: State): ReadonlyArray<LocationConfig> => {
  return state.map((stateItem) => {
    return {
      service: stateItem.serviceName,
      elementLocations: stateItem.cachedElements.map(
        (element) => element.searchLocation
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
        element.searchLocation === searchLocationName;
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
        element.searchLocation === searchLocationName;
      return searchLocationExists;
    });
    if (!existingLocation) return;
    return existingLocation.endevorMap;
  };
