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

import { Source } from '../../store/storage/_doc/Storage';
import { ElementLocationNode } from './ElementTree';

export type ServiceNodes = ServiceNode[];
export type LocationNodes = LocationNode[];

export type AddNewServiceNode = Readonly<{
  type: 'BUTTON_ADD_SERVICE';
  label: string;
  command: {
    command: string;
    title: string;
    argument: undefined;
  };
}>;

export type AddNewSearchLocationNode = Readonly<{
  type: 'BUTTON_ADD_SEARCH_LOCATION';
  label: string;
  command: {
    command: string;
    title: string;
    argument: ServiceNode;
  };
}>;

export type InternalServiceNode = Readonly<{
  id: string;
  type: 'SERVICE';
  name: string;
  source: Source;
  children: LocationNodes;
  tooltip: string;
  duplicated: boolean;
}>;
export type SyncedServiceNode = Omit<InternalServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE';
  }>;

export type ValidServiceNode = InternalServiceNode | SyncedServiceNode;
export type InvalidServiceNode = Omit<SyncedServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE/INVALID';
  }>;

export type ServiceNode = ValidServiceNode | InvalidServiceNode;

export type InternalLocationNode = Readonly<{
  id: string;
  type: 'LOCATION';
  name: string;
  source: Source;
  serviceName: string;
  serviceSource: Source;
  tooltip: string;
  duplicated: boolean;
  // baseUrl: EndevorUrl;
}>;
export type SyncedLocationNode = Omit<InternalLocationNode, 'type'> &
  Readonly<{
    type: 'LOCATION_PROFILE';
  }>;

export type ValidLocationNode = InternalLocationNode | SyncedLocationNode;
export type InvalidLocationNode = Omit<SyncedLocationNode, 'type'> &
  Readonly<{
    type: 'LOCATION_PROFILE/INVALID';
  }>;

export type LocationNode = ValidLocationNode | InvalidLocationNode;

export type Node =
  | AddNewServiceNode
  | AddNewSearchLocationNode
  | ServiceNode
  | LocationNode
  | ElementLocationNode;
