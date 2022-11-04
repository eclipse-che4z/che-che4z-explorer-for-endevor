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

import {
  ElementMapPath,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import * as workspace from '@local/vscode-wrapper/workspace';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import * as changeControlValueDialogs from '../change-control/endevorChangeControlDialogs';
import * as signoutDialogs from '../change-control/signOutDialogs';
import * as uploadLocationDialogs from '../locations/endevorUploadLocationDialogs';
import * as printListingDialogs from '../listings/showListingDialogs';

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
  [defaultValue: ElementSearchLocation],
  Promise<ElementMapPath | undefined>
>;

export const mockAskingForUploadLocation =
  (_elementPrefilledLocationArg: ElementSearchLocation) =>
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

type AskForForPrintListingStub = sinon.SinonStub<
  [ReadonlyArray<string>],
  Promise<boolean>
>;

export const mockAskingForPrintListing = (
  mockResult: boolean
): AskForForPrintListingStub => {
  return sinon
    .stub(printListingDialogs, 'askToShowListing')
    .withArgs(sinon.match.any)
    .resolves(mockResult);
};
