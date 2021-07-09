/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';

export const enum Schemas {
  TREE_ELEMENT = 'e4eElement',
  ELEMENT_LISTING = 'e4eListing',
  FILE = 'file',
  READ_ONLY_FILE = 'e4eReadonlyFile',
}

export const enum QueryTypes {
  EDITED_ELEMENT = 'edited-element',
  COMPARED_ELEMENT = 'compared-element',
}

export type TreeElementUriQuery = Readonly<{
  service: Service;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

export type EditedElementUriQuery = Readonly<{
  service: Service;
  element: Element;
  searchLocation: ElementSearchLocation;
  fingerprint: string;
}>;

export type ComparedElementUriQuery = Readonly<{
  service: Service;
  element: Element;
  fingerprint: string;
  uploadChangeControlValue: ChangeControlValue;
  remoteVersionTempFilePath: string;
  initialElementTempFilePath: string;
}>;

export type ElementListingUriQuery = Readonly<{
  service: Service;
  element: Element;
}>;
