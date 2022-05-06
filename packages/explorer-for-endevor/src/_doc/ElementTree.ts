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

import { Uri } from 'vscode';
import { ElementLocationName, EndevorServiceName } from './settings';

export type Services = ServiceNode[];
export type Locations = LocationNode[];

export type Systems = Map<string, SystemNode>;
export type SubSystems = Map<string, SubSystemNode>;
export type Types = Map<string, TypeNode>;
export type Elements = Map<string, ElementNode>;

export type AddNewProfileNode = Readonly<{
  type: 'BUTTON_ADD_PROFILE';
  label: string;
  command: {
    command: string;
    title: string;
  };
}>;

export type ServiceNode = Readonly<{
  id: string;
  type: 'SERVICE';
  name: string;
  children: Locations;
}>;
export type LocationNode = Readonly<{
  id: string;
  type: 'LOCATION';
  name: string;
  serviceName: string;
  // baseUrl: EndevorUrl;
}>;

export type SystemNode = Readonly<{
  type: 'SYS';
  name: string;
  children: SubSystems;
}>;
export type SubSystemNode = Readonly<{
  type: 'SUB';
  name: string;
  parent: SystemNode;
  children: Types;
}>;
export type TypeNode = Readonly<{
  type: 'TYPE';
  name: string;
  parent: SubSystemNode;
  elements: Elements;
  map: EndevorMapNode;
}>;
export type EndevorMapNode = Readonly<{
  type: 'MAP';
  name: string;
  elements: Elements;
}>;

type ElementInPlaceNode = Readonly<{
  searchLocationId: string;
  type: 'ELEMENT_IN_PLACE';
  name: string;
  uri: Uri;
  parent: TypeNode;
}>;

type ElementUpTheMapNode = Readonly<{
  searchLocationId: string;
  type: 'ELEMENT_UP_THE_MAP';
  name: string;
  uri: Uri;
  parent: TypeNode;
}>;

export type ElementNode = ElementInPlaceNode | ElementUpTheMapNode;

export type ElementLocationNode =
  | SystemNode
  | SubSystemNode
  | TypeNode
  | ElementNode;

export type EmptyMapNode = Readonly<{
  type: 'EMPTY_MAP_NODE';
}>;

export type Node =
  | AddNewProfileNode
  | ServiceNode
  | LocationNode
  | EndevorMapNode
  | ElementLocationNode
  | EmptyMapNode;

export interface ElementTree {
  serviceName: EndevorServiceName;
  locationName: ElementLocationName;
  systems: SystemNode[];
}
