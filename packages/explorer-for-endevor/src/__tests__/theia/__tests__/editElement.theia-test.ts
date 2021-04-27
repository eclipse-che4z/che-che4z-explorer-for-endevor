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

describe('Edit Element', () => {
  beforeAll(async () => {
    await driverChrome.openBrowser();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    await driverChrome.OpenTheiaInChrome();
    await driverChrome.sleepTime(SLEEPTIME);
  });

  it('Should Open an Element for EDIT', async () => {
    const editElement = await driverChrome.editElement();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(editElement).toContain(
      '\\.e4e\\AENERIC-version-01346293007E699D.cbl'
    );
  });

  it('Should Element Edited and Uploaded back', async () => {
    const editedElement = await driverChrome.editedElement();
    await driverChrome.sleepTime(SHORTSLEEPTIME);
    expect(editedElement).toContain('Test Edited');
  });

  afterAll(async () => driverChrome.closeBrowser());
});
