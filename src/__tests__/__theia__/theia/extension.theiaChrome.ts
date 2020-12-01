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

import { Builder, By, Key, until, Button } from "selenium-webdriver";
// tslint:disable-next-line: no-submodule-imports
import * as chrome from "selenium-webdriver/chrome";
import { TheiaLocator, addProfile } from "./Locators";

const WAITTIME = 30000;
const SHORTSLEEPTIME = 2000;
let driverChrome: any;

export async function openBrowser(){
    const chromeOptions = new chrome.Options();
    // chromeOptions.addArguments("headless");
    chromeOptions.addArguments("window-size=1200,1100");
    driverChrome = new Builder().forBrowser("chrome").setChromeOptions(chromeOptions).build();
}

export async function OpenTheiaInChrome(){
    await driverChrome.get(TheiaLocator.theiaUrl);
}

export async function clickOnExplorerForEndevor(){
    await driverChrome.wait(until.elementLocated(By.id(TheiaLocator.ExplorerForEndevorId)), WAITTIME).click();
}

export async function sleepTime(sleeptime: number){
    await driverChrome.sleep(sleeptime);
}

export async function refreshBrowser(){
    await driverChrome.navigate().refresh();
}

export function closeBrowser()
{
    driverChrome.close();
}

export async function getAddProfileTitle()
{
    const addProfileLink = await driverChrome.wait(until.elementLocated(By.id(addProfile.addProfileId)), WAITTIME).getText();
    return addProfileLink;
}

export async function clickOnAddProfile()
{
    await driverChrome.wait(until.elementLocated(By.id(addProfile.addProfileId)), WAITTIME).click();
    
}

export async function getExtensionTitle()
{
    const title = await driverChrome.wait(until.elementLocated(By.xpath(TheiaLocator.extensionTitleXpath)), WAITTIME).getText();
    return title;
}

