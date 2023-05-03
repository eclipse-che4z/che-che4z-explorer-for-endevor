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

import {
  Element,
  ElementMapPath,
  SubSystemMapPath,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { Uri } from 'vscode';
import { EndevorMap } from '../../_doc/Endevor';
import {
  EndevorService,
  EndevorId,
  EndevorSearchLocation,
  EndevorCredentialStatus,
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorConnection,
  CachedElements,
  ElementCcidsFilter,
  ElementNamesFilter,
  ElementTypesFilter,
  ElementsUpTheMapFilter,
  ElementFilterType,
  ElementHistoryData,
  EndevorConfiguration,
  EndevorToken,
} from '../_doc/v2/Store';

export const enum Actions {
  SESSION_ENDEVOR_TOKEN_ADDED = 'SESSION_ENDEVOR_TOKEN/ADDED',
  SESSION_ENDEVOR_CREDENTIAL_ADDED = 'SESSION_ENDEVOR_CREDENTIAL/ADDED',
  SESSION_ENDEVOR_CONNECTION_ADDED = 'SESSION_ENDEVOR_CONNECTION/ADDED',
  ENDEVOR_CREDENTIAL_TESTED = 'ENDEVOR_CREDENTIAL/TESTED',
  ENDEVOR_CONNECTION_TESTED = 'ENDEVOR_CONNECTION_DETAILS/TESTED',
  ENDEVOR_SERVICE_ADDED = 'ENDEVOR_SERVICE/ADDED',
  ENDEVOR_SERVICE_CREATED = 'ENDEVOR_SERVICE/CREATED',
  ENDEVOR_SERVICE_UPDATED = 'ENDEVOR_SERVICE/UPDATED',
  ENDEVOR_SERVICE_CREDENTIALS_UPDATED = 'ENDEVOR_SERVICE_CREDENTIALS/UPDATED',
  ENDEVOR_SERVICE_HIDDEN = 'ENDEVOR_SERVICE/HIDDEN',
  ENDEVOR_SERVICE_DELETED = 'ENDEVOR_SERVICE/DELETED',
  ENDEVOR_SEARCH_LOCATION_CREATED = 'ENDEVOR_SEARCH_LOCATION/CREATED',
  ENDEVOR_SEARCH_LOCATION_ADDED = 'ENDEVOR_SEARCH_LOCATION/ADDED',
  ENDEVOR_SEARCH_LOCATION_HIDDEN = 'ENDEVOR_SEARCH_LOCATION/HIDDEN',
  ENDEVOR_SEARCH_LOCATION_DELETED = 'ENDEVOR_SEARCH_LOCATION/DELETED',
  ELEMENTS_UP_THE_MAP_FETCHED = 'ELEMENTS_UP_THE_MAP_FETCHED',
  ELEMENTS_IN_PLACE_FETCHED = 'ELEMENTS_IN_PLACE_FETCHED',
  ELEMENTS_FETCH_CANCELED = 'ELEMENTS_FETCH_CANCELED',
  ELEMENTS_FETCH_FAILED = 'ELEMENTS_FETCH_FAILED',
  REFRESH = 'REFRESH',
  ELEMENT_ADDED = 'ELEMENT_ADDED',
  ELEMENT_UPDATED_IN_PLACE = 'ELEMENT_UPDATED_IN_PLACE',
  ELEMENT_UPDATED_FROM_UP_THE_MAP = 'ELEMENT_UPDATED_FROM_UP_THE_MAP',
  ELEMENT_SIGNED_OUT = 'ELEMENT_SIGNED_OUT',
  ELEMENT_SIGNED_IN = 'ELEMENT_SIGNED_IN',
  ELEMENT_GENERATED_IN_PLACE = 'ELEMENT_GENERATED_IN_PLACE',
  ELEMENT_GENERATED_WITH_COPY_BACK = 'ELEMENT_GENERATED_WITH_COPY_BACK',
  ELEMENT_NAMES_FILTER_UPDATED = 'ELEMENT_NAMES_FILTER_UPDATED',
  ELEMENT_TYPES_FILTER_UPDATED = 'ELEMENT_TYPES_FILTER_UPDATED',
  ELEMENT_CCIDS_FILTER_UPDATED = 'ELEMENT_CCIDS_FILTER_UPDATED',
  ELEMENT_UP_THE_MAP_FILTER_UPDATED = 'ELEMENT_UP_THE_MAP_FILTER_UPDATED',
  ELEMENT_HISTORY_PRINTED = 'ELEMENT_HISTORY_PRINTED',
  ENDEVOR_SEARCH_LOCATION_FILTERS_CLEARED = 'ENDEVOR_SEARCH_LOCATION/FILTERS_CLEARED',
  SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE = 'SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE',
  SELECTED_ELEMENTS_UPDATED = 'SELECTED_ELEMENTS_UPDATED_IN_PLACE',
}

export interface SessionEndevorTokenAdded {
  type: Actions.SESSION_ENDEVOR_TOKEN_ADDED;
  sessionId: EndevorId;
  configuration: EndevorConfiguration;
  token: EndevorToken;
  credential?: EndevorCredential;
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

export interface EndevorServiceUpdated {
  type: Actions.ENDEVOR_SERVICE_UPDATED;
  serviceId: EndevorId;
  connection: EndevorConnection;
  credential?: EndevorCredential;
}

export interface EndevorServiceCredentialsUpdated {
  type: Actions.ENDEVOR_SERVICE_CREDENTIALS_UPDATED;
  serviceId: EndevorId;
  credential: EndevorCredential;
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

export interface ElementNamesFilterUpdated {
  type: Actions.ELEMENT_NAMES_FILTER_UPDATED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  updatedFilter: ElementNamesFilter;
}

export interface ElementTypesFilterUpdated {
  type: Actions.ELEMENT_TYPES_FILTER_UPDATED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  updatedFilter: ElementTypesFilter;
}

export interface ElementCcidsFilterUpdated {
  type: Actions.ELEMENT_CCIDS_FILTER_UPDATED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  updatedFilter: ElementCcidsFilter;
}

export interface ElementsUpTheMapFilterUpdated {
  type: Actions.ELEMENT_UP_THE_MAP_FILTER_UPDATED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  updatedFilter: ElementsUpTheMapFilter;
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

export interface ElementsUpTheMapFetched {
  type: Actions.ELEMENTS_UP_THE_MAP_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: CachedElements;
  endevorMap?: EndevorMap;
}

export interface ElementsInPlaceFetched {
  type: Actions.ELEMENTS_IN_PLACE_FETCHED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: CachedElements;
  subSystemsInPlace?: ReadonlyArray<SubSystemMapPath>;
}

export interface ElementsFetchCanceled {
  type: Actions.ELEMENTS_FETCH_CANCELED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}

export interface ElementsFetchFailed {
  type: Actions.ELEMENTS_FETCH_FAILED;
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
  pathUpTheMap: ElementMapPath;
  treePath: ElementTreePath;
  targetElement: Element;
}

export interface ElementUpdatedFromUpTheMap {
  type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP;
  pathUpTheMap: ElementMapPath;
  treePath: ElementTreePath;
  targetElement: Element;
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

export interface ElementHistoryPrinted {
  type: Actions.ELEMENT_HISTORY_PRINTED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  element: Element;
  uri: Uri;
  historyData: ElementHistoryData;
}

export interface EndevorSearchLocationFiltersCleared {
  type: Actions.ENDEVOR_SEARCH_LOCATION_FILTERS_CLEARED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  filtersCleared: ReadonlyArray<ElementFilterType>;
}

export interface SubsystemElementsUpdatedInPlace {
  type: Actions.SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  subSystemMapPath: SubSystemMapPath;
  lastActionCcid?: string;
}

export type SelectedElementsUpdated = {
  type: Actions.SELECTED_ELEMENTS_UPDATED;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elements: ReadonlyArray<Omit<Element, 'id' | 'noSource'>>;
};

export type Action =
  | SessionEndevorTokenAdded
  | SessionEndevorCredentialsAdded
  | SessionEndevorConnectionAdded
  | EndevorConnectionTested
  | EndevorCredentialTested
  | EndevorServiceCreated
  | EndevorServiceAdded
  | EndevorServiceUpdated
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
  | ElementsUpTheMapFetched
  | ElementsFetchCanceled
  | ElementsFetchFailed
  | ElementsInPlaceFetched
  | ElementHistoryPrinted
  | ElementCcidsFilterUpdated
  | ElementNamesFilterUpdated
  | ElementTypesFilterUpdated
  | ElementsUpTheMapFilterUpdated
  | EndevorSearchLocationFiltersCleared
  | SubsystemElementsUpdatedInPlace
  | SelectedElementsUpdated;
