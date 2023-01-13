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

export type Systems = Array<SystemNode>;
export type SubSystems = Array<SubSystemNode>;
export type Types = Array<TypeNode>;
export type Elements = Array<ElementNode>;

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
  map?: EndevorMapNode;
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
  tooltip: string;
}>;

type ElementUpTheMapNode = Readonly<{
  searchLocationId: string;
  type: 'ELEMENT_UP_THE_MAP';
  name: string;
  uri: Uri;
  parent: TypeNode;
  tooltip: string;
}>;

export type ElementNode = ElementInPlaceNode | ElementUpTheMapNode;

export type EmptyMapNode = Readonly<{
  type: 'EMPTY_MAP_NODE';
}>;

export type ElementLocationNode =
  | SystemNode
  | SubSystemNode
  | TypeNode
  | ElementNode
  | EndevorMapNode
  | EmptyMapNode;
