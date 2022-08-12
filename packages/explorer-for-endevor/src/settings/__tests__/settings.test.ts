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

import { assert } from 'chai';
import {
  AUTOMATIC_SIGN_OUT_SETTING,
  AUTOMATIC_SIGN_OUT_DEFAULT,
  ENDEVOR_CONFIGURATION,
  MAX_PARALLEL_REQUESTS_DEFAULT,
  MAX_PARALLEL_REQUESTS_SETTING,
  PROFILES_CONFIGURATION,
  SYNC_WITH_PROFILES_SETTING,
  SYNC_WITH_PROFILES_DEFAULT,
} from '../../constants';
import { updateGlobalSettingsValue } from '@local/vscode-wrapper/settings';
import {
  getMaxParallelRequestsSettingValue,
  getAutomaticSignOutSettingsValue,
  getSyncWithProfilesSettingValue,
  turnOnAutomaticSignOut,
} from '../settings';
import { ConfigurationTarget, workspace } from 'vscode';
import { SyncWithProfiles } from '../_ext/v2/Settings';

describe('extension settings', () => {
  type NotDefined = undefined;
  let beforeTestsRequestsAmount: number | NotDefined;
  let beforeTestsAutoSignOut: boolean | NotDefined;
  let beforeTestsSyncWithProfiles: SyncWithProfiles | NotDefined;
  beforeEach(async () => {
    beforeTestsRequestsAmount = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(MAX_PARALLEL_REQUESTS_SETTING);
    beforeTestsAutoSignOut = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(AUTOMATIC_SIGN_OUT_SETTING);
    beforeTestsSyncWithProfiles = workspace
      .getConfiguration(PROFILES_CONFIGURATION)
      .get(SYNC_WITH_PROFILES_SETTING);
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        MAX_PARALLEL_REQUESTS_SETTING,
        MAX_PARALLEL_REQUESTS_DEFAULT,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        AUTOMATIC_SIGN_OUT_DEFAULT,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(PROFILES_CONFIGURATION)
      .update(
        SYNC_WITH_PROFILES_SETTING,
        SYNC_WITH_PROFILES_DEFAULT,
        ConfigurationTarget.Global
      );
  });
  afterEach(async () => {
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        MAX_PARALLEL_REQUESTS_SETTING,
        beforeTestsRequestsAmount,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        beforeTestsAutoSignOut,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(PROFILES_CONFIGURATION)
      .update(
        SYNC_WITH_PROFILES_SETTING,
        beforeTestsSyncWithProfiles,
        ConfigurationTarget.Global
      );
  });

  it('should return max Endevor parallel requests amount', async () => {
    // arrange
    const requestsAmount = 10;
    await updateGlobalSettingsValue(ENDEVOR_CONFIGURATION)(
      MAX_PARALLEL_REQUESTS_SETTING,
      requestsAmount
    );
    // act
    const actualRequestsAmount = getMaxParallelRequestsSettingValue();
    // assert
    assert.equal(actualRequestsAmount, requestsAmount);
  });

  it('should turn on auto signout', async () => {
    // act
    await turnOnAutomaticSignOut();
    // assert
    const actualValue = getAutomaticSignOutSettingsValue();
    assert.isTrue(actualValue);
  });
  it('should return the profiles sync feature flag value', async () => {
    // arrange
    const syncWithProfiles = true;
    await updateGlobalSettingsValue(PROFILES_CONFIGURATION)(
      SYNC_WITH_PROFILES_SETTING,
      syncWithProfiles
    );
    // act
    const actualFlagValue = getSyncWithProfilesSettingValue();
    // assert
    assert.strictEqual(actualFlagValue, syncWithProfiles);
  });
});
