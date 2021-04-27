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

import {
  Builder,
  By,
  Key,
  until,
  Button,
  ThenableWebDriver,
} from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import {
  TheiaLocator,
  EndevorProfileLocator,
  EndevorLocationProfileLocator,
  EditLocator,
  EditedLocator,
  viewDetailsLocator,
  RetrieveElementWithDepLocator,
  RetrieveElementLocator,
  RetrievedElementLocator,
  GenerateElementLocator,
} from './locators';

const WAITTIME = 30000;
let driverChrome: ThenableWebDriver;
const SHORTSLEEPTIME = 2000;
const Wait5SEC = 5000;

import * as dotenv from 'dotenv';
dotenv.config();

const getEndevorUrl = (url: string) => {
  const endevor_url = process.env.ENDEVOR_URL;
  if (!endevor_url)
    throw new Error(`Environment variable ${url} was not defined in .env`);
  return endevor_url;
};
const getEndevorUser = (user: string) => {
  const endevor_user = process.env.ENDEVOR_USER;
  if (!endevor_user)
    throw new Error(`Environment variable ${user} was not defined in .env`);
  return endevor_user;
};
const getEndevorPass = (pass: string) => {
  const endevor_password = process.env.ENDEVOR_PASS;
  if (!endevor_password)
    throw new Error(`Environment variable ${pass} was not defined in .env`);
  return endevor_password;
};

const endevor_url = getEndevorUrl('ENDEVOR_URL');
const endevor_username = getEndevorUser('ENDEVOR_USER');
const endevor_password = getEndevorPass('ENDEVOR_PASS');

export async function openBrowser() {
  const chromeOptions = new chrome.Options();
  chromeOptions.addArguments('headless');
  chromeOptions.addArguments('window-size=1200,1100');
  driverChrome = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();
}

export async function OpenTheiaInChrome() {
  await driverChrome.get(TheiaLocator.theiaUrl);
}

export async function sleepTime(sleeptime: number) {
  await driverChrome.sleep(sleeptime);
}

export function closeBrowser() {
  driverChrome.close();
}

export async function addEndevorProfile(endevorProfileName: string) {
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)))
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.addProfileId)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const createProfile = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  createProfile.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const profileName = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  profileName.sendKeys(endevorProfileName);
  profileName.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const url = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  url.sendKeys(endevor_url);
  url.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const username = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  username.sendKeys(endevor_username);
  username.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const password = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  password.sendKeys(endevor_password);
  password.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const authorizedConnection = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorProfileLocator.emptyInputBox))
  );
  authorizedConnection.sendKeys('False');
  authorizedConnection.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.refreshTreeId)))
    .click();
  const createdProfileName = await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)))
    .getText();
  return createdProfileName;
}

export async function addEndevorLocationProfile(
  endevorLocationProfileName: string
) {
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)))
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(EndevorLocationProfileLocator.addLocationProfileXpath)
      )
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const createProfile = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  createProfile.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const profileName = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  profileName.sendKeys(endevorLocationProfileName);
  profileName.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const instance = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  instance.sendKeys('WEBSMFTS');
  instance.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const endevorPath = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  endevorPath.sendKeys('SMPLPROD/1/FINANCE/ACCTREC/*');
  endevorPath.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const ccid = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  ccid.sendKeys('');
  ccid.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const comment = await driverChrome.wait(
    until.elementLocated(By.xpath(EndevorLocationProfileLocator.emptyInputBox))
  );
  comment.sendKeys('');
  comment.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.refreshTreeId)))
    .click();
  const createdProfileName = await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      )
    )
    .getText();
  return createdProfileName;
}

export async function openWorkspace() {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.fileMenuXpath)), WAITTIME)
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.openOptionXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.clickOnOpenXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(Wait5SEC);
}

export async function closeWorkspace() {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.fileMenuXpath)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.workpsaceCloseXpath)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.okButtonXpath)), WAITTIME)
    .click();
  await driverChrome.sleep(Wait5SEC);
}

export async function editElement() {
  await openWorkspace();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.financeId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.accrecId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.cobolId)), WAITTIME)
    .click();
  const edit = await driverChrome.wait(
    until.elementLocated(By.id(EditedLocator.elementId)),
    WAITTIME
  );
  await driverChrome.actions().click(edit, Button.RIGHT).perform();
  await driverChrome
    .wait(until.elementLocated(By.xpath(EditLocator.editXpath)), WAITTIME)
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const editedElement = await driverChrome
    .wait(until.elementLocated(By.xpath(EditLocator.editTabXpath)), WAITTIME)
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome.actions().sendKeys('Test Edited').perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys(Key.chord(Key.CONTROL + 's'))
    .perform();
  const uploadElement = await driverChrome.wait(
    until.elementLocated(By.xpath(EditLocator.uploadElementXpath)),
    WAITTIME
  );
  await driverChrome
    .actions()
    .sendKeys(Key.chord(Key.CONTROL + 'a'))
    .perform();
  await driverChrome.actions().sendKeys(Key.DELETE).perform();
  uploadElement.sendKeys('SMPLPROD/1/FINANCE/ACCTREC/COBOL/AENERIC');
  uploadElement.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const ccid = await driverChrome.wait(
    until.elementLocated(By.xpath(EditLocator.ccidXpath)),
    WAITTIME
  );
  ccid.sendKeys('theia_test');
  ccid.sendKeys(Key.ENTER);
  await driverChrome.sleep(SHORTSLEEPTIME);
  const comment = await driverChrome.wait(
    until.elementLocated(By.xpath(EditLocator.commentXpath)),
    WAITTIME
  );
  comment.sendKeys('Theia test comment');
  comment.sendKeys(Key.ENTER);
  await driverChrome.sleep(Wait5SEC);
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.refreshTreeId)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await closeWorkspace();
  return editedElement;
}

export async function editedElement() {
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.financeId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.accrecId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.cobolId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(EditedLocator.elementId)), WAITTIME)
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const editedElement = await driverChrome
    .wait(
      until.elementLocated(By.xpath(EditedLocator.editedContentXpath)),
      WAITTIME
    )
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  return editedElement;
}

export async function generateElement() {
  await openWorkspace();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.financeId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.accrecId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.cobolId)), WAITTIME)
    .click();
  const generateElement = await driverChrome.wait(
    until.elementLocated(By.id(viewDetailsLocator.elementId))
  );
  await driverChrome.actions().click(generateElement, Button.RIGHT).perform();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(GenerateElementLocator.generateElementXpath)
      ),
      WAITTIME
    )
    .click();
  const generatedElement = await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(GenerateElementLocator.notificationMsgXpath)
      ),
      WAITTIME
    )
    .getText();
  await closeWorkspace();
  return generatedElement;
}

export async function retrieveElement() {
  await openWorkspace();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.financeId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.accrecId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.cobolId)), WAITTIME)
    .click();
  const retriveElement = await driverChrome.wait(
    until.elementLocated(By.id(viewDetailsLocator.elementId))
  );
  await driverChrome.actions().click(retriveElement, Button.RIGHT).perform();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementLocator.retrieveElementXpath)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys('Retrieved Element and edited Successfully for Test')
    .perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys(Key.chord(Key.CONTROL + 's'))
    .perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const retrivedElement = await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementLocator.retrivedElementTabXpath)
      ),
      WAITTIME
    )
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementLocator.closeRetreiveTabXpath)
      ),
      WAITTIME
    )
    .click();
  await closeWorkspace();
  return retrivedElement;
}

export async function retrievedElement() {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.fileMenuXpath)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.openOptionXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome.actions().sendKeys('COBOL').perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.clickOnOpenXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(Wait5SEC);
  await driverChrome
    .wait(until.elementLocated(By.id(TheiaLocator.explorerId)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrievedElementLocator.retrievedElementXpath)
      ),
      WAITTIME
    )
    .click();
  const editedElement = await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrievedElementLocator.retrievedContentXpath)
      ),
      WAITTIME
    )
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await closeWorkspace();
  return editedElement;
}

export async function retrieveElementWithDependecies() {
  await openWorkspace();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)),
      WAITTIME
    )
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.financeId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.accrecId)), WAITTIME)
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(viewDetailsLocator.cobolId)), WAITTIME)
    .click();
  const retriveElementDep = await driverChrome.wait(
    until.elementLocated(By.id(RetrieveElementWithDepLocator.elementId)),
    WAITTIME
  );
  await driverChrome.actions().click(retriveElementDep, Button.RIGHT).perform();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementWithDepLocator.retrieveElementDepXpath)
      ),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(Wait5SEC);
  await driverChrome
    .actions()
    .sendKeys(
      'Retrieved Element with Dependencies and edited Successfully for Test'
    )
    .perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys(Key.chord(Key.CONTROL + 's'))
    .perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const retrivedElementWithDep = await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementWithDepLocator.retrivedElementDepTabXpath)
      ),
      WAITTIME
    )
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrieveElementWithDepLocator.closeRetreiveDepTabXpath)
      ),
      WAITTIME
    )
    .click();
  await closeWorkspace();
  return retrivedElementWithDep;
}

export async function dependeciesOfRetrivedElement() {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.fileMenuXpath)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.openOptionXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome.actions().sendKeys('COPY').perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.clickOnOpenXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(Wait5SEC);
  await driverChrome
    .wait(until.elementLocated(By.id(TheiaLocator.explorerId)), WAITTIME)
    .click();
  const dependencies1 = await driverChrome
    .wait(
      until.elementLocated(By.xpath(RetrieveElementWithDepLocator.dep1Xpath)),
      WAITTIME
    )
    .getText();
  const dependencies2 = await driverChrome
    .wait(
      until.elementLocated(By.xpath(RetrieveElementWithDepLocator.dep2Xpath)),
      WAITTIME
    )
    .getText();
  const dependencies3 = await driverChrome
    .wait(
      until.elementLocated(By.xpath(RetrieveElementWithDepLocator.dep3Xpath)),
      WAITTIME
    )
    .getText();
  const dependencies4 = await driverChrome
    .wait(
      until.elementLocated(By.xpath(RetrieveElementWithDepLocator.dep4Xpath)),
      WAITTIME
    )
    .getText();
  await closeWorkspace();
  return [dependencies1, dependencies2, dependencies3, dependencies4];
}

export async function retrievedElementWithDependeciesEdited() {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.fileMenuXpath)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.openOptionXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome.actions().sendKeys('COBOL').perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.clickOnOpenXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(Wait5SEC);
  await driverChrome
    .wait(until.elementLocated(By.id(TheiaLocator.explorerId)), WAITTIME)
    .click();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrievedElementLocator.retrievedElementXpath)
      ),
      WAITTIME
    )
    .click();
  const retrivedElementWithDepEdited = await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(RetrievedElementLocator.retrievedContentXpath)
      ),
      WAITTIME
    )
    .getText();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await closeWorkspace();
  return retrivedElementWithDepEdited;
}

export async function deleteEndevorLocationProfile(
  endevorLocationProfileName: string
) {
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.terminalMenuXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(
      until.elementLocated(By.xpath(TheiaLocator.newTerminalOptionXpath)),
      WAITTIME
    )
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys(
      `zowe  profiles delete endevor-location-profile ${endevorLocationProfileName}`
    )
    .perform();
  await driverChrome.actions().sendKeys(Key.ENTER).perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.endevorExplorerId)))
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const removeEndevorLocationProfile = await driverChrome.wait(
    until.elementLocated(
      By.id(EndevorLocationProfileLocator.endevorLocationProfileId)
    )
  );
  await driverChrome
    .actions()
    .click(removeEndevorLocationProfile, Button.RIGHT)
    .perform();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(
          EndevorLocationProfileLocator.removeEndevorLocationProfileXpath
        )
      )
    )
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.refreshTreeId)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const endevorLocationProfile = await driverChrome
    .findElements(By.id(EndevorLocationProfileLocator.endevorLocationProfileId))
    .then((found) => !!found.length);
  if (!endevorLocationProfile) {
    return true;
  } else {
    return false;
  }
}

export async function deleteEndevorProfile(endevorProfileName: string) {
  await driverChrome
    .wait(until.elementLocated(By.xpath(TheiaLocator.terminalXpath)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  await driverChrome
    .actions()
    .sendKeys(`zowe  profiles delete endevor-profile ${endevorProfileName}`)
    .perform();
  await driverChrome.actions().sendKeys(Key.ENTER).perform();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const removeEndevorProfile = await driverChrome.wait(
    until.elementLocated(By.id(EndevorProfileLocator.endevorProfileId))
  );
  await driverChrome
    .actions()
    .click(removeEndevorProfile, Button.RIGHT)
    .perform();
  await driverChrome
    .wait(
      until.elementLocated(
        By.xpath(EndevorProfileLocator.removeEndevorProfileXpath)
      )
    )
    .click();
  await driverChrome
    .wait(until.elementLocated(By.id(EndevorProfileLocator.refreshTreeId)))
    .click();
  await driverChrome.sleep(SHORTSLEEPTIME);
  const endevorProfile = await driverChrome
    .findElements(By.id(EndevorProfileLocator.endevorProfileId))
    .then((found) => !!found.length);
  if (!endevorProfile) {
    return true;
  } else {
    return false;
  }
}
