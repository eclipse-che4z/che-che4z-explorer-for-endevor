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

describe('Retrieve an Element', () => {
  beforeAll(async () => {
    await driverChrome.openBrowser();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    await driverChrome.OpenTheiaInChrome();
    await driverChrome.sleepTime(SLEEPTIME);
  });

  it('Should Retrieve an Element', async () => {
    const retrieveElement = await driverChrome.retrieveElement();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(retrieveElement).toContain('\\COBOL\\ALEXSYNC.cbl');
  });

  it('Should Verify Retrieved Element Edited Successfully', async () => {
    const quickEditedElement = await driverChrome.retrievedElement();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(quickEditedElement).toContain(
      'Retrieved Element and edited Successfully for Test'
    );
  });

  afterAll(async () => driverChrome.closeBrowser());
});
