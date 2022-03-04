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

import { BaseCredential } from '@local/endevor/_doc/Credential';
import { Element } from '@local/endevor/_doc/Endevor';
import { ElementLocationName, EndevorServiceName } from './settings';

export type CachedElement = {
  element: Element;
  lastRefreshTimestamp: number;
};

export type CachedElements = Readonly<{
  [id: string]: CachedElement;
}>;

export type EndevorCacheItem = Readonly<{
  searchLocation: ElementLocationName;
  elements: CachedElements;
}>;

export type StateItem = {
  serviceName: EndevorServiceName;
  credential?: BaseCredential;
  cachedElements: ReadonlyArray<EndevorCacheItem>;
};

export type State = ReadonlyArray<StateItem>;
