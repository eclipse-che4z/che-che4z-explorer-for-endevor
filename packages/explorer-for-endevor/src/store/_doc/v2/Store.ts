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

import { TokenCredential } from '@local/endevor/_doc/Credential';
import {
  Element,
  ElementType,
  EnvironmentStage,
  ServiceApiVersion,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import {
  EndevorMap,
  EnvironmentStageMapPathId,
  SubsystemMapPathId,
} from '../../../api/_doc/Endevor';
import {
  ConnectionKey,
  ConnectionName,
  Id,
  InventoryLocationKey,
  InventoryLocationName,
  Connection,
  Credential,
  ConnectionLocations,
  InventoryLocation,
} from '../../storage/_doc/Storage';
import { ElementHistoryData } from '@local/views/tree/_doc/ChangesTree';

// internal types
export type EndevorServiceName = ConnectionName;
export type EndevorLocationName = InventoryLocationName;

export type EndevorId = Id;

// composite keys: source + name
export type EndevorServiceKey = ConnectionKey;
export type EndevorLocationKey = InventoryLocationKey;

export const enum EndevorCacheVersion {
  UP_TO_DATE = 'UP_TO_DATE',
  OUTDATED = 'OUTDATED',
}

export type CachedEndevorInventory = Readonly<{
  cacheVersion: EndevorCacheVersion;
  endevorMap: EndevorMap;
  environmentStages: CachedEnvironmentStages;
  startEnvironmentStage?: EnvironmentStageMapPathId;
}>;

export type CachedElement = {
  element: Element;
  lastRefreshTimestamp: number;
  elementIsUpTheMap: boolean;
  historyData?: ElementHistoryData;
  outOfDate?: boolean;
};

export type ElementId = string;
export type CachedElements = Readonly<{
  [id: ElementId]: CachedElement;
}>;

export type EndevorCachedElements = Readonly<{
  cacheVersion: EndevorCacheVersion;
  elements: CachedElements;
}>;

export type CachedTypes = Readonly<{
  [id: string]: ElementType;
}>;

export type CachedSubsystems = Readonly<{
  [id: string]: SubSystem;
}>;

export type CachedSystem = Readonly<{
  system: System;
  subsystems: CachedSubsystems;
  types: CachedTypes;
}>;

export type CachedSystems = Readonly<{
  [id: string]: CachedSystem;
}>;

export type CachedEnvironmentStage = Readonly<{
  environmentStage: EnvironmentStage;
  systems: CachedSystems;
}>;

export type CachedEnvironmentStages = Readonly<{
  [id: string]: CachedEnvironmentStage;
}>;

// key based on service name and search location name
type CompositeKey = string;
type EndevorMapItem = SubsystemMapPathId;
export type CacheItem = {
  endevorInventory: CachedEndevorInventory;
  mapItemsContent: Readonly<{
    [endevorMapItem: EndevorMapItem]: EndevorCachedElements | undefined;
  }>;
};
export type EndevorCache = Readonly<{
  [id: CompositeKey]: CacheItem | undefined;
}>;

export type EndevorApiVersion = ServiceApiVersion.V1 | ServiceApiVersion.V2;
export const enum EndevorConnectionStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}
export type ValidEndevorConnection = Readonly<{
  status: EndevorConnectionStatus.VALID;
  value: Connection['value'] & {
    apiVersion: ServiceApiVersion;
  };
}>;
export type InvalidEndevorConnection = Readonly<{
  status: EndevorConnectionStatus.INVALID;
  value: Connection['value'];
}>;
export type UnknownEndevorConnection = Readonly<{
  status: EndevorConnectionStatus.UNKNOWN;
  value: Connection['value'];
}>;
export type EndevorConnection =
  | UnknownEndevorConnection
  | ValidEndevorConnection
  | InvalidEndevorConnection;

export const enum EndevorCredentialStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}
type EndevorCredentialValue = Readonly<{
  value: Credential['value'];
}>;
export type ValidEndevorSessionCredential = Readonly<{
  status: EndevorCredentialStatus.VALID;
}> &
  Partial<EndevorCredentialValue>;
export type InvalidEndevorSessionCredential = Readonly<{
  status: EndevorCredentialStatus.INVALID;
}> &
  Partial<EndevorCredentialValue>;
export type UnknownEndevorSessionCredential = Readonly<{
  status: EndevorCredentialStatus.UNKNOWN;
}> &
  Partial<EndevorCredentialValue>;
export type EndevorSessionCredential =
  | UnknownEndevorSessionCredential
  | ValidEndevorSessionCredential
  | InvalidEndevorSessionCredential;
export type ValidEndevorCredential = Readonly<{
  status: EndevorCredentialStatus.VALID;
}> &
  EndevorCredentialValue;
export type InvalidEndevorCredential = Readonly<{
  status: EndevorCredentialStatus.INVALID;
}> &
  EndevorCredentialValue;
export type UnknownEndevorCredential = Readonly<{
  status: EndevorCredentialStatus.UNKNOWN;
}> &
  EndevorCredentialValue;
export type EndevorCredential =
  | UnknownEndevorCredential
  | ValidEndevorCredential
  | InvalidEndevorCredential;

export type EndevorCredentialDescription = EndevorCredential &
  Readonly<{
    isPersistent: boolean;
  }>;

export const enum ElementFilterType {
  ELEMENT_NAMES_FILTER = 'ELEMENT_NAMES_FILTER',
  ELEMENT_TYPES_FILTER = 'ELEMENT_TYPES_FILTER',
  ELEMENT_CCIDS_FILTER = 'ELEMENT_CCIDS_FILTER',
  ELEMENTS_UP_THE_MAP_FILTER = 'ELEMENTS_UP_THE_MAP_FILTER',
  EMPTY_TYPES_FILTER = 'EMPTY_TYPES_FILTER',
}

type Pattern = string;
export type ElementNamesFilter = {
  type: ElementFilterType.ELEMENT_NAMES_FILTER;
  value: ReadonlyArray<Pattern>;
};

export type ElementTypesFilter = {
  type: ElementFilterType.ELEMENT_TYPES_FILTER;
  value: ReadonlyArray<Pattern>;
};

export type ElementCcidsFilter = {
  type: ElementFilterType.ELEMENT_CCIDS_FILTER;
  value: ReadonlyArray<Pattern>;
};

export type ElementsUpTheMapFilter = {
  type: ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER;
  value: boolean;
};

export type EmptyTypesFilter = {
  type: ElementFilterType.EMPTY_TYPES_FILTER;
  value: boolean;
};

export type ElementToggleFilters = ElementsUpTheMapFilter | EmptyTypesFilter;

export type ElementFilter =
  | ElementNamesFilter
  | ElementTypesFilter
  | ElementCcidsFilter
  | ElementsUpTheMapFilter
  | EmptyTypesFilter;

export type ServiceLocationFilters = Partial<{
  [key in ElementFilterType]: ElementFilter;
}>;

export type ElementFilters = {
  [id: CompositeKey]: ServiceLocationFilters;
};

export const enum EndevorTokenStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

export type EndevorToken =
  | {
      status: EndevorTokenStatus.ENABLED;
      value: TokenCredential;
    }
  | {
      status: EndevorTokenStatus.DISABLED;
    };

export type EndevorTokens = {
  [configuration: EndevorConfiguration]: EndevorToken;
};

export type EndevorSession = Partial<{
  id: EndevorId;
  connection: EndevorConnection;
  credential: EndevorSessionCredential;
  tokens: EndevorTokens;
}>;

export type EndevorSessions = {
  [key: EndevorServiceKey]: EndevorSession | undefined;
};

export type EndevorService = Connection;
export type EndevorServices = {
  [key: EndevorServiceKey]: EndevorService | undefined;
};

export type EndevorSearchLocation = InventoryLocation;
export type EndevorSearchLocations = {
  [key: EndevorLocationKey]: EndevorSearchLocation | undefined;
};

export type EndevorReport = {
  name: string;
  id: string;
  objectName: string;
  content?: string;
};

export type ActivityRecord = {
  time: number;
  name: string;
  details?: Partial<{
    serviceId: EndevorId;
    searchLocationId: EndevorId;
    element: Element;
    messages: ReadonlyArray<string>;
    returnCode: number;
    reports: ReadonlyArray<EndevorReport>;
  }>;
};

export type ActivityRecords = Array<ActivityRecord>;

export type State = {
  filters: ElementFilters;
  sessions: EndevorSessions;
  caches: EndevorCache;
  services: EndevorServices;
  searchLocations: EndevorSearchLocations;
  serviceLocations: ConnectionLocations;
  activityEntries: ActivityRecords;
  editElements: ReadonlyArray<string>;
  lastUsedServiceId?: Id;
  lastUsedSearchLocationId?: Id;
};

// external types
export const enum EndevorServiceStatus {
  VALID = 'VALID',

  NON_EXISTING = 'NON_EXISTING',

  INVALID_CREDENTIAL = 'INVALID_CREDENTIALS',
  UNKNOWN_CREDENTIAL = 'UNKNOWN_CREDENTIAL',

  INVALID_CONNECTION = 'INVALID_CONNECTION',
  UNKNOWN_CONNECTION = 'UNKNOWN_CONNECTION',
}

export type ValidEndevorServiceDescription = Readonly<{
  status:
    | EndevorServiceStatus.VALID
    | EndevorServiceStatus.UNKNOWN_CONNECTION
    | EndevorServiceStatus.UNKNOWN_CREDENTIAL;
  duplicated: boolean;
  id: EndevorId;
  service: Connection['value'];
  credential?: Credential['value'];
  isDefault?: boolean;
}>;

export type InvalidEndevorServiceDescription = Readonly<{
  status:
    | EndevorServiceStatus.INVALID_CONNECTION
    | EndevorServiceStatus.INVALID_CREDENTIAL;
  duplicated: boolean;
  id: EndevorId;
  service: Connection['value'];
  credential?: Credential['value'];
  isDefault?: boolean;
}>;

export type NonExistingServiceDescription = Readonly<{
  status: EndevorServiceStatus.NON_EXISTING;
  duplicated: boolean;
  id: EndevorId;
}>;

export type ExistingEndevorServiceDescription =
  | ValidEndevorServiceDescription
  | InvalidEndevorServiceDescription;

export type EndevorServiceDescription =
  | ExistingEndevorServiceDescription
  | NonExistingServiceDescription;

export type ExistingEndevorServiceDescriptions = {
  [key: EndevorLocationKey]: ExistingEndevorServiceDescription;
};

export type EndevorServiceDescriptions = {
  [key: EndevorLocationKey]: EndevorServiceDescription;
};

export type EndevorConfiguration = string;

export const enum EndevorSearchLocationStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export type ValidEndevorSearchLocationDescription = Readonly<{
  status: EndevorSearchLocationStatus.VALID;
  duplicated: boolean;
  id: EndevorId;
  location: EndevorSearchLocation['value'];
  searchForFirstFoundElements: boolean;
  showEmptyTypes: boolean;
  isDefault?: boolean;
}>;

export type InvalidEndevorSearchLocationDescription = Readonly<{
  status: EndevorSearchLocationStatus.INVALID;
  duplicated: boolean;
  id: EndevorId;
  isDefault?: boolean;
}>;

export type EndevorSearchLocationDescription =
  | ValidEndevorSearchLocationDescription
  | InvalidEndevorSearchLocationDescription;

export type ValidEndevorSearchLocationDescriptions = {
  [key: EndevorLocationKey]: ValidEndevorSearchLocationDescription;
};

export type InvalidEndevorSearchLocationDescriptions = {
  [key: EndevorLocationKey]: InvalidEndevorSearchLocationDescription;
};

export type EndevorSearchLocationDescriptions = {
  [key: EndevorLocationKey]: EndevorSearchLocationDescription;
};

export type EndevorServiceLocation = {
  value: EndevorSearchLocationDescriptions;
} & EndevorServiceDescription;

export type EndevorServiceLocations = {
  [key: EndevorServiceKey]: EndevorServiceLocation;
};

export type ElementsPerRoute = Readonly<{
  [searchLocation: SubsystemMapPathId]: ReadonlyArray<CachedElement>;
}>;
