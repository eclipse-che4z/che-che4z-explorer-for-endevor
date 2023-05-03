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

import { describe } from 'mocha';
import * as vscode from 'vscode';
import { CommandId } from '../id';
import { toBasicElementUri } from '../../uri/basicElementUri';
import { isError } from '../../utils';
import * as assert from 'assert';
import {
  Element,
  ErrorResponseType,
  ResponseStatus,
  Service,
  SignOutParams,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { retrieveElementCommand } from '../element/retrieveElement';
import {
  mockRetrieveElement,
  mockRetrieveElementWithSignout,
} from './_mocks/endevor';
import {
  mockCreatingWorkspaceDirectory,
  mockGettingWorkspaceUri,
  mockSavingFileIntoWorkspaceDirectory,
} from './_mocks/workspace';
import * as sinon from 'sinon';
import {
  AUTOMATIC_SIGN_OUT_SETTING,
  ENDEVOR_CONFIGURATION,
  FILE_EXT_RESOLUTION_DEFAULT,
  FILE_EXT_RESOLUTION_SETTING,
  UNIQUE_ELEMENT_FRAGMENT,
} from '../../constants';
import { ConfigurationTarget, workspace } from 'vscode';
import * as path from 'path';
import { mockShowingFileContentWith } from './_mocks/window';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
} from './_mocks/dialogs';
import { Actions } from '../../store/_doc/Actions';
import { Source } from '../../store/storage/_doc/Storage';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import { ElementSearchLocation } from '../../_doc/Endevor';
import {
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { ElementNode, TypeNode } from '../../tree/_doc/ElementTree';

describe('retrieve element', () => {
  type NotDefined = undefined;
  let beforeTestsAutoSignOut: boolean | NotDefined;
  let beforeTestsFileExtensionResolution: FileExtensionResolutions | NotDefined;
  before(() => {
    vscode.commands.registerCommand(
      CommandId.RETRIEVE_ELEMENT,
      (
        getConnectionDetails,
        getEndevorConfiguration,
        getCredential,
        getSearchLocation,
        dispatch,
        elementNode,
        SelectedMultipleNodes
      ) =>
        retrieveElementCommand(
          {
            getConnectionDetails,
            getEndevorConfiguration,
            getCredential,
            getSearchLocation,
          },
          dispatch,
          elementNode,
          SelectedMultipleNodes
        )
    );
  });

  beforeEach(async () => {
    beforeTestsAutoSignOut = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(AUTOMATIC_SIGN_OUT_SETTING);
    beforeTestsFileExtensionResolution = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(FILE_EXT_RESOLUTION_SETTING);
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        FILE_EXT_RESOLUTION_SETTING,
        FILE_EXT_RESOLUTION_DEFAULT,
        ConfigurationTarget.Global
      );
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
        FILE_EXT_RESOLUTION_SETTING,
        beforeTestsFileExtensionResolution,
        ConfigurationTarget.Global
      );
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const configuration = 'TEST-INST';
  const serviceName = 'serviceName';
  const serviceId: EndevorId = {
    name: serviceName,
    source: Source.INTERNAL,
  };
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
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'TYP',
    name: 'ELM',
    id: 'ELM',
    noSource: false,
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
  };
  const searchLocationName = 'searchLocationName';
  const searchLocationId: EndevorId = {
    name: searchLocationName,
    source: Source.INTERNAL,
  };
  const searchLocation: ElementSearchLocation = {
    configuration: 'ANY-CONFIG',
  };
  const elementUri = toBasicElementUri({
    serviceId: {
      name: serviceName,
      source: Source.INTERNAL,
    },
    searchLocationId: {
      name: searchLocationName,
      source: Source.INTERNAL,
    },
    element,
  })(UNIQUE_ELEMENT_FRAGMENT);
  if (isError(elementUri)) {
    const error = elementUri;
    assert.fail(
      `Uri was not built correctly for tests because of: ${error.message}`
    );
  }
  const parent: TypeNode = {
    type: 'TYPE',
    name: 'TYP',
    elements: [],
    parent: {
      type: 'SUB',
      name: 'SUB',
      parent: {
        type: 'SYS',
        name: 'SYS',
        children: [],
      },
      subSystemMapPath: {
        environment: 'ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SUB',
      },
      serviceId,
      searchLocationId,
      children: [],
    },
    map: {
      type: 'MAP',
      name: 'MAP',
      elements: [],
    },
  };
  const elementNode: ElementNode = {
    serviceId,
    searchLocationId,
    type: 'ELEMENT_IN_PLACE',
    name: element.name,
    element,
    parent,
    timestamp: UNIQUE_ELEMENT_FRAGMENT,
  };
  const credential: EndevorCredential = {
    value: service.credential,
    status: EndevorCredentialStatus.VALID,
  };
  it('should retrieve element without signout', async () => {
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
    const retrieveElementStub = mockRetrieveElement(
      service,
      configuration,
      element
    )({
      status: ResponseStatus.OK,
      result: {
        content,
        fingerprint,
      },
    });
    const workspaceMockUri = elementUri;
    mockGettingWorkspaceUri(workspaceMockUri);
    const createdDirMockUri = workspaceMockUri;
    const expectedElementDirectory = path.join(
      `/`,
      serviceName,
      searchLocationName,
      element.system,
      element.subSystem,
      element.type
    );
    const createLocalDirectoryStub = mockCreatingWorkspaceDirectory(
      workspaceMockUri,
      expectedElementDirectory
    )(createdDirMockUri);
    const savedFileMockUri = workspaceMockUri;
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdDirMockUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const successMock = Promise.resolve();
    const showSavedElementStub =
      mockShowingFileContentWith(savedFileMockUri)(successMock);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.RETRIEVE_ELEMENT,
        () => {
          return {
            status: EndevorConnectionStatus.VALID,
            value: service,
          };
        },
        () => searchLocation.configuration,
        () => () => credential,
        () => {
          return searchLocation;
        },
        dispatchSignoutAction,
        elementNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      generalRetrieveFunctionStub,
      retrieveWithServiceStub,
      _,
      retrieveContentStub,
    ] = retrieveElementStub;
    assert.ok(
      generalRetrieveFunctionStub.called,
      'Fetch element content was not called'
    );
    const actualService = retrieveWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${service}, it was called with ${actualService}`
    );
    const actualElement = retrieveContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected element ${element}, it was called with ${actualElement}`
    );

    const [generalCreateLocalDirectoryFunctionStub, localDirectoryStub] =
      createLocalDirectoryStub;
    assert.ok(
      generalCreateLocalDirectoryFunctionStub.called,
      'Create element local directory was not called'
    );
    const actualElementDirectory = localDirectoryStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedElementDirectory,
      `Creating of element local directory was not called with expected ${expectedElementDirectory}, it was called with ${actualElementDirectory}`
    );

    const [generalSaveFileStub, savedElementDetailsStub] = saveElementStub;
    assert.ok(
      generalSaveFileStub.called,
      'Save element into local directory was not called'
    );
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
      workspaceDirectoryPath: expectedElementDirectory,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${expectedSavedElementDetails}, it was called with ${actualSavedElementDetails}`
    );

    assert.ok(
      showSavedElementStub.called,
      'Show saved element in the editor was not called'
    );
    assert.deepStrictEqual(
      dispatchSignoutAction.called,
      false,
      'Dispatch for signout element when retrieving without signout was called'
    );
  });

  it('should retrieve element with signout', async () => {
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
    const expectedSignoutChangeControlValue = {
      ccid: 'test',
      comment: 'very very long comment',
    };
    const expectedSignOutParams: SignOutParams = {
      signoutChangeControlValue: expectedSignoutChangeControlValue,
    };
    const retrieveElementStub = mockRetrieveElementWithSignout(
      service,
      configuration,
      element
    )([
      {
        signOutParamsArg: expectedSignOutParams,
        signOutMockResult: {
          status: ResponseStatus.OK,
          result: {
            content,
            fingerprint,
          },
        },
      },
    ]);
    const workspaceMockUri = elementUri;
    mockGettingWorkspaceUri(workspaceMockUri);
    mockAskingForChangeControlValue(expectedSignoutChangeControlValue);
    const createdDirMockUri = workspaceMockUri;
    const expectedElementDirectory = path.join(
      `/`,
      serviceName,
      searchLocationName,
      element.system,
      element.subSystem,
      element.type
    );
    const createLocalDirectoryStub = mockCreatingWorkspaceDirectory(
      workspaceMockUri,
      expectedElementDirectory
    )(createdDirMockUri);
    const savedFileMockUri = workspaceMockUri;
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdDirMockUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const successMock = Promise.resolve();
    const showSavedElementStub =
      mockShowingFileContentWith(savedFileMockUri)(successMock);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.RETRIEVE_ELEMENT,
        () => {
          return {
            status: EndevorConnectionStatus.VALID,
            value: service,
          };
        },
        () => searchLocation.configuration,
        () => () => credential,
        () => {
          return searchLocation;
        },
        dispatchSignoutAction,
        elementNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      generalRetrieveFunctionStub,
      retrieveWithServiceStub,
      _,
      retrieveContentStub,
      signOutParamsStub,
    ] = retrieveElementStub;
    assert.ok(
      generalRetrieveFunctionStub.called,
      'Fetch element content was not called'
    );
    const actualService = retrieveWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected service ${service}, it was called with ${actualService}`
    );
    const actualElement = retrieveContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected element ${element}, it was called with ${actualElement}`
    );
    const actualSignOutParams = signOutParamsStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualSignOutParams,
      expectedSignOutParams,
      `Fetch element content was not called with expected signout parameters value ${JSON.stringify(
        expectedSignOutParams
      )}, it was called with ${JSON.stringify(actualSignOutParams)}`
    );

    const [generalCreateLocalDirectoryFunctionStub, localDirectoryStub] =
      createLocalDirectoryStub;
    assert.ok(
      generalCreateLocalDirectoryFunctionStub.called,
      'Create element local directory was not called'
    );
    const actualElementDirectory = localDirectoryStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedElementDirectory,
      `Creating of element local directory was not called with expected ${expectedElementDirectory}, it was called with ${actualElementDirectory}`
    );

    const [generalSaveFileStub, savedElementDetailsStub] = saveElementStub;
    assert.ok(
      generalSaveFileStub.called,
      'Save element into local directory was not called'
    );
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
      workspaceDirectoryPath: expectedElementDirectory,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${expectedSavedElementDetails}, it was called with ${actualSavedElementDetails}`
    );

    assert.ok(
      showSavedElementStub.called,
      'Show saved element in the editor was not called'
    );
    assert.deepStrictEqual(
      dispatchSignoutAction.called,
      true,
      'Dispatch for signout element when retrieving with signout was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      searchLocationId: {
        name: searchLocationName,
        source: Source.INTERNAL,
      },
      serviceId: {
        name: serviceName,
        source: Source.INTERNAL,
      },
      elements: [element],
    };
    assert.deepStrictEqual(
      expectedSignoutAction,
      dispatchSignoutAction.args[0]?.[0],
      `Expected dispatch for retrieve element with signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutAction.args[0]?.[0]
      )}`
    );
  });

  it('should try to retrieve element with override signout if selected', async () => {
    // arrange
    const automaticSignoutSetting = true;
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        AUTOMATIC_SIGN_OUT_SETTING,
        automaticSignoutSetting,
        ConfigurationTarget.Global
      );
    const expectedSignoutChangeControlValue = {
      ccid: 'test',
      comment: 'very very long comment',
    };
    const expectedSignOutParams: SignOutParams = {
      signoutChangeControlValue: expectedSignoutChangeControlValue,
    };
    const expectedOverrideSignOutParams: SignOutParams = {
      signoutChangeControlValue: expectedSignoutChangeControlValue,
      overrideSignOut: true,
    };
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const retrieveElementWithOverrideStub = mockRetrieveElementWithSignout(
      service,
      configuration,
      element
    )([
      {
        signOutParamsArg: expectedSignOutParams,
        signOutMockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [],
          },
        },
      },
      {
        signOutParamsArg: expectedOverrideSignOutParams,
        signOutMockResult: {
          status: ResponseStatus.OK,
          result: {
            content,
            fingerprint,
          },
        },
      },
    ]);
    const workspaceMockUri = elementUri;
    mockGettingWorkspaceUri(workspaceMockUri);
    mockAskingForChangeControlValue(expectedSignoutChangeControlValue);
    mockAskingForOverrideSignout([element.name])(true);
    const createdDirMockUri = workspaceMockUri;
    const expectedElementDirectory = path.join(
      `/`,
      serviceName,
      searchLocationName,
      element.system,
      element.subSystem,
      element.type
    );
    const createLocalDirectoryStub = mockCreatingWorkspaceDirectory(
      workspaceMockUri,
      expectedElementDirectory
    )(createdDirMockUri);
    const savedFileMockUri = workspaceMockUri;
    const saveElementStub = mockSavingFileIntoWorkspaceDirectory(
      createdDirMockUri,
      {
        content,
        extension: element.extension,
        name: element.name,
      }
    )(savedFileMockUri);
    const successMock = Promise.resolve();
    const showSavedElementStub =
      mockShowingFileContentWith(savedFileMockUri)(successMock);
    const dispatchSignoutActions = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.RETRIEVE_ELEMENT,
        () => {
          return {
            status: EndevorConnectionStatus.VALID,
            value: service,
          };
        },
        () => searchLocation.configuration,
        () => () => credential,
        () => {
          return searchLocation;
        },
        dispatchSignoutActions,
        elementNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      generalRetrieveFunctionStub,
      retrieveWithServiceStub,
      _,
      retrieveContentStub,
      signOutParamsStub,
    ] = retrieveElementWithOverrideStub;
    assert.ok(
      generalRetrieveFunctionStub.calledTwice,
      `Fetch element content was not called twice, it was called: ${generalRetrieveFunctionStub.callCount}`
    );

    const actualServiceForSignOut = retrieveWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualServiceForSignOut,
      service,
      `Fetch element content with signout was not called with expected service ${service}, it was called with ${actualServiceForSignOut}`
    );
    const actualServiceForOverrideSignOut =
      retrieveWithServiceStub.args[1]?.[0];
    assert.deepStrictEqual(
      actualServiceForOverrideSignOut,
      service,
      `Fetch element content with override signout was not called with expected service ${service}, it was called with ${actualServiceForOverrideSignOut}`
    );

    const actualElementForSignOut = retrieveContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElementForSignOut,
      element,
      `Fetch element content with signout was not called with expected element ${element}, it was called with ${actualElementForSignOut}`
    );
    const actualElementForOverrideSignOut = retrieveContentStub.args[1]?.[0];
    assert.deepStrictEqual(
      actualElementForSignOut,
      element,
      `Fetch element content with override signout was not called with expected element ${element}, it was called with ${actualElementForOverrideSignOut}`
    );

    const actualSignOutParams = signOutParamsStub.withArgs(
      expectedSignOutParams
    ).args[0]?.[0];
    assert.deepStrictEqual(
      actualSignOutParams,
      expectedSignOutParams,
      `Fetch element content with signout was not called with expected signout parameters value ${JSON.stringify(
        expectedSignOutParams
      )}, it was called with ${JSON.stringify(actualSignOutParams)}`
    );
    const actualOverrideSignOutParams = signOutParamsStub.withArgs(
      expectedOverrideSignOutParams
    ).args[0]?.[0];
    assert.deepStrictEqual(
      actualOverrideSignOutParams,
      expectedOverrideSignOutParams,
      `Fetch element content with override signout was not called with expected override signout parameters value ${JSON.stringify(
        expectedOverrideSignOutParams
      )}, it was called with ${JSON.stringify(actualOverrideSignOutParams)}`
    );

    const [generalCreateLocalDirectoryFunctionStub, localDirectoryStub] =
      createLocalDirectoryStub;
    assert.ok(
      generalCreateLocalDirectoryFunctionStub.called,
      'Create element local directory was not called'
    );
    const actualElementDirectory = localDirectoryStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElementDirectory,
      expectedElementDirectory,
      `Creating of element local directory was not called with expected ${expectedElementDirectory}, it was called with ${actualElementDirectory}`
    );

    const [generalSaveFileStub, savedElementDetailsStub] = saveElementStub;
    assert.ok(
      generalSaveFileStub.called,
      'Save element into local directory was not called'
    );
    const actualSavedElementDetails = savedElementDetailsStub.args[0]?.[0];
    const expectedSavedElementDetails = {
      fileName: element.name,
      fileExtension: element.extension,
      workspaceDirectoryPath: expectedElementDirectory,
    };
    assert.deepStrictEqual(
      actualSavedElementDetails,
      expectedSavedElementDetails,
      `Saving element into local directory was not called with expected ${expectedSavedElementDetails}, it was called with ${actualSavedElementDetails}`
    );

    assert.ok(
      showSavedElementStub.called,
      'Show saved element in the editor was not called'
    );

    assert.deepStrictEqual(
      dispatchSignoutActions.called,
      true,
      'Dispatch for override signout element on retrieve was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      searchLocationId: {
        name: searchLocationName,
        source: Source.INTERNAL,
      },
      serviceId: {
        name: serviceName,
        source: Source.INTERNAL,
      },
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchSignoutActions.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for retrieve element with override signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutActions.args[0]?.[0]
      )}`
    );
  });
});
