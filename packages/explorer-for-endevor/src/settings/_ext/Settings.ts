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

import * as t from 'io-ts';

/*
  @deprecated, only use for the migration till 2.0.0.
*/
export type LocationConfig = t.TypeOf<typeof LocationConfig>;
export type LocationConfigs = t.TypeOf<typeof LocationConfigs>;

export const LocationConfig = t.type({
  service: t.string,
  elementLocations: t.array(t.string),
});
export const LocationConfigs = t.array(LocationConfig);
