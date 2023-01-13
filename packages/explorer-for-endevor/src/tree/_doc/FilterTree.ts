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

export type FilterValues = FilterValueNode[];
export type Filters = ReadonlyArray<FilterNode>;

export const enum FilterNodeType {
  NAMES_FILTER = 'Name',
  CCIDS_FILTER = 'Last Action CCID',
}

export type FilteredNode = Readonly<{
  type: 'FILTERED';
  name: string;
  children: Filters;
  searchLocationName: string;
  searchLocationSource: Source;
  serviceName: string;
  serviceSource: Source;
  tooltip: string;
}>;

export type FilterNode = Readonly<{
  type: 'FILTER';
  name: string;
  filterType: FilterNodeType;
  children: FilterValues;
  searchLocationName: string;
  searchLocationSource: Source;
  serviceName: string;
  serviceSource: Source;
  tooltip: string;
}>;

export type FilterValueNode = Readonly<{
  type: 'FILTER_VALUE';
  filterType: FilterNodeType;
  name: string;
  searchLocationName: string;
  searchLocationSource: Source;
  serviceName: string;
  serviceSource: Source;
}>;

export type LocationFilterNode = FilteredNode | FilterValueNode | FilterNode;
