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
  ENDEVOR_CONFIGURATION,
} from '../constants';
import * as sinon from 'sinon';
import {
  ActionChangeControlValue,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  ErrorUpdateResponse,
  Service,
  ServiceApiVersion,
  SignOutParams,
  SubSystemMapPath,
  SuccessUpdateResponse,
  UpdateStatus,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toEditedElementUri } from '../uri/editedElementUri';
import { isError } from '../utils';
import * as assert from 'assert';
import {
  mockDeletingFileWith,
  mockGettingFileContentWith,
  mockSavingFileIntoWorkspaceDirectory,
} from '../_mocks/workspace';
import { TextEncoder } from 'util';
import {
  mockSignOutElement,
  mockUploadingElementWith,
} from '../_mocks/endevor';
import { mockClosingActiveEditorWith } from '../_mocks/window';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
  mockAskingForSignout,
  mockAskingForUploadLocation,
} from '../dialogs/_mocks/dialogs';
import {
  FingerprintMismatchError,
  SignoutError,
} from '@local/endevor/_doc/Error';
import * as compareDialog from '../commands/compareElementWithRemoteVersion';
import * as path from 'path';
import {
  Actions,
  ElementAdded,
  ElementUpdatedFromUpTheMap,
} from '../store/_doc/Actions';
import { Id, Source } from '../store/storage/_doc/Storage';

describe('uploading an edited element', () => {
  before(() => {
    commands.registerCommand(CommandId.UPLOAD_ELEMENT, uploadElementCommand);
  });

  type NotDefined = undefined;
  let beforeTestsAutoSignOut: boolean | NotDefined;

  beforeEach(async () => {
    beforeTestsAutoSignOut = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(AUTOMATIC_SIGN_OUT_SETTING);
  });
  afterEach(async () => {
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        beforeTestsAutoSignOut,
        ConfigurationTarget.Global
      );
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const serviceId: Id = { name: 'serviceName', source: Source.INTERNAL };
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
    apiVersion: ServiceApiVersion.V2,
  };
  const searchLocationId: Id = {
    name: 'searchLocationName',
    source: Source.INTERNAL,
  };
  const vagueSearchLocation: ElementSearchLocation = {
    configuration: 'ANY-CONFIG',
    environment: 'TEST',
    stageNumber: '1',
  };
  const preciseSearchLocation: ElementSearchLocation = {
    configuration: vagueSearchLocation.configuration,
    environment: vagueSearchLocation.environment,
    stageNumber: vagueSearchLocation.stageNumber,
    system: 'ANY-SYS',
    subsystem: 'SUBSYS2',
  };
  const subsystemMapPathDownTheMap: SubSystemMapPath = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    environment: preciseSearchLocation.environment!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stageNumber: preciseSearchLocation.stageNumber!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    system: preciseSearchLocation.system!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    subSystem: preciseSearchLocation.subsystem!,
  };
  const element: Element = {
    configuration: 'ANY',
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

  it('should upload an element in place', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
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
    )([successResult]);
    const closeActiveEditorsStub = mockClosingActiveEditorWith(
      Promise.resolve()
    );
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
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
        `Test failed because of uncaught error inside command: ${e.message}`
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
      `Expected dispatch for upload element was not called.`
    );
    const expectedUpdatedElementAction = {
      type: Actions.ELEMENT_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element: uploadLocation,
    };
    assert.deepStrictEqual(
      dispatchUpdatedElementAction.args[0]?.[0],
      expectedUpdatedElementAction,
      `Expected dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  it('should upload a new element', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const newUploadLocation = {
      ...element,
      name: 'NEW-ELM',
    };
    mockAskingForUploadLocation(prefilledLocationDialogValue)(
      newUploadLocation
    );
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadElementContentStub = mockUploadingElementWith(
      service,
      newUploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([successResult]);
    const closeActiveEditorsStub = mockClosingActiveEditorWith(
      Promise.resolve()
    );
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
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
        `Test failed because of uncaught error inside command: ${e.message}`
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
      `Expected dispatch for upload element was not called.`
    );
    const expectedUpdatedElementAction: ElementAdded = {
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId,
      element: newUploadLocation,
    };
    assert.deepStrictEqual(
      dispatchUpdatedElementAction.args[0]?.[0],
      expectedUpdatedElementAction,
      `Expected dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  it('should upload an element from up the map even with a vague search location', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: vagueSearchLocation.environment,
      stageNumber: vagueSearchLocation.stageNumber,
      system: vagueSearchLocation.system,
      subsystem: vagueSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const existingLocationDownTheMap: ElementMapPath = {
      name: element.name,
      type: element.type,
      configuration: preciseSearchLocation.configuration,
      ...subsystemMapPathDownTheMap,
    };
    mockAskingForUploadLocation(prefilledLocationDialogValue)(
      existingLocationDownTheMap
    );
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const uploadElementContentStub = mockUploadingElementWith(
      service,
      existingLocationDownTheMap,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([successResult]);
    const closeActiveEditorsStub = mockClosingActiveEditorWith(
      Promise.resolve()
    );
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: vagueSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
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
        `Test failed because of uncaugt error inside command: ${e.message}`
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
      `Expected dispatch for upload element was not called.`
    );
    const expectedUpdatedElementAction: ElementUpdatedFromUpTheMap = {
      type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP,
      targetLocation: existingLocationDownTheMap,
      pathUpTheMap: element,
      treePath: {
        serviceId,
        searchLocationId,
        searchLocation: subsystemMapPathDownTheMap,
      },
    };
    assert.deepStrictEqual(
      dispatchUpdatedElementAction.args[0]?.[0],
      expectedUpdatedElementAction,
      `Expected dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  it('should call compare dialogs function for an element in place', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
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
    const failedResult: ErrorUpdateResponse = {
      status: UpdateStatus.ERROR,
      additionalDetails: {
        error: new FingerprintMismatchError('error'),
      },
    };
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      failedResult.additionalDetails.error,
      FingerprintMismatchError.prototype
    );
    mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([failedResult]);
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    // can be anything, but URI
    const editedElementTempDirectory = Uri.file(
      path.dirname(editedElementFilePath)
    );
    const localElementVersionTempFilePath = editedElementFilePath;
    const [saveLocalElementVersionStub] = mockSavingFileIntoWorkspaceDirectory(
      editedElementTempDirectory,
      {
        content: editedElementContent,
        extension: element.extension,
        name: uploadLocation.name,
      }
    )(Uri.file(localElementVersionTempFilePath));
    const comparingElementDialogStub = mockComparingElementsDialog(
      service,
      preciseSearchLocation,
      uploadChangeControlValue,
      uploadLocation,
      element,
      serviceId,
      searchLocationId,
      subsystemMapPathDownTheMap,
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
        `Test failed because of uncaught error inside command: ${e.message}`
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
      type: Actions.ELEMENT_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element: uploadLocation,
    };
    assert.deepStrictEqual(
      dispatchUpdatedElementAction.args[0]?.[0],
      expectedUpdatedElementAction,
      `Expected dispatch for element update to have been called with ${JSON.stringify(
        expectedUpdatedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchUpdatedElementAction.args[0]?.[0]
      )}`
    );
  });

  type CompareElementsStub = sinon.SinonStub<
    [service: Service, searchLocation: ElementSearchLocation, element: Element],
    (
      uploadChangeControlValue: ActionChangeControlValue,
      uploadTargetLocation: ElementMapPath
    ) => (
      serviceId: Id,
      searchLocationId: Id,
      treePath: SubSystemMapPath
    ) => (localVersionElementTempFilePath: string) => Promise<void | Error>
  >;

  const mockComparingElementsDialog =
    (
      serviceArg: Service,
      searchLocationArg: ElementSearchLocation,
      uploadChangeControlValueArg: ActionChangeControlValue,
      uploadTargetLocationArg: ElementMapPath,
      elementArg: Element,
      serviceIdArg: Id,
      searchLocationIdArg: Id,
      treePathArg: SubSystemMapPath,
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
          [serviceId: Id, searchLocationId: Id, treePath: SubSystemMapPath],
          (localVersionElementTempFilePath: string) => Promise<void | Error>
        >()
        .withArgs(serviceIdArg, searchLocationIdArg, treePathArg)
        .returns(withLocalVersionFileStub);
      const withChangeControlValueStub = sinon
        .stub<
          [
            uploadChangeControlValue: ActionChangeControlValue,
            uploadTargetLocation: ElementMapPath
          ],
          (
            serviceIdArg: Id,
            searchLocationIdArg: Id,
            treePath: SubSystemMapPath
          ) => (
            localVersionElementTempFilePath: string
          ) => Promise<void | Error>
        >()
        .withArgs(uploadChangeControlValueArg, uploadTargetLocationArg)
        .returns(withElementStub);
      return sinon
        .stub(compareDialog, 'compareElementWithRemoteVersion')
        .withArgs(serviceArg, searchLocationArg, elementArg)
        .returns(withChangeControlValueStub);
    };

  it('should signout an element in place during uploading', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const uploadSignOutParams: SignOutParams = {
      signoutChangeControlValue: uploadChangeControlValue,
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const failedResult: ErrorUpdateResponse = {
      status: UpdateStatus.ERROR,
      additionalDetails: {
        error: new SignoutError('something'),
      },
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
    };
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      failedResult.additionalDetails.error,
      SignoutError.prototype
    );
    const [uploadElementStub] = mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([failedResult, successResult]);
    mockAskingForSignout([uploadLocation.name])({
      signOutElements: true,
      automaticSignOut: false,
    });
    const [signoutElementStub] = mockSignOutElement(
      service,
      uploadLocation
    )([
      {
        signoutArg: uploadSignOutParams,
        result: undefined,
      },
    ]);
    const dispatchActions = sinon.spy();
    // act
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchActions,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
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
      `Expected dispatch for upload element to have been called ${expectedDispatchedActions} times, but it was called ${dispatchActions.callCount} times.`
    );
    const expectedSignOutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceId,
      searchLocationId,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignOutAction,
      `Expected dispatch for signout element on upload to have been called with ${JSON.stringify(
        expectedSignOutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
  });

  it('should override signout for an element in place', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const uploadLocation = element;
    mockAskingForUploadLocation(prefilledLocationDialogValue)(uploadLocation);
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const uploadSignOutParams: SignOutParams = {
      signoutChangeControlValue: uploadChangeControlValue,
    };
    const uploadOverrideSignOutParams: SignOutParams = {
      signoutChangeControlValue: uploadChangeControlValue,
      overrideSignOut: true,
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const failedResult: ErrorUpdateResponse = {
      status: UpdateStatus.ERROR,
      additionalDetails: {
        error: new SignoutError('something'),
      },
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
    };
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      failedResult.additionalDetails.error,
      SignoutError.prototype
    );
    const [uploadElementStub] = mockUploadingElementWith(
      service,
      uploadLocation,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([failedResult, successResult]);
    mockAskingForSignout([uploadLocation.name])({
      signOutElements: true,
      automaticSignOut: false,
    });
    const signoutError = failedResult.additionalDetails.error;
    mockAskingForOverrideSignout([uploadLocation.name])(true);
    const [signoutElementStub] = mockSignOutElement(
      service,
      uploadLocation
    )([
      {
        signoutArg: uploadSignOutParams,
        result: signoutError,
      },
      {
        signoutArg: uploadOverrideSignOutParams,
        result: undefined,
      },
    ]);
    const dispatchActions = sinon.spy();
    // act
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchActions,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(
      signoutElementStub.calledTwice,
      `Signout element was not called twice, it was called: ${signoutElementStub.callCount}`
    );
    assert.ok(
      uploadElementStub.calledTwice,
      `Upload element content was not called twice, it was called: ${uploadElementStub.callCount}`
    );
    const expectedDispatchedActions = 2;
    assert.deepStrictEqual(
      dispatchActions.callCount,
      expectedDispatchedActions,
      `Expected dispatch for upload element to have been called ${expectedDispatchedActions} times, but it was called ${dispatchActions.callCount} times.`
    );
    const expectedSignOutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceId,
      searchLocationId,
      elements: [uploadLocation],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignOutAction,
      `Expected dispatch for override signout element on upload to have been called with ${JSON.stringify(
        expectedSignOutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
  });

  it('should override signout for an element from up the map', async () => {
    // arrange
    const prefilledLocationDialogValue = {
      environment: preciseSearchLocation.environment,
      stageNumber: preciseSearchLocation.stageNumber,
      system: preciseSearchLocation.system,
      subsystem: preciseSearchLocation.subsystem,
      type: element.type,
      element: element.name,
      configuration: element.configuration,
    };
    const existingLocationDownTheMap: ElementMapPath = {
      name: element.name,
      type: element.type,
      configuration: preciseSearchLocation.configuration,
      ...subsystemMapPathDownTheMap,
    };
    mockAskingForUploadLocation(prefilledLocationDialogValue)(
      existingLocationDownTheMap
    );
    const uploadChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    const uploadSignOutParams: SignOutParams = {
      signoutChangeControlValue: uploadChangeControlValue,
    };
    const uploadOverrideSignOutParams: SignOutParams = {
      signoutChangeControlValue: uploadChangeControlValue,
      overrideSignOut: true,
    };
    mockAskingForChangeControlValue(uploadChangeControlValue);
    const editedElementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(editedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(editedElementContent))
    );
    const failedResult: ErrorUpdateResponse = {
      status: UpdateStatus.ERROR,
      additionalDetails: {
        error: new SignoutError('something'),
      },
    };
    const successResult: SuccessUpdateResponse = {
      status: UpdateStatus.OK,
      additionalDetails: {
        returnCode: 0,
      },
    };
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      failedResult.additionalDetails.error,
      SignoutError.prototype
    );
    const [uploadElementStub] = mockUploadingElementWith(
      service,
      existingLocationDownTheMap,
      uploadChangeControlValue,
      {
        content: editedElementContent,
        fingerprint: elementFingerprint,
      }
    )([failedResult, successResult]);
    mockAskingForSignout([existingLocationDownTheMap.name])({
      signOutElements: true,
      automaticSignOut: false,
    });
    const signoutError = failedResult.additionalDetails.error;
    mockAskingForOverrideSignout([existingLocationDownTheMap.name])(true);
    const [signoutElementStub] = mockSignOutElement(
      service,
      element
    )([
      {
        signoutArg: uploadSignOutParams,
        result: signoutError,
      },
      {
        signoutArg: uploadOverrideSignOutParams,
        result: undefined,
      },
    ]);
    const dispatchActions = sinon.spy();
    // act
    const editedElementUri = toEditedElementUri(editedElementFilePath)({
      element,
      fingerprint: elementFingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: preciseSearchLocation,
        initialSearchLocation: subsystemMapPathDownTheMap,
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    try {
      await commands.executeCommand(
        CommandId.UPLOAD_ELEMENT,
        dispatchActions,
        editedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(
      signoutElementStub.calledTwice,
      `Signout element was not called twice, it was called: ${signoutElementStub.callCount}`
    );
    assert.ok(
      uploadElementStub.calledTwice,
      `Upload element content was not called twice, it was called: ${uploadElementStub.callCount}`
    );
    const expectedDispatchedActions = 2;
    assert.deepStrictEqual(
      dispatchActions.callCount,
      expectedDispatchedActions,
      `Expected dispatch for upload element to have been called ${expectedDispatchedActions} times, but it was called ${dispatchActions.callCount} times.`
    );
    const expectedSignOutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceId,
      searchLocationId,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignOutAction,
      `Expected dispatch for override signout element on upload to have been called with ${JSON.stringify(
        expectedSignOutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
  });
});
