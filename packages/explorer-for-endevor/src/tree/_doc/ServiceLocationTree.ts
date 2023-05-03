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

import { Command, MarkdownString } from 'vscode';
import { Source } from '../../store/storage/_doc/Storage';
import { ElementLocationNode } from './ElementTree';
import { LocationFilterNode } from './FilterTree';

export type ServiceNodes = ServiceNode[];
export type LocationNodes = LocationNode[];

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
  duplicated: boolean;
  tooltip?: MarkdownString | string;
}>;
export type SyncedServiceNode = Omit<InternalServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE';
  }>;

export type ValidServiceNode = InternalServiceNode | SyncedServiceNode;
export type NonExistingServiceNode = Omit<SyncedServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE/NON_EXISTING' | 'SERVICE/NON_EXISTING';
  }>;
export type InvalidCredentialsServiceNode = Omit<SyncedServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE/INVALID_CREDENTIALS' | 'SERVICE/INVALID_CREDENTIALS';
  }>;

export type InvalidConnectionServiceNode = Omit<SyncedServiceNode, 'type'> &
  Readonly<{
    type: 'SERVICE_PROFILE/INVALID_CONNECTION' | 'SERVICE/INVALID_CONNECTION';
  }>;

export type ServiceNode =
  | ValidServiceNode
  | NonExistingServiceNode
  | InvalidCredentialsServiceNode
  | InvalidConnectionServiceNode;

export type InternalLocationNode = Readonly<{
  id: string;
  type: 'LOCATION' | 'LOCATION/WITH_MAP';
  name: string;
  source: Source;
  serviceName: string;
  serviceSource: Source;
  duplicated: boolean;
  tooltip?: MarkdownString | string;
  // showMap: boolean;
  // baseUrl: EndevorUrl;
}>;
export type SyncedLocationNode = Omit<InternalLocationNode, 'type'> &
  Readonly<{
    type: 'LOCATION_PROFILE/WITH_MAP' | 'LOCATION_PROFILE';
  }>;

export type ValidLocationNode = InternalLocationNode | SyncedLocationNode;
export type NonExistingLocationNode = Omit<
  SyncedLocationNode,
  'type' | 'showMap'
> &
  Readonly<{
    type: 'LOCATION_PROFILE/NON_EXISTING' | 'LOCATION/NON_EXISTING';
    command?: Command;
  }>;
export type InvalidLocationNode =
  | NonExistingLocationNode
  | (Omit<SyncedLocationNode, 'type' | 'showMap'> &
      Readonly<{
        type:
          | 'LOCATION_PROFILE/INVALID_CREDENTIALS'
          | 'LOCATION_PROFILE/INVALID_CONNECTION'
          | 'LOCATION/INVALID_CREDENTIALS'
          | 'LOCATION/INVALID_CONNECTION';
        command?: Command;
      }>);

export type LocationNode = ValidLocationNode | InvalidLocationNode;

export type Node =
  | LocationFilterNode
  | AddNewSearchLocationNode
  | ServiceNode
  | LocationNode
  | ElementLocationNode
  | LocationFilterNode;
