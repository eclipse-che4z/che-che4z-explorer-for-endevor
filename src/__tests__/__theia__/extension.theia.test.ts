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

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as driverChrome from "../__theia__/theia/extension.theiaChrome";

const TIMEOUT = 45000;
const SLEEPTIME = 10000;
const SHORTSLEEPTIME  = 2000;
declare var it: any;
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Locate elements", () => {

    before(async () => {
        await driverChrome.openBrowser();
        await driverChrome.sleepTime(SHORTSLEEPTIME);
        await driverChrome.OpenTheiaInChrome();
        await driverChrome.sleepTime(SLEEPTIME);
        await driverChrome.clickOnExplorerForEndevor();
        await driverChrome.sleepTime(SLEEPTIME);
    });

    it("should verify extension title", async () => {
        const extensionTitle = await driverChrome.getExtensionTitle();
        await driverChrome.sleepTime(SHORTSLEEPTIME);
        console.log("EEE Title  : " + extensionTitle );
        expect(extensionTitle).to.equal("EXPLORER FOR ENDEVOR: EXPLORER FOR ENDEVOR");
    });

    it("should verify Add profile element ", async () => {
        const addProfileTitle = await driverChrome.getAddProfileTitle();
        await driverChrome.sleepTime(SHORTSLEEPTIME);
        expect(addProfileTitle).to.equal("Add a New Profile");
    });

    after(async () => driverChrome.closeBrowser());
});

