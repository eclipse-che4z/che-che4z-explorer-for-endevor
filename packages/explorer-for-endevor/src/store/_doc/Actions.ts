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
  ElementMapPath,
  SubSystemMapPath,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import {
  EndevorCacheItem,
  EndevorService,
  EndevorId,
  EndevorSearchLocation,
  EndevorCredentialStatus,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorConnection,
  CachedElements,
} from '../_doc/v2/Store';

export const enum Actions {
  SESSION_ENDEVOR_CREDENTIAL_ADDED = 'SESSION_ENDEVOR_CREDENTIAL/ADDED',
  SESSION_ENDEVOR_CONNECTION_ADDED = 'SESSION_ENDEVOR_CONNECTION/ADDED',
  ENDEVOR_CREDENTIAL_TESTED = 'ENDEVOR_CREDENTIAL/TESTED',
  ENDEVOR_CONNECTION_TESTED = 'ENDEVOR_CONNECTION_DETAILS/TESTED',
  ENDEVOR_SERVICE_ADDED = 'ENDEVOR_SERVICE/ADDED',
  ENDEVOR_SERVICE_CREATED = 'ENDEVOR_SERVICE/CREATED',
  ENDEVOR_SERVICE_HIDDEN = 'ENDEVOR_SERVICE/HIDDEN',
  ENDEVOR_SERVICE_DELETED = 'ENDEVOR_SERVICE/DELETED',
  ENDEVOR_SEARCH_LOCATION_CREATED = 'ENDEVOR_SEARCH_LOCATION/CREATED',
  ENDEVOR_SEARCH_LOCATION_ADDED = 'ENDEVOR_SEARCH_LOCATION/ADDED',
  ENDEVOR_SEARCH_LOCATION_HIDDEN = 'ENDEVOR_SEARCH_LOCATION/HIDDEN',
  ENDEVOR_SEARCH_LOCATION_DELETED = 'ENDEVOR_SEARCH_LOCATION/DELETED',
  ENDEVOR_CACHE_FETCHED = 'ENDEVOR_CACHE_FETCHED',
  ENDEVOR_CACHE_FETCH_CANCELED = 'ENDEVOR_CACHE_FETCH_CANCELED',
  ENDEVOR_CACHE_FETCH_FAILED = 'ENDEVOR_CACHE_FETCH_FAILED',
  ENDEVOR_ELEMENTS_FETCHED = 'ENDEVOR_ELEMENTS_FETCHED',
  ENDEVOR_ELEMENTS_FETCH_CANCELED = 'ENDEVOR_ELEMENTS_FETCH_CANCELED',
  ENDEVOR_ELEMENTS_FETCH_FAILED = 'ENDEVOR_ELEMENTS_FETCH_FAILED',
  REFRESH = 'REFRESH',
  ELEMENT_ADDED = 'ELEMENT_ADDED',
  ELEMENT_UPDATED_IN_PLACE = 'ELEMENT_UPDATED_IN_PLACE',
  ELEMENT_UPDATED_FROM_UP_THE_MAP = 'ELEMENT_UPDATED_FROM_UP_THE_MAP',
  ELEMENT_SIGNED_OUT = 'ELEMENT_SIGNED_OUT',
  ELEMENT_SIGNED_IN = 'ELEMENT_SIGNED_IN',
  ELEMENT_GENERATED_IN_PLACE = 'ELEMENT_GENERATED_IN_PLACE',
  ELEMENT_GENERATED_WITH_COPY_BACK = 'ELEMENT_GENERATED_WITH_COPY_BACK',
}

export interface SessionEndevorCredentialsAdded {
  type: Actions.SESSION_ENDEVOR_CREDENTIAL_ADDED;
  sessionId: EndevorId;
  credential: EndevorCredential;
}

export interface SessionEndevorConnectionAdded {
  type: Actions.SESSION_ENDEVOR_CONNECTION_ADDED;
  sessionId: EndevorId;
  connection: EndevorConnection;
}

export interface EndevorCredentialTested {
  type: Actions.ENDEVOR_CREDENTIAL_TESTED;
  credentialId: EndevorId;
  status: EndevorCredentialStatus.VALID | EndevorCredentialStatus.INVALID;
}

export interface EndevorConnectionTested {
  type: Actions.ENDEVOR_CONNECTION_TESTED;
  connectionId: EndevorId;
  status:
    | {
        status: EndevorConnectionStatus.VALID;
        apiVersion: ServiceApiVersion;
      }
    | {
        status: EndevorConnectionStatus.INVALID;
      };
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
  service: EndevorService;
  connectionStatus:
    | {
        status: EndevorConnectionStatus.VALID;
        apiVersion: ServiceApiVersion;
      }
    | {
        status:
          | EndevorConnectionStatus.UNKNOWN
          | EndevorConnectionStatus.INVALID;
      };
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

export interface EndevorCacheFetched {
  type: Actions.ENDEVOR_CACHE_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  endevorCachedItem: Omit<EndevorCacheItem, 'cacheVersion'> | undefined;
  connection: EndevorConnection;
  credential: EndevorCredential;
}

export interface EndevorCacheFetchCanceled {
  type: Actions.ENDEVOR_CACHE_FETCH_CANCELED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}

export interface EndevorCacheFetchFailed {
  type: Actions.ENDEVOR_CACHE_FETCH_FAILED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  connection?: EndevorConnection;
  credential?: EndevorCredential;
}

export interface EndevorElementsFetched {
  type: Actions.ENDEVOR_ELEMENTS_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: CachedElements;
}

export interface EndevorElementsFetchCanceled {
  type: Actions.ENDEVOR_ELEMENTS_FETCH_CANCELED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}

export interface EndevorElementsFetchFailed {
  type: Actions.ENDEVOR_ELEMENTS_FETCH_FAILED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}

export interface Refresh {
  type: Actions.REFRESH;
}

export interface ElementAdded {
  type: Actions.ELEMENT_ADDED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
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

type ElementTreePath = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  searchLocation: SubSystemMapPath;
}>;

export interface ElementGeneratedWithCopyBack {
  type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK;
  targetLocation: ElementMapPath;
  pathUpTheMap: ElementMapPath;
  treePath: ElementTreePath;
}

export interface ElementUpdatedFromUpTheMap {
  type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP;
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
  | SessionEndevorCredentialsAdded
  | SessionEndevorConnectionAdded
  | EndevorConnectionTested
  | EndevorCredentialTested
  | EndevorServiceCreated
  | EndevorServiceAdded
  | EndevorServiceHidden
  | EndevorServiceDeleted
  | EndevorSearchLocationCreated
  | EndevorSearchLocationAdded
  | EndevorSearchLocationHidden
  | EndevorSearchLocationDeleted
  | Refresh
  | ElementUpdatedInPlace
  | ElementUpdatedFromUpTheMap
  | ElementAdded
  | ElementSignedOut
  | ElementGeneratedInPlace
  | ElementGeneratedWithCopyBack
  | ElementSignedIn
  | EndevorCacheFetched
  | EndevorCacheFetchCanceled
  | EndevorCacheFetchFailed
  | EndevorElementsFetched
  | EndevorElementsFetchCanceled
  | EndevorElementsFetchFailed;
