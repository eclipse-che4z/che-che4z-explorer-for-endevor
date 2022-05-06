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
  ServiceApiVersion,
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
import { EditedElementUriQuery } from '../_doc/Uri';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
} from '../_mocks/dialogs';
import { SignoutError } from '@local/endevor/_doc/Error';
import { Actions } from '../_doc/Actions';
import { toElementId } from '../tree/endevor';
import { TypeNode } from '../_doc/ElementTree';

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
    apiVersion: ServiceApiVersion.V2,
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
    environment: 'ANY-ENV',
    stageNumber: '1',
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

  it('should start an edit session for an element without signout', async () => {
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
    const dispatchActions = sinon.spy();
    // act
    const parent: TypeNode = {
      type: 'TYPE',
      name: element.type,
      elements: new Map(),
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
          children: new Map(),
        },
        children: new Map(),
      },
      map: {
        type: 'MAP',
        name: 'MAP',
        elements: new Map(),
      },
    };
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
          parent,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , contentStub] = retrieveElementStub;
    assert.ok(
      contentStub.called,
      'Retrieve an element Endevor API was not called'
    );
    assert.ok(
      createElementDirectoryStub.called,
      'Create an element local directory API was not called'
    );
    const [, elementDetailsStub] = saveElementStub;
    assert.ok(
      elementDetailsStub.called,
      'Save an element in a local directory API was not called'
    );
    assert.ok(
      showSavedElementStub.called,
      'Show a saved element in the editor API was not called'
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualShowedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails: EditedElementUriQuery = {
      element,
      fingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        searchLocationName,
        serviceName,
        overallSearchLocation: searchLocation,
        initialSearchLocation: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          subSystem: parent.parent.name,
          system: parent.parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualShowedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualShowedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchActions.called,
      false,
      'Dispatch for signout element when edit without signout was called'
    );
  });

  it('should start an edit session for an element with signout', async () => {
    // arrange
    const automaticSignoutSetting = true;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
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
    const dispatchActions = sinon.spy();
    // act
    const parent: TypeNode = {
      type: 'TYPE',
      name: element.type,
      elements: new Map(),
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
          children: new Map(),
        },
        children: new Map(),
      },
      map: {
        type: 'MAP',
        name: 'MAP',
        elements: new Map(),
      },
    };
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
          parent,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , contentStub] = retrieveElementStub;
    assert.ok(
      contentStub.called,
      'Retrieve an element Endevor API was not called'
    );
    assert.ok(
      createElementDirectoryStub.called,
      'Create an element local directory API was not called'
    );
    const [, elementDetailsStub] = saveElementStub;
    assert.ok(
      elementDetailsStub.called,
      'Save an element in a local directory API was not called'
    );
    assert.ok(
      showSavedElementStub.called,
      'Show a saved element in the editor API was not called'
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualShowedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails: EditedElementUriQuery = {
      element,
      fingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        searchLocationName,
        serviceName,
        overallSearchLocation: searchLocation,
        initialSearchLocation: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          subSystem: parent.parent.name,
          system: parent.parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualShowedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualShowedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchActions.called,
      true,
      'Dispatch for signout element when editing with signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expexted dispatch for edit element signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
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
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const error = new SignoutError('something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(error, SignoutError.prototype);
    const firstAttempt = {
      signoutArg: {
        signoutChangeControlValue,
      },
      result: error,
    };
    mockAskingForOverrideSignout([element.name])(true);
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
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
    const dispatchActions = sinon.spy();
    // act
    const parent: TypeNode = {
      type: 'TYPE',
      name: element.type,
      elements: new Map(),
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
          children: new Map(),
        },
        children: new Map(),
      },
      map: {
        type: 'MAP',
        name: 'MAP',
        elements: new Map(),
      },
    };
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
          parent,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , contentStub] = retrieveElementStub;
    assert.ok(
      contentStub.calledTwice,
      'Retrieve an element Endevor API was not called twice'
    );
    assert.ok(
      createElementDirectoryStub.called,
      'Create an element local directory API was not called'
    );
    const [, elementDetailsStub] = saveElementStub;
    assert.ok(
      elementDetailsStub.called,
      'Save an element in a local directory API was not called'
    );
    assert.ok(
      showSavedElementStub.called,
      'Show a saved element in the editor API was not called'
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualShowedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails: EditedElementUriQuery = {
      element,
      fingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        searchLocationName,
        serviceName,
        overallSearchLocation: searchLocation,
        initialSearchLocation: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          subSystem: parent.parent.name,
          system: parent.parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualShowedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualShowedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchActions.called,
      true,
      'Dispatch for signout element when editing with signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expexted dispatch for edit element signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
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
    const signoutChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const signoutError = new SignoutError('something');
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const firstRetrieveAttempt = {
      signoutArg: {
        signoutChangeControlValue,
      },
      result: signoutError,
    };
    mockAskingForOverrideSignout([element.name])(false);
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
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
    const dispatchActions = sinon.spy();
    // act
    const parent: TypeNode = {
      type: 'TYPE',
      name: element.type,
      elements: new Map(),
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
          children: new Map(),
        },
        children: new Map(),
      },
      map: {
        type: 'MAP',
        name: 'MAP',
        elements: new Map(),
      },
    };
    try {
      await commands.executeCommand(
        CommandId.QUICK_EDIT_ELEMENT,
        dispatchActions,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          id: elementId,
          parent,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , contentStub] = retrieveElementStub;
    assert.ok(
      contentStub.calledTwice,
      'Retrieve an element Endevor API was not called twice'
    );
    assert.ok(
      createElementDirectoryStub.called,
      'Create an element local directory API was not called'
    );
    const [, elementDetailsStub] = saveElementStub;
    assert.ok(
      elementDetailsStub.called,
      'Save an element in a local directory API was not called'
    );
    assert.ok(
      showSavedElementStub.called,
      'Show a saved element in the editor API was not called'
    );
    const actualShowedElementUri = showSavedElementStub.args[0]?.[0];
    const actualShowedElementDetails = fromEditedElementUri(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      actualShowedElementUri!
    );
    const expectedEditSessionDetails: EditedElementUriQuery = {
      element,
      fingerprint,
      endevorConnectionDetails: service,
      searchContext: {
        searchLocationName,
        serviceName,
        overallSearchLocation: searchLocation,
        initialSearchLocation: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          subSystem: parent.parent.name,
          system: parent.parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualShowedElementDetails,
      expectedEditSessionDetails,
      `Shown element URI details should be: ${JSON.stringify(
        expectedEditSessionDetails
      )}, but the actual value is: ${JSON.stringify(
        actualShowedElementDetails
      )}`
    );
    assert.deepStrictEqual(
      dispatchActions.called,
      true,
      'Dispatch for signout element when editing with signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expexted dispatch for edit element signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
  });
});
