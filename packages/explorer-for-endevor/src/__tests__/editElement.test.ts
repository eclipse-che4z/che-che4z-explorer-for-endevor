/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import * as sinon from 'sinon';
import * as assert from 'assert';
import { commands, ConfigurationTarget, Uri, workspace } from 'vscode';
import { editElementCommand } from '../commands/edit/editElementCommand';
import { CommandId } from '../commands/id';
import {
  AUTOMATIC_SIGN_OUT_SETTING,
  EDIT_FOLDER_SETTING,
  ENDEVOR_CONFIGURATION,
  UNIQUE_ELEMENT_FRAGMENT,
} from '../constants';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toTreeElementUri } from '../uri/treeElementUri';
import { getEditFolderUri, isError } from '../utils';
import {
  mockCreatingDirectory,
  mockGettingWorkspaceUri,
  mockSavingFileIntoWorkspaceDirectory,
} from '../_mocks/workspace';
import { mockShowingFileContentWith } from '../_mocks/window';
import { fromEditedElementUri } from '../uri/editedElementUri';
import { mockRetrievingElementWithFingerprint } from '../_mocks/endevor';
import { QueryTypes } from '../_doc/Uri';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
} from '../_mocks/dialogs';
import { SignoutError } from '@local/endevor/_doc/Error';
import { Actions } from '../_doc/Actions';
import { toElementId } from '../tree/endevor';

describe('starting edit session for element', () => {
  before(() => {
    commands.registerCommand(CommandId.QUICK_EDIT_ELEMENT, editElementCommand);
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
  const searchLocationName = 'searchLocationName';
  const elementId = toElementId(serviceName)(searchLocationName)(element);
  const searchLocation: ElementSearchLocation = {
    instance: 'ANY-INSTANCE',
  };
  const elementUri = toTreeElementUri({
    serviceName,
    searchLocationName,
    element,
    service,
    searchLocation,
  })(UNIQUE_ELEMENT_FRAGMENT);
  if (isError(elementUri)) {
    const error = elementUri;
    assert.fail(
      `Uri was not built correctly for tests because of: ${error.message}`
    );
  }

  it('should start edit session for element without signout', async () => {
    // arrange
    const automaticSignoutSetting = false;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const retrieveElementStub = mockRetrievingElementWithFingerprint(
      service,
      element
    )([
      {
        result: {
          content,
          fingerprint,
        },
      },
    ]);
    // can be anything, but URI
    const workspaceUri = elementUri;
    mockGettingWorkspaceUri(workspaceUri);
    const elementDirectory = 'test-edit-folder';
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        elementDirectory,
        ConfigurationTarget.Global
      );
    const elementDirectoryUri = getEditFolderUri(workspaceUri)(
      elementDirectory
    )(
      serviceName,
      searchLocationName
    )(element);
    const createElementDirectoryStub =
      mockCreatingDirectory()(elementDirectoryUri);
    // can be anything, but URI
    const savedFileMockUri = Uri.file(__dirname);
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      elementDirectoryUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const showSavedElementStub = mockShowingFileContentWith()(
      Promise.resolve()
    );
    const dispatchSignoutActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchSignoutActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, withServiceStub, contentStub] = retrieveElementStub;
    const actualService = withServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${JSON.stringify(
        service
      )}, it was called with ${JSON.stringify(actualService)}`
    );
    const actualElement = contentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected service ${JSON.stringify(
        element
      )}, it was called with ${JSON.stringify(actualElement)}`
    );
    assert.ok(
      createElementDirectoryStub.called,
      'Create element local directory was not called'
    );
    const actualElementDirectory =
      createElementDirectoryStub.args[0]?.[0].fsPath;
    const expectedLocalElementDirectory = elementDirectoryUri.fsPath;
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedLocalElementDirectory,
      `Creating of element local directory was not called with expected ${expectedLocalElementDirectory}, it was called with ${actualElementDirectory}`
    );
    const [, elementDetailsStub] = saveElementStub;
    const actualSavedElementDetails = elementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${JSON.stringify(
        expectedSavedElementDetails
      )}, it was called with ${JSON.stringify(actualSavedElementDetails)}`
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualShowedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const editSessionDetails = {
      searchLocationName: 'searchLocationName',
      serviceName: 'serviceName',
      service,
      element,
      searchLocation,
      fingerprint,
      type: QueryTypes.EDITED_ELEMENT,
    };
    assert.deepStrictEqual(
      actualShowedElementDetails,
      editSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        editSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualShowedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchSignoutActions.called,
      false,
      'Dispatch for signout element when edit without signout was called'
    );
  });

  it('should start edit session for element with signout', async () => {
    // arrange
    const automaticSignoutSetting = true;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const retrieveElementStub = mockRetrievingElementWithFingerprint(
      service,
      element
    )([
      {
        signoutArg: {
          signoutChangeControlValue,
        },
        result: {
          content,
          fingerprint,
        },
      },
    ]);
    // can be anything, but URI
    const workspaceUri = elementUri;
    mockGettingWorkspaceUri(workspaceUri);
    const elementDirectory = 'test-edit-folder';
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        elementDirectory,
        ConfigurationTarget.Global
      );
    const createdElementDirectoryUri = getEditFolderUri(workspaceUri)(
      elementDirectory
    )(
      serviceName,
      searchLocationName
    )(element);
    const createLocalDirectoryStub = mockCreatingDirectory()(
      createdElementDirectoryUri
    );
    // can be anything, but URI
    const savedFileMockUri = Uri.file(__dirname);
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdElementDirectoryUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const showSavedElementStub = mockShowingFileContentWith()(
      Promise.resolve()
    );
    const dispatchSignoutActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchSignoutActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      ,
      retrieveWithServiceStub,
      retrieveContentStub,
      retrieveWithSignoutValueStub,
    ] = retrieveElementStub;
    const actualService = retrieveWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${JSON.stringify(
        service
      )}, it was called with ${JSON.stringify(actualService)}`
    );
    const actualElement = retrieveContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected element ${JSON.stringify(
        element
      )}, it was called with ${JSON.stringify(actualElement)}`
    );
    const actualSignoutValue = retrieveWithSignoutValueStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualSignoutValue,
      signoutChangeControlValue,
      `Fetch element content was not called with expected signout value ${JSON.stringify(
        signoutChangeControlValue
      )}, it was called with ${JSON.stringify(actualSignoutValue)}`
    );
    const actualElementDirectory = createLocalDirectoryStub.args[0]?.[0].fsPath;
    const expectedLocalElementDirectory = createdElementDirectoryUri.fsPath;
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedLocalElementDirectory,
      `Creating of element local directory was not called with expected ${expectedLocalElementDirectory}, it was called with ${actualElementDirectory}`
    );
    const [, savedElementDetailsStub] = saveElementStub;
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${JSON.stringify(
        expectedSavedElementDetails
      )}, it was called with ${JSON.stringify(actualSavedElementDetails)}`
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualEditedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails = {
      searchLocationName: 'searchLocationName',
      serviceName: 'serviceName',
      service,
      element,
      searchLocation,
      fingerprint,
      type: QueryTypes.EDITED_ELEMENT,
    };
    assert.deepStrictEqual(
      actualEditedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualEditedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchSignoutActions.called,
      true,
      'Dispatch for signout element when editing with signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      expectedSignoutAction,
      dispatchSignoutActions.args[0]?.[0],
      `Expexted dispatch for edit element signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutActions.args[0]?.[0]
      )}`
    );
  });

  it('should start edit session for element with override signout', async () => {
    // arrange
    const automaticSignoutSetting = true;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    mockAskingForOverrideSignout([element.name])(true);
    const error = new SignoutError(element.name, 'something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(error, SignoutError.prototype);
    const firstAttempt = {
      signoutArg: {
        signoutChangeControlValue,
      },
      result: error,
    };
    const secondAttempt = {
      signoutArg: {
        signoutChangeControlValue,
        overrideSignout: true,
      },
      result: {
        content,
        fingerprint,
      },
    };
    const retrieveElementStub = mockRetrievingElementWithFingerprint(
      service,
      element
    )([firstAttempt, secondAttempt]);
    // can be anything, but URI
    const workspaceUri = elementUri;
    mockGettingWorkspaceUri(workspaceUri);
    const expectedElementDirectory = 'test-edit-folder';
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        expectedElementDirectory,
        ConfigurationTarget.Global
      );
    const createdElementDirectoryUri = getEditFolderUri(workspaceUri)(
      expectedElementDirectory
    )(
      serviceName,
      searchLocationName
    )(element);
    const createLocalDirectoryStub = mockCreatingDirectory()(
      createdElementDirectoryUri
    );
    // can be anything, but URI
    const savedFileMockUri = Uri.file(__dirname);
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdElementDirectoryUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const showSavedElementStub = mockShowingFileContentWith()(
      Promise.resolve()
    );
    const dispatchSignoutActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchSignoutActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, withService, withElementStub, withSignoutChangeControlValueStub] =
      retrieveElementStub;
    const actualService = withService.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${JSON.stringify(
        service
      )}, it was called with ${JSON.stringify(actualService)}`
    );
    const actualElement = withElementStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected element ${JSON.stringify(
        element
      )}, it was called with ${JSON.stringify(actualElement)}`
    );
    const firstAttemptSignoutValue =
      withSignoutChangeControlValueStub.args[0]?.[0];
    assert.deepStrictEqual(
      firstAttemptSignoutValue,
      signoutChangeControlValue,
      `Fetch element content was not called with expected signout value ${JSON.stringify(
        signoutChangeControlValue
      )}, it was called with ${JSON.stringify(firstAttemptSignoutValue)}`
    );
    const firstAttemptOverrideSignoutValue =
      withSignoutChangeControlValueStub.args[0]?.[1];
    assert.deepStrictEqual(
      firstAttemptOverrideSignoutValue,
      undefined,
      `Fetch element content was not called with expected override signout value ${undefined}, it was called with ${firstAttemptOverrideSignoutValue}`
    );
    const secondAttemptSignoutValue =
      withSignoutChangeControlValueStub.args[1]?.[0];
    assert.deepStrictEqual(
      secondAttemptSignoutValue,
      signoutChangeControlValue,
      `Fetch element content was not called with expected signout value ${JSON.stringify(
        signoutChangeControlValue
      )}, it was called with ${JSON.stringify(firstAttemptSignoutValue)}`
    );
    const secondAttemptOverrideSignoutValue =
      withSignoutChangeControlValueStub.args[1]?.[1];
    assert.deepStrictEqual(
      secondAttemptOverrideSignoutValue,
      true,
      `Fetch element content was not called with expected override signout value ${true}, it was called with ${secondAttemptOverrideSignoutValue}`
    );
    const actualElementDirectory = createLocalDirectoryStub.args[0]?.[0].fsPath;
    const expectedLocalElementDirectory = createdElementDirectoryUri.fsPath;
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedLocalElementDirectory,
      `Creating of element local directory was not called with expected ${expectedLocalElementDirectory}, it was called with ${actualElementDirectory}`
    );
    const [, savedElementDetailsStub] = saveElementStub;
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${expectedSavedElementDetails}, it was called with ${actualSavedElementDetails}`
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualEditedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails = {
      searchLocationName,
      serviceName,
      service,
      element,
      searchLocation,
      fingerprint,
      type: QueryTypes.EDITED_ELEMENT,
    };
    assert.deepStrictEqual(
      actualEditedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualEditedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchSignoutActions.called,
      true,
      'Dispatch for signout element when editing with override signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      expectedSignoutAction,
      dispatchSignoutActions.args[0]?.[0],
      `Expexted dispatch for edit element with override signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutActions.args[0]?.[0]
      )}`
    );
  });

  it('should start edit session for element even without override signout', async () => {
    // arrange
    const automaticSignoutSetting = true;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    mockAskingForOverrideSignout([element.name])(false);
    const signoutError = new SignoutError(element.name, 'something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const firstRetrieveAttempt = {
      signoutArg: {
        signoutChangeControlValue,
      },
      result: signoutError,
    };
    const secondRetrieveAttempt = {
      result: {
        content,
        fingerprint,
      },
    };
    const retrieveElementStub = mockRetrievingElementWithFingerprint(
      service,
      element
    )([firstRetrieveAttempt, secondRetrieveAttempt]);
    // can be anything, but URI
    const workspaceUri = elementUri;
    mockGettingWorkspaceUri(workspaceUri);
    const expectedElementDirectory = 'test-edit-folder';
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        expectedElementDirectory,
        ConfigurationTarget.Global
      );
    const createdElementDirectoryUri = getEditFolderUri(workspaceUri)(
      expectedElementDirectory
    )(
      serviceName,
      searchLocationName
    )(element);
    const createLocalDirectoryStub = mockCreatingDirectory()(
      createdElementDirectoryUri
    );
    // can be anything, but URI
    const savedFileMockUri = Uri.file(__dirname);
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdElementDirectoryUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const showSavedElementStub = mockShowingFileContentWith()(
      Promise.resolve()
    );
    const dispatchSignoutActions = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchSignoutActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      ,
      withServiceStub,
      withElementStub,
      withSignoutChangeControlValueStub,
    ] = retrieveElementStub;
    const actualService = withServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${JSON.stringify(
        service
      )}, it was called with ${JSON.stringify(actualService)}`
    );
    const actualElement = withElementStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected element ${JSON.stringify(
        element
      )}, it was called with ${JSON.stringify(actualElement)}`
    );
    const firstAttemptSignoutValue =
      withSignoutChangeControlValueStub.args[0]?.[0];
    assert.deepStrictEqual(
      firstAttemptSignoutValue,
      signoutChangeControlValue,
      `Fetch element content was not called with expected signout value ${JSON.stringify(
        signoutChangeControlValue
      )}, it was called with ${JSON.stringify(firstAttemptSignoutValue)}`
    );
    const firstAttemptOverrideSignoutValue =
      withSignoutChangeControlValueStub.args[0]?.[1];
    assert.deepStrictEqual(
      firstAttemptOverrideSignoutValue,
      undefined,
      `Fetch element content was not called with expected override signout value ${undefined}, it was called with ${firstAttemptOverrideSignoutValue}`
    );
    const secondAttemptSignoutValue =
      withSignoutChangeControlValueStub.args[1]?.[0];
    assert.deepStrictEqual(
      secondAttemptSignoutValue,
      undefined,
      `Fetch element content was not called with expected signout value ${undefined}, it was called with ${firstAttemptSignoutValue}`
    );
    const actualElementDirectory = createLocalDirectoryStub.args[0]?.[0].fsPath;
    const expectedLocalElementDirectory = createdElementDirectoryUri.fsPath;
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedLocalElementDirectory,
      `Creating of element local directory was not called with expected ${expectedLocalElementDirectory}, it was called with ${actualElementDirectory}`
    );
    const [, savedElementDetailsStub] = saveElementStub;
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${JSON.stringify(
        expectedSavedElementDetails
      )}, it was called with ${JSON.stringify(actualSavedElementDetails)}`
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualEditedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails = {
      searchLocationName,
      serviceName,
      service,
      element,
      searchLocation,
      fingerprint,
      type: QueryTypes.EDITED_ELEMENT,
    };
    assert.deepStrictEqual(
      actualEditedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualEditedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchSignoutActions.called,
      true,
      'Dispatch for signout element when editing without signout was called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      expectedSignoutAction,
      dispatchSignoutActions.args[0]?.[0],
      `Expexted dispatch for edit element with override signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutActions.args[0]?.[0]
      )}`
    );
  });
});
