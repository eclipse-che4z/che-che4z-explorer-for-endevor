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

import { ElementMapPath } from '@local/endevor/_doc/Endevor';
import * as workspace from '@local/vscode-wrapper/workspace';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as changeControlValueDialogs from '../../../dialogs/change-control/endevorChangeControlDialogs';
import * as signoutDialogs from '../../../dialogs/change-control/signOutDialogs';
import * as uploadLocationDialogs from '../../../dialogs/locations/endevorUploadLocationDialogs';
import * as printListingDialogs from '../../../dialogs/listings/showListingDialogs';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import { SearchLocation } from '../../../_doc/Endevor';

type PrefilledDialogValue = {
  ccid?: string;
  comment?: string;
};

type AskForChangeControlStub = sinon.SinonStub<
  [PrefilledDialogValue],
  Promise<changeControlValueDialogs.DialogResult>
>;

export const mockAskingForChangeControlValue = (
  resolveWith: changeControlValueDialogs.DialogResult
): AskForChangeControlStub => {
  return sinon
    .stub(changeControlValueDialogs, 'askForChangeControlValue')
    .resolves(resolveWith);
};

type AskForOverrideSignoutStub = sinon.SinonStub<
  [ReadonlyArray<string>],
  Promise<boolean>
>;

export const mockAskingForOverrideSignout =
  (elementNamesArg: ReadonlyArray<string>) =>
  (mockResult: boolean): AskForOverrideSignoutStub => {
    return sinon
      .stub(signoutDialogs, 'askToOverrideSignOutForElements')
      .withArgs(elementNamesArg)
      .resolves(mockResult);
  };

type AskForSignoutStub = sinon.SinonStub<
  [ReadonlyArray<string>],
  Promise<{ signOutElements: boolean; automaticSignOut: boolean }>
>;

export const mockAskingForSignout =
  (elementNamesArg: ReadonlyArray<string>) =>
  (mockResult: {
    signOutElements: boolean;
    automaticSignOut: boolean;
  }): AskForSignoutStub => {
    return sinon
      .stub(signoutDialogs, 'askToSignOutElements')
      .withArgs(elementNamesArg)
      .resolves(mockResult);
  };

type AskForUploadLocationStub = sinon.SinonStub<
  [defaultValue: SearchLocation],
  Promise<ElementMapPath | undefined>
>;

export const mockAskingForUploadLocation =
  (_elementPrefilledLocationArg: SearchLocation) =>
  (mockResult: ElementMapPath): AskForUploadLocationStub => {
    return sinon
      .stub(uploadLocationDialogs, 'askForUploadLocation')
      .withArgs(sinon.match.any)
      .resolves(mockResult);
  };

type ChooseFileUriFromFsStub = sinon.SinonStub<[], Promise<Uri | undefined>>;

export const mockChooseFileUriFromFs = (
  mockResult: Uri
): ChooseFileUriFromFsStub => {
  return sinon
    .stub(workspace, 'chooseFileUriFromFs')
    .withArgs()
    .resolves(mockResult);
};

type AskForListingOrReportStub = sinon.SinonStub<
  [message: string, level?: MessageLevel],
  Promise<printListingDialogs.ChosenPrintOption>
>;

export const mockAskingForListing = (
  mockResult: printListingDialogs.ChosenPrintOption
): AskForListingOrReportStub => {
  return sinon
    .stub(printListingDialogs, 'askForListing')
    .withArgs(sinon.match.any)
    .resolves(mockResult);
};

export const mockAskingForListingOrReport = (
  mockResult: printListingDialogs.ChosenPrintOption
): AskForListingOrReportStub => {
  return sinon
    .stub(printListingDialogs, 'askForListingOrExecutionReport')
    .withArgs(sinon.match.any)
    .resolves(mockResult);
};

export const mockAskingForReport = (
  mockResult: printListingDialogs.ChosenPrintOption
): AskForListingOrReportStub => {
  return sinon
    .stub(printListingDialogs, 'askForExecutionReport')
    .withArgs(sinon.match.any)
    .resolves(mockResult);
};
