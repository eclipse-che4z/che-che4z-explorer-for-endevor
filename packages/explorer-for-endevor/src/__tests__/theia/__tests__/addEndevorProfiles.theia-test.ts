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

import * as driverChrome from '../context_menu.theia';

const SLEEPTIME = 10000;
const SHORTSLEEPTIME = 2000;

describe('Add Endevor Profiles', () => {
  beforeAll(async () => {
    await driverChrome.openBrowser();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    await driverChrome.OpenTheiaInChrome();
    await driverChrome.sleepTime(SLEEPTIME);
  });

  it('Should Add Endevor Profile', async () => {
    const profileName = await driverChrome.addEndevorProfile(
      'EndevorTestProfile'
    );
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(profileName).toEqual('EndevorTestProfile');
  });

  it('Should Add Endevor Location Profile', async () => {
    const profileName = await driverChrome.addEndevorLocationProfile(
      'EndevorTestLocationProfile'
    );
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(profileName).toEqual('EndevorTestLocationProfile');
  });

  afterAll(async () => driverChrome.closeBrowser());
});
