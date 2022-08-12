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

import {
  Element,
  ElementSearchLocation,
  Service,
  ElementMapPath,
  SubSystemMapPath,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { EndevorMap } from '../../_doc/Endevor';
import {
  EndevorApiVersion,
  EndevorCacheItem,
  EndevorService,
  EndevorCredential,
  EndevorId,
  EndevorSearchLocation,
} from '../_doc/v2/Store';

export const enum Actions {
  ENDEVOR_CREDENTIAL_ADDED = 'ENDEVOR_CREDENTIAL/ADDED',
  ENDEVOR_SERVICE_API_VERSION_ADDED = 'ENDEVOR_SERVICE_API_VERSION/ADDED',
  ENDEVOR_SERVICE_ADDED = 'ENDEVOR_SERVICE/ADDED',
  ENDEVOR_SERVICE_CREATED = 'ENDEVOR_SERVICE/CREATED',
  ENDEVOR_SERVICE_HIDDEN = 'ENDEVOR_SERVICE/HIDDEN',
  ENDEVOR_SERVICE_DELETED = 'ENDEVOR_SERVICE/DELETED',
  ENDEVOR_SEARCH_LOCATION_CREATED = 'ENDEVOR_SEARCH_LOCATION/CREATED',
  ENDEVOR_SEARCH_LOCATION_ADDED = 'ENDEVOR_SEARCH_LOCATION/ADDED',
  ENDEVOR_SEARCH_LOCATION_HIDDEN = 'ENDEVOR_SEARCH_LOCATION/HIDDEN',
  ENDEVOR_SEARCH_LOCATION_DELETED = 'ENDEVOR_SEARCH_LOCATION/DELETED',
  ENDEVOR_MAP_BUILT = 'ENDEVOR_MAP_BUILT',
  ENDEVOR_CACHE_FETCHED = 'ENDEVOR_CACHE_FETCHED',
  ELEMENTS_FETCHED = 'ELEMENTS_FETCHED',
  REFRESH = 'REFRESH',
  ELEMENT_ADDED = 'ELEMENT_ADDED',
  ELEMENT_UPDATED_IN_PLACE = 'ELEMENT_UPDATED_IN_PLACE',
  ELEMENT_UPDATED_FROM_UP_THE_MAP = 'ELEMENT_UPDATED_FROM_UP_THE_MAP',
  ELEMENT_SIGNED_OUT = 'ELEMENT_SIGNED_OUT',
  ELEMENT_SIGNED_IN = 'ELEMENT_SIGNED_IN',
  ELEMENT_GENERATED_IN_PLACE = 'ELEMENT_GENERATED_IN_PLACE',
  ELEMENT_GENERATED_WITH_COPY_BACK = 'ELEMENT_GENERATED_WITH_COPY_BACK',
}

export interface EndevorCredentialsAdded {
  type: Actions.ENDEVOR_CREDENTIAL_ADDED;
  credential: EndevorCredential;
}

export interface EndevorServiceApiVersionAdded {
  type: Actions.ENDEVOR_SERVICE_API_VERSION_ADDED;
  serviceId: EndevorId;
  apiVersion: EndevorApiVersion;
}

export interface EndevorServiceHidden {
  type: Actions.ENDEVOR_SERVICE_HIDDEN;
  serviceId: EndevorId;
}

export interface EndevorServiceDeleted {
  type: Actions.ENDEVOR_SERVICE_DELETED;
  serviceId: EndevorId;
}

export interface EndevorServiceAdded {
  type: Actions.ENDEVOR_SERVICE_ADDED;
  serviceId: EndevorId;
}

export interface EndevorServiceCreated {
  type: Actions.ENDEVOR_SERVICE_CREATED;
  service: EndevorService &
    Partial<{
      apiVersion: ServiceApiVersion;
    }>;
}

export interface EndevorSearchLocationCreated {
  type: Actions.ENDEVOR_SEARCH_LOCATION_CREATED;
  serviceId: EndevorId;
  searchLocation: EndevorSearchLocation;
}

export interface EndevorSearchLocationAdded {
  type: Actions.ENDEVOR_SEARCH_LOCATION_ADDED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}

export interface EndevorSearchLocationHidden {
  type: Actions.ENDEVOR_SEARCH_LOCATION_HIDDEN;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}
export interface EndevorSearchLocationDeleted {
  type: Actions.ENDEVOR_SEARCH_LOCATION_DELETED;
  searchLocationId: EndevorId;
}

export interface EndevorMapBuilt {
  type: Actions.ENDEVOR_MAP_BUILT;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  endevorMap: EndevorMap;
}
export interface EndevorCacheFetched {
  type: Actions.ENDEVOR_CACHE_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  endevorCachedItem: EndevorCacheItem;
}
export interface ElementsUpdated {
  type: Actions.ELEMENTS_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: ReadonlyArray<Element>;
}

export interface Refresh {
  type: Actions.REFRESH;
}

export interface ElementAdded {
  type: Actions.ELEMENT_ADDED;
  serviceId: EndevorId;
  service: Service;
  searchLocationId: EndevorId;
  searchLocation: ElementSearchLocation;
  element: Element;
}

export interface ElementUpdatedInPlace {
  type: Actions.ELEMENT_UPDATED_IN_PLACE;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  element: Element;
}

export interface ElementGeneratedInPlace {
  type: Actions.ELEMENT_GENERATED_IN_PLACE;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  element: Element;
}

type FetchElementsArguments = Readonly<{
  service: Service;
  searchLocation: ElementSearchLocation;
}>;

type ElementTreePath = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  searchLocation: SubSystemMapPath;
}>;

export interface ElementGeneratedWithCopyBack {
  type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK;
  fetchElementsArgs: FetchElementsArguments;
  targetLocation: ElementMapPath;
  pathUpTheMap: ElementMapPath;
  treePath: ElementTreePath;
}

export interface ElementUpdatedFromUpTheMap {
  type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP;
  fetchElementsArgs: FetchElementsArguments;
  targetLocation: ElementMapPath;
  pathUpTheMap: ElementMapPath;
  treePath: ElementTreePath;
}

export type SignedOutElementsPayload = {
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: ReadonlyArray<Element>;
};

export type ElementSignedOut = {
  type: Actions.ELEMENT_SIGNED_OUT;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: ReadonlyArray<Element>;
};

export interface ElementSignedIn {
  type: Actions.ELEMENT_SIGNED_IN;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  element: Element;
}

export type Action =
  | EndevorCredentialsAdded
  | EndevorServiceApiVersionAdded
  | EndevorServiceCreated
  | EndevorServiceAdded
  | EndevorServiceHidden
  | EndevorServiceDeleted
  | EndevorSearchLocationCreated
  | EndevorSearchLocationAdded
  | EndevorSearchLocationHidden
  | EndevorSearchLocationDeleted
  | EndevorMapBuilt
  | ElementsUpdated
  | Refresh
  | ElementUpdatedInPlace
  | ElementUpdatedFromUpTheMap
  | ElementAdded
  | ElementSignedOut
  | ElementGeneratedInPlace
  | ElementGeneratedWithCopyBack
  | ElementSignedIn
  | EndevorCacheFetched;
