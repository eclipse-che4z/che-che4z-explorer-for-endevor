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

import { parseToType } from '@local/type-parser/parser';
import { getSettingsValue } from '@local/vscode-wrapper/settings';
import { ENDEVOR_CONFIGURATION } from '../../constants';
import { LocationConfigs } from '../_ext/Settings';

/*
  @deprecated, only use for the migration till 2.0.0.
*/
export const LOCATIONS_SETTING = 'locations';
export const LOCATIONS_DEFAULT = [];

export type EndevorServiceName = string;
export type ElementLocationName = string;

export type LocationConfig = Readonly<{
  service: EndevorServiceName;
  elementLocations: ReadonlyArray<ElementLocationName>;
}>;

/*
  @deprecated, only use for the migration till 2.0.0.
  Please, use the extension store instead.
*/
export const getLocations = (): ReadonlyArray<LocationConfig> => {
  // please, pay attention: this call can be lazy
  const locations = getSettingsValue(ENDEVOR_CONFIGURATION)(
    LOCATIONS_SETTING,
    LOCATIONS_DEFAULT
  );
  return parseToType(LocationConfigs, locations);
};
