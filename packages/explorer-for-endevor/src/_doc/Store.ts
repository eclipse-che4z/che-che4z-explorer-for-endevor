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

import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { EndevorMap } from './Endevor';
import { ElementLocationName, EndevorServiceName } from './settings';

export type CachedElement = {
  element: Element;
  lastRefreshTimestamp: number;
};

export type CachedElements = Readonly<{
  [id: string]: CachedElement;
}>;

export type EndevorCacheItem = Readonly<{
  searchLocationName: ElementLocationName;
  searchLocation?: ElementSearchLocation;
  endevorMap: EndevorMap;
  elements: CachedElements;
}>;

export type StateItem = {
  serviceName: EndevorServiceName;
  service?: Service;
  cachedElements: ReadonlyArray<EndevorCacheItem>;
};

export type State = ReadonlyArray<StateItem>;
