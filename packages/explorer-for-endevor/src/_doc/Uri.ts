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

// TODO: rewrite with io-ts types
import {
  ChangeControlValue,
  Element,
  ElementMapPath,
  Service,
  SubSystemMapPath,
  Value,
} from '@local/endevor/_doc/Endevor';
import { EndevorId } from '../store/_doc/v2/Store';

export const enum Schemas {
  TREE_ELEMENT = 'e4eElement',
  ELEMENT_LISTING = 'e4eListing',
  ELEMENT_HISTORY = 'e4eHistory',
  ELEMENT_CHANGE_LVL = 'e4eChangeLvl',
  FILE = 'file',
  READ_ONLY_FILE = 'e4eReadonlyFile',
  READ_ONLY_CACHED_ELEMENT = 'e4eReadOnlyCachedElement',
  READ_ONLY_REPORT = 'e4eReadonlyReport',
  READ_ONLY_GENERIC_REPORT = 'e4eReadonlyGenericReport',
}

export const enum QueryTypes {
  EDITED_ELEMENT = 'edited-element',
  COMPARED_ELEMENT = 'compared-element',
}

export const enum Extensions {
  TREE_ELEMENT = 'prnt',
  ELEMENT_LISTING = 'lst',
  ELEMENT_HISTORY = 'hist',
  ELEMENT_CHANGE_LVL = 'chng',
  ACTION_REPORT = 'rep',
}

export type EditedElementUriQuery = Readonly<{
  element: Element;
  fingerprint: string;
  searchContext: {
    initialSearchLocation: SubSystemMapPath;
    // TODO: remove from the URI, not related to the element itself
    serviceId: EndevorId;
    // TODO: remove from the URI, not related to the element itself
    searchLocationId: EndevorId;
  };
}>;

export type ComparedElementUriQuery = Readonly<{
  element: Element;
  fingerprint: string;
  remoteVersionTempFilePath: string;
  initialSearchContext: {
    initialSearchLocation: SubSystemMapPath;
    // TODO: remove from the URI, not related to the element itself
    serviceId: EndevorId;
    // TODO: remove from the URI, not related to the element itself
    searchLocationId: EndevorId;
  };
  uploadChangeControlValue: ChangeControlValue;
  uploadTargetLocation: ElementMapPath;
}>;

export type BasicElementUriQuery = Readonly<{
  element: Element;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
}>;

export type ElementListingUriQuery = BasicElementUriQuery;

export type ElementHistoryUriQuery = BasicElementUriQuery;

export type ElementChangeUriQuery = ElementHistoryUriQuery &
  Readonly<{
    vvll: string;
  }>;

export type FragmentType = {
  fragment: string;
};

export type ActionReportUriQuery = Readonly<{
  service: Service;
  configuration: Value;
  reportId: Value;
  objectName: Value;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  ccid: Value;
}>;
