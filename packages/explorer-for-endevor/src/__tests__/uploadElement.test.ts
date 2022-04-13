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

import { commands, ConfigurationTarget, Uri, workspace } from 'vscode';
import { CommandId } from '../commands/id';
import { uploadElementCommand } from '../commands/uploadElement';
import {
  AUTOMATIC_SIGN_OUT_SETTING,
  EDIT_FOLDER_SETTING,
  ENDEVOR_CONFIGURATION,
} from '../constants';
import * as sinon from 'sinon';
import {
  ActionChangeControlValue,
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toEditedElementUri } from '../uri/editedElementUri';
import { isError } from '../utils';
import * as assert from 'assert';
import {
  mockDeletingFileWith,
  mockGettingFileContentWith,
  mockGettingWorkspaceUri,
  mockSavingFileIntoWorkspaceDirectory,
} from '../_mocks/workspace';
import { TextEncoder } from 'util';
import {
  mockOverrideSignOutElement,
  mockSignOutElement,
  mockUploadingElementWith,
} from '../_mocks/endevor';
import { mockClosingActiveEditorWith } from '../_mocks/window';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
  mockAskingForSignout,
  mockAskingForUploadLocation,
} from '../_mocks/dialogs';
import {
  FingerprintMismatchError,
  SignoutError,
} from '@local/endevor/_doc/Error';
import * as compareDialog from '../commands/compareElementWithRemoteVersion';
import * as path from 'path';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';
import { Actions } from '../_doc/Actions';

describe('uploading edited element', () => {
  before(() => {
    commands.registerCommand(CommandId.UPLOAD_ELEMENT, uploadElementCommand);
  });

  type NotDefined = undefined;
  let beforeTestsAutoSignOut: boolean | NotDefined;
  let beforeTestsEditTempFolder: string | NotDefined;

  beforeEach(async () => {
    beforeTestsAutoSignOut = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(AUTOMATIC_SIGN_OUT_SETTING);
    beforeTestsEditTempFolder = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(EDIT_FOLDER_SETTING);
  });
  afterEach(async () => {
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        beforeTestsAutoSignOut,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        beforeTestsEditTempFolder,
        ConfigurationTarget.Global
      );
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const serviceName = 'serviceName';
  const service: Service = {
    location: {
      port: 1234,
      protocol: 'http',
      hostname: 'anything',
      basePath: 'anythingx2',
    },
    credential: {
      type: CredentialType.BASE,
      user: 'test',
      password: 'something',
    },
    rejectUnauthorized: false,
  };
  const searchLocationName = 'searchLocationName';
  const searchLocation: ElementSearchLocation = {
    instance: 'ANY-INSTANCE',
  };
  const element: Element = {
    instance: 'ANY',
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'TYP',
    name: 'ELM',
    extension: 'ext',
  };
  const elementFingerprint = 'some_value';
  const editedElementFilePath = '/some/temp/element.cbl';
  const editedElementUri = toEditedElementUri(editedElementFilePath)({
    serviceName,
    searchLocationName,
    element,
    service,
    searchLocation,
    fingerprint: elementFingerprint,
  });
  if (isError(editedElementUri)) {
    const error = editedElementUri;
    assert.fail(
      `Uri was not built correctly for tests because of: ${error.message}`
    );
  }

  it('should upload element', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: element.type,
      element: element.name,
      instance: element.instance,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadElementContentStub = mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([undefined]);
    const closeActiveEditorsStub = mockClosingActiveEditorWith(
      Promise.resolve()
    );
    const deleteTempFilesStub = mockDeletingFileWith([
      [editedElementUri, Promise.resolve()],
    ]);
    const dispatchUpdatedElementAction = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchUpdatedElementAction,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    const [generalUploadFunctionStub] = uploadElementContentStub;
    assert.ok(
      generalUploadFunctionStub.called,
      `Upload element content was not called`
    );
    assert.ok(
      closeActiveEditorsStub.called,
      `Edited element editor was not closed`
    );
    assert.ok(deleteTempFilesStub.called, `Delete temp file was not called`);
    assert.deepStrictEqual(
      dispatchUpdatedElementAction.called,
      true,
      `Expexted dispatch for upload element was not called.`
    );
    const expectedUpdatedElementAction = {
      type: Actions.ELEMENT_UPDATED,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expectedUpdatedElementAction,
      dispatchUpdatedElementAction.args[0]?.[0],
      `Expexted dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  it('should call compare dialogs function', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: element.type,
      element: element.name,
      instance: element.instance,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadError = new FingerprintMismatchError('something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(uploadError, FingerprintMismatchError.prototype);
    mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([uploadError]);
    // can be anything, but URI
    const workspaceUri = editedElementUri;
    mockGettingWorkspaceUri(workspaceUri);
    const expectedElementDirectory = 'test-edit-folder';
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        expectedElementDirectory,
        ConfigurationTarget.Global
      );
    const editedElementTempDirectory = Uri.file(
      path.dirname(editedElementFilePath)
    );
    const localElementVersionTempFilePath = editedElementFilePath;
    const [saveLocalElementVersionStub] = mockSavingFileIntoWorkspaceDirectory(
      editedElementTempDirectory,
      {
        content: editedElementContent,
        extension: element.extension,
        name: element.name,
      }
    )(Uri.file(localElementVersionTempFilePath));
    const comparingElementDialogStub = mockComparingElementsDialog(
      service,
      searchLocation,
      uploadChangeControlValue,
      uploadLocation,
      serviceName,
      searchLocationName,
      localElementVersionTempFilePath
    )();
    const dispatchUpdatedElementAction = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchUpdatedElementAction,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(
      saveLocalElementVersionStub.called,
      `Save local version of the element was not called`
    );
    assert.ok(
      comparingElementDialogStub.called,
      `Compare elements dialog was not closed`
    );
    const expectedUpdatedElementAction = {
      type: Actions.ELEMENT_UPDATED,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expectedUpdatedElementAction,
      dispatchUpdatedElementAction.args[0]?.[0],
      `Expexted dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  type CompareElementsStub = sinon.SinonStub<
    [service: Service, searchLocation: ElementSearchLocation],
    (
      uploadChangeControlValue: ActionChangeControlValue
    ) => (
      element: Element,
      editedElementFilePath: string,
      serviceName: EndevorServiceName,
      searchLocationname: ElementLocationName
    ) => (localVersionElementTempFilePath: string) => Promise<void | Error>
  >;

  const mockComparingElementsDialog =
    (
      serviceArg: Service,
      searchLocationArg: ElementSearchLocation,
      uploadChangeControlValueArg: ActionChangeControlValue,
      elementArg: Element,
      serviceNameArg: EndevorServiceName,
      searchLocationnameArg: ElementLocationName,
      localVersionElementTempFilePathArg: string
    ) =>
    (mockResult?: Error): CompareElementsStub => {
      const withLocalVersionFileStub = sinon
        .stub<
          [localVersionElementTempFilePath: string],
          Promise<void | Error>
        >()
        .withArgs(localVersionElementTempFilePathArg)
        .resolves(mockResult);
      const withElementStub = sinon
        .stub<
          [
            element: Element,
            serviceName: EndevorServiceName,
            searchLocationname: ElementLocationName
          ],
          (localVersionElementTempFilePath: string) => Promise<void | Error>
        >()
        .withArgs(elementArg, serviceNameArg, searchLocationnameArg)
        .returns(withLocalVersionFileStub);
      const withChangeControlValueStub = sinon
        .stub<
          [uploadChangeControlValue: ActionChangeControlValue],
          (
            element: Element,
            serviceName: EndevorServiceName,
            searchLocationname: ElementLocationName
          ) => (
            localVersionElementTempFilePath: string
          ) => Promise<void | Error>
        >()
        .withArgs(uploadChangeControlValueArg)
        .returns(withElementStub);
      return sinon
        .stub(compareDialog, 'compareElementWithRemoteVersion')
        .withArgs(serviceArg, searchLocationArg)
        .returns(withChangeControlValueStub);
    };

  it('should signout element during uploading', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: element.type,
      element: element.name,
      instance: element.instance,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadError = new SignoutError('something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(uploadError, SignoutError.prototype);
    const [uploadElementStub] = mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([uploadError, undefined]);
    mockAskingForSignout([uploadLocation.name])({
      signOutElements: true,
      automaticSignOut: false,
    });
    const [signoutElementStub] = mockSignOutElement(
      service,
      uploadLocation,
      uploadChangeControlValue
    )();
    const dispatchActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchActions,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(signoutElementStub.called, `Signout element was not called`);
    assert.ok(
      uploadElementStub.calledTwice,
      `Upload element content was not called twice, it was called: ${uploadElementStub.callCount}`
    );
    const expectedDispatchedActions = 2;
    assert.deepStrictEqual(
      dispatchActions.callCount,
      expectedDispatchedActions,
      `Expexted dispatch for upload element to have been called ${expectedDispatchedActions} times, but it was called ${dispatchActions.callCount} times.`
    );
    const expextedSignOutAction = {
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expextedSignOutAction,
      dispatchActions.args[0]?.[0],
      `Expexted dispatch for signout element on upload to have been called with ${JSON.stringify(
        expextedSignOutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
    const expextedUpdateAction = {
      type: Actions.ELEMENT_UPDATED,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expextedUpdateAction,
      dispatchActions.args[1]?.[0],
      `Expexted dispatch for element update on upload with signout to have been called with ${JSON.stringify(
        expextedUpdateAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[1]?.[0]
      )}`
    );
  });

  it('should override signout of element during uploading', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: element.type,
      element: element.name,
      instance: element.instance,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadError = new SignoutError('something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(uploadError, SignoutError.prototype);
    const [uploadElementStub] = mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([uploadError, undefined]);
    mockAskingForSignout([uploadLocation.name])({
      signOutElements: true,
      automaticSignOut: false,
    });
    const signoutError = uploadError;
    const [signoutElementStub] = mockSignOutElement(
      service,
      uploadLocation,
      uploadChangeControlValue
    )(signoutError);
    mockAskingForOverrideSignout([uploadLocation.name])(true);
    const [overrideSignoutElementStub] = mockOverrideSignOutElement(
      service,
      uploadLocation,
      uploadChangeControlValue
    )();
    const dispatchActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchActions,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(signoutElementStub.called, `Signout element was not called`);
    assert.ok(
      overrideSignoutElementStub.called,
      `Override signout element was not called`
    );
    assert.ok(
      uploadElementStub.calledTwice,
      `Upload element content was not called twice, it was called: ${uploadElementStub.callCount}`
    );
    const expectedDispatchedActions = 2;
    assert.deepStrictEqual(
      dispatchActions.callCount,
      expectedDispatchedActions,
      `Expexted dispatch for upload element to have been called ${expectedDispatchedActions} times, but it was called ${dispatchActions.callCount} times.`
    );
    const expextedSignOutAction = {
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expextedSignOutAction,
      dispatchActions.args[0]?.[0],
      `Expexted dispatch for override signout element on upload to have been called with ${JSON.stringify(
        expextedSignOutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
    const expectedUpdateAction = {
      type: Actions.ELEMENT_UPDATED,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      expectedUpdateAction,
      dispatchActions.args[1]?.[0],
      `Expexted dispatch for element update on upload with override signout to have been called with ${JSON.stringify(
        expectedUpdateAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[1]?.[0]
      )}`
    );
  });
});
