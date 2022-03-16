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

import { BaseCredential } from '@local/endevor/_doc/Credential';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { EndevorMap } from './Endevor';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from './settings';

export const enum Actions {
  ENDEVOR_CREDENTIAL_ADDED = 'CREDENTIAL/ADDED',
  LOCATION_CONFIG_CHANGED = 'LOCATIONS/CHANGED',
  ENDEVOR_MAP_BUILT = 'ENDEVOR_MAP_BUILT',
  ELEMENTS_FETCHED = 'ELEMENTS_FETCHED',
  REFRESH = 'REFRESH',
  ELEMENT_ADDED = 'ELEMENT_ADDED',
  ELEMENT_UPDATED = 'ELEMENT_UPDATED',
  ELEMENT_GENERATED = 'ELEMENT_GENERATED',
  ELEMENT_SIGNEDOUT = 'ELEMENT_SIGNEDOUT',
  ELEMENT_SIGNEDIN = 'ELEMENT_SIGNEDIN',
}

export interface EndevorCredentialAdded {
  type: Actions.ENDEVOR_CREDENTIAL_ADDED;
  serviceName: EndevorServiceName;
  credential: BaseCredential;
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

export interface ElementUpdated {
  type: Actions.ELEMENT_UPDATED;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

export interface ElementGenerated {
  type: Actions.ELEMENT_GENERATED;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

export type SignedOutElementsPayload = {
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
};

export type ElementSignedout = {
  type: Actions.ELEMENT_SIGNEDOUT;
} & SignedOutElementsPayload;

export interface ElementSignedin {
  type: Actions.ELEMENT_SIGNEDIN;
  serviceName: EndevorServiceName;
  service: Service;
  searchLocationName: ElementLocationName;
  searchLocation: ElementSearchLocation;
  elements: ReadonlyArray<Element>;
}

export type Action =
  | EndevorCredentialAdded
  | LocationConfigChanged
  | EndevorMapBuilt
  | ElementsUpdated
  | Refresh
  | ElementUpdated
  | ElementAdded
  | ElementGenerated
  | ElementSignedout
  | ElementSignedin;
