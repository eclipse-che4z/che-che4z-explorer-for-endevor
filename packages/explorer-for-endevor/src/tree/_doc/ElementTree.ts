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

import { Element, SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import { MarkdownString } from 'vscode';
import { Id as EndevorId } from '../../store/storage/_doc/Storage';

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
  subSystemMapPath: SubSystemMapPath;
  serviceId: EndevorId;
  searchLocationId: EndevorId;
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

type BaseElementNode = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  name: string;
  element: Element;
  timestamp: string;
  parent: TypeNode;
  tooltip?: MarkdownString | string;
  noSource?: boolean;
}>;

type ElementInPlaceNode = BaseElementNode &
  Readonly<{
    type: 'ELEMENT_IN_PLACE';
  }>;

type ElementUpTheMapNode = BaseElementNode &
  Readonly<{
    type: 'ELEMENT_UP_THE_MAP';
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
