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
} from '@local/endevor/_doc/Endevor';
import { EndevorMap } from './Endevor';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from './settings';

export const enum Actions {
  ENDEVOR_SERVICE_CHANGED = 'ENDEVOR_SERVICE/CHANGED',
  ENDEVOR_SEARCH_LOCATION_CHANGED = 'ENDEVOR_SEARCH_LOCATION/CHANGED',
  LOCATION_CONFIG_CHANGED = 'LOCATIONS/CHANGED',
  ENDEVOR_MAP_BUILT = 'ENDEVOR_MAP_BUILT',
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

export interface EndevorServiceChanged {
  type: Actions.ENDEVOR_SERVICE_CHANGED;
  serviceName: EndevorServiceName;
  service: Service;
}

export interface EndevorSearchLocationChanged {
  type: Actions.ENDEVOR_SEARCH_LOCATION_CHANGED;
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
}

export interface LocationConfigChanged {
  type: Actions.LOCATION_CONFIG_CHANGED;
  payload: ReadonlyArray<LocationConfig>;
}

export interface EndevorMapBuilt {
  type: Actions.ENDEVOR_MAP_BUILT;
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  endevorMap: EndevorMap;
}

export interface ElementsUpdated {
  type: Actions.ELEMENTS_FETCHED;
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  elements: ReadonlyArray<Element>;
}

export interface Refresh {
  type: Actions.REFRESH;
}

export interface ElementAdded {
  type: Actions.ELEMENT_ADDED;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  element: Element;
}

export interface ElementUpdatedInPlace {
  type: Actions.ELEMENT_UPDATED_IN_PLACE;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

export interface ElementGeneratedInPlace {
  type: Actions.ELEMENT_GENERATED_IN_PLACE;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

type FetchElementsArguments = Readonly<{
  service: Service;
  searchLocation: ElementSearchLocation;
}>;

type ElementTreePath = Readonly<{
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
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
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
};

export type ElementSignedOut = {
  type: Actions.ELEMENT_SIGNED_OUT;
} & SignedOutElementsPayload;

export interface ElementSignedIn {
  type: Actions.ELEMENT_SIGNED_IN;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

export type Action =
  | EndevorServiceChanged
  | EndevorSearchLocationChanged
  | LocationConfigChanged
  | EndevorMapBuilt
  | ElementsUpdated
  | Refresh
  | ElementUpdatedInPlace
  | ElementUpdatedFromUpTheMap
  | ElementAdded
  | ElementSignedOut
  | ElementGeneratedInPlace
  | ElementGeneratedWithCopyBack
  | ElementSignedIn;
