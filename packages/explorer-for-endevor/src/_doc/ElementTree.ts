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
  type: 'SERVICE';
  name: string;
  children: Locations;
}>;
export type LocationNode = Readonly<{
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
  children: Types;
}>;
export type TypeNode = Readonly<{
  type: 'TYPE';
  name: string;
  children: Elements;
}>;
export type ElementNode = Readonly<{
  type: 'ELEMENT';
  name: string;
  uri: Uri;
}>;
export type ElementLocationNode =
  | SystemNode
  | SubSystemNode
  | TypeNode
  | ElementNode;

export type Node =
  | AddNewProfileNode
  | ServiceNode
  | LocationNode
  | ElementLocationNode;

export interface ElementTree {
  serviceName: EndevorServiceName;
  locationName: ElementLocationName;
  systems: SystemNode[];
}
