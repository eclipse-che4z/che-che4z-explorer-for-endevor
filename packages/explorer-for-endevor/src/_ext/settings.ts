/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import * as t from 'io-ts';

export type LocationConfig = t.TypeOf<typeof LocationConfig>;
export type LocationConfigs = t.TypeOf<typeof LocationConfigs>;

export type EditConfig = t.TypeOf<typeof EditConfig>;

export type MaxParallelRequests = t.TypeOf<typeof MaxParallelRequests>;

export const LocationConfig = t.type({
  service: t.string,
  elementLocations: t.array(t.string),
});
export const LocationConfigs = t.array(LocationConfig);

export const EditConfig = t.string;

export const MaxParallelRequests = t.number;
