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

export const TheiaLocator = {
  theiaUrl: 'http://localhost:3000',

  terminalMenuXpath: "(//li[@class='p-MenuBar-item'])[8]",

  newTerminalOptionXpath: "(//li[@data-command='terminal:new'])",

  terminalXpath: "//div[@class='terminal xterm']",

  fileMenuXpath: "(//li[@class='p-MenuBar-item'])[1]",

  openOptionXpath: "(//div[@class='p-Menu-itemLabel'])[1]",

  clickOnOpenXpath: "//button[@class='theia-button main']",

  workpsaceCloseXpath: "//li[@data-command='workspace:close']",

  okButtonXpath: "//button[@class='theia-button main']",

  explorerId: 'shell-tab-explorer-view-container',
};

export const EndevorProfileLocator = {
  endevorExplorerId: 'shell-tab-plugin-view-container:e4eExplorerContainer',

  endevorProfileId: '/1:EndevorTestProfile',

  removeEndevorProfileXpath:
    "//li[@data-command='__plugin.menu.action.e4e.hideService']",

  addProfileId: '/0:Add a New Profile',

  emptyInputBox: "//input[@class='input empty']",

  refreshTreeId:
    '__plugin-view-container:e4eExplorerContainer_title:__plugin.view.title.action.e4e.refreshTreeView',
};

export const EndevorLocationProfileLocator = {
  endevorLocationProfileId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile',

  removeEndevorLocationProfileXpath:
    "//li[@data-command='__plugin.menu.action.e4e.hideElementLocation']",

  addLocationProfileXpath: "//div[@title='Add a New Location Profile']",

  emptyInputBox: "//input[@class='input empty']",
};

export const EditLocator = {
  editXpath: "//li[@data-command='__plugin.menu.action.e4e.quickEditElement']",

  editTabXpath:
    "//li[@class='p-TabBar-tab  theia-mod-active p-mod-closable p-mod-current']",

  uploadElementXpath:
    "//input[@title='environment/stageNum/system/subsystem/type/element']",

  ccidXpath: "//input[@title='CCID']",

  commentXpath: "//input[@class='input empty']",

  closeEditTabXpath: "(//div[@class='p-TabBar-tabCloseIcon'])[25]",
};

export const EditedLocator = {
  editedElementXpath:
    "//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow']",

  editedContentXpath: "//div[@class='view-lines']",

  elementId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE/0:ACCTREC/0:COBOL/0:AENERIC',
};

export const viewDetailsLocator = {
  financeId: '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE',

  accrecId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE/0:ACCTREC',

  cobolId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE/0:ACCTREC/0:COBOL',

  elementId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE/0:ACCTREC/0:COBOL/0:ALEXSYNC',
};

export const GenerateElementLocator = {
  generateElementXpath:
    "//li[@data-command='__plugin.menu.action.e4e.generateElement']",

  notificationMsgXpath: "(//div[@class='theia-notification-message'])[1]",
};

export const RetrieveElementWithDepLocator = {
  retrieveElementDepXpath:
    "//li[@data-command='__plugin.menu.action.e4e.retrieveElementWithDependencies']",

  retrivedElementDepTabXpath:
    "//li[@class='p-TabBar-tab  theia-mod-active p-mod-closable p-mod-current']",

  closeRetreiveDepTabXpath: "(//div[@class='p-TabBar-tabCloseIcon'])[25]",

  elementId:
    '/1:EndevorTestProfile/0:EndevorTestLocationProfile/0:FINANCE/0:ACCTREC/0:COBOL/3:CAWDEM2',

  dep1Xpath:
    "(//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow'])[1]",

  dep2Xpath:
    "(//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow'])[2]",

  dep3Xpath:
    "(//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow'])[3]",

  dep4Xpath:
    "(//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow'])[4]",
};

export const RetrieveElementLocator = {
  retrieveElementXpath:
    "//li[@data-command='__plugin.menu.action.e4e.retrieveElement']",

  retrivedElementTabXpath:
    "//li[@class='p-TabBar-tab  theia-mod-active p-mod-closable p-mod-current']",

  closeRetreiveTabXpath: "(//div[@class='p-TabBar-tabCloseIcon'])[25]",
};

export const RetrievedElementLocator = {
  retrievedElementXpath:
    "//div[@class='theia-TreeNodeSegment theia-TreeNodeSegmentGrow']",

  retrievedContentXpath: "//div[@class='view-lines']",
};
