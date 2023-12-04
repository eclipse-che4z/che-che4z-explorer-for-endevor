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

import * as sinon from 'sinon';
import * as assert from 'assert';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { editElementCommand } from '../element/editElement';
import {
  AUTOMATIC_SIGN_OUT_SETTING,
  EDIT_DIR,
  ENDEVOR_CONFIGURATION,
  FILE_EXT_RESOLUTION_DEFAULT,
  FILE_EXT_RESOLUTION_SETTING,
  UNIQUE_ELEMENT_FRAGMENT,
} from '../../constants';
import {
  Element,
  ErrorResponseType,
  ResponseStatus,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { getEditFolderUri, joinUri } from '../../utils';
import {
  mockCreatingDirectory,
  mockSavingFileIntoWorkspaceDirectory,
} from './_mocks/workspace';
import { mockShowingFileContentWith } from './_mocks/window';
import { fromEditedElementUri } from '../../uri/editedElementUri';
import { EditedElementUriQuery } from '../../uri/_doc/Uri';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
} from './_mocks/dialogs';
import { Actions } from '../../store/_doc/Actions';
import { TypeNode } from '../../tree/_doc/ElementTree';
import { Source } from '../../store/storage/_doc/Storage';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import {
  mockRetrieveElement,
  mockRetrieveElementWithSignout,
} from './_mocks/endevor';

describe('starting edit session for element', () => {
  type NotDefined = undefined;
  let beforeTestsAutoSignOut: boolean | NotDefined;
  let beforeTestsFileExtensionResolution: FileExtensionResolutions | NotDefined;

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

  const configuration = 'TEST-CONFIG';
  const serviceName = 'serviceName';
  const serviceId: EndevorId = {
    name: serviceName,
    source: Source.INTERNAL,
  };
  const service: EndevorAuthorizedService = {
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
    configuration,
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
    processorGroup: '*NOPROC*',
  };
  const searchLocationName = 'searchLocationName';
  const searchLocationId: EndevorId = {
    name: searchLocationName,
    source: Source.INTERNAL,
  };
  const searchLocation: SearchLocation = {
    environment: 'ANY-ENV',
    stageNumber: '1',
  };

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
    const retrieveElementStub = mockRetrieveElement(
      service,
      element
    )({
      status: ResponseStatus.OK,
      result: {
        content,
        fingerprint,
      },
    });
    // can be anything, but URI
    const storageUri = Uri.file(__dirname);
    const tempEditFolderUri = joinUri(storageUri)(EDIT_DIR);
    const elementDirectoryUri = getEditFolderUri(tempEditFolderUri)(
      {
        name: serviceName,
        source: Source.INTERNAL,
      },
      {
        name: searchLocationName,
        source: Source.INTERNAL,
      }
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
      elements: [],
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
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
    try {
      await editElementCommand(
        dispatchActions,
        async () => ({ service, searchLocation }),
        () => tempEditFolderUri
      )({
        type: 'ELEMENT_UP_THE_MAP',
        name: element.name,
        element,
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        parent,
        timestamp: UNIQUE_ELEMENT_FRAGMENT,
      });
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , contentStub] = retrieveElementStub;
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
      searchContext: {
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
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
    const retrieveElementStub = mockRetrieveElementWithSignout(
      service,
      element
    )([
      {
        signOutParamsArg: {
          signoutChangeControlValue,
        },
        signOutMockResult: {
          status: ResponseStatus.OK,
          result: {
            content,
            fingerprint,
          },
        },
      },
    ]);
    // can be anything, but URI
    const storageUri = Uri.file(__dirname);
    const tempEditFolderUri = joinUri(storageUri)(EDIT_DIR);
    const elementDirectoryUri = getEditFolderUri(tempEditFolderUri)(
      {
        name: serviceName,
        source: Source.INTERNAL,
      },
      {
        name: searchLocationName,
        source: Source.INTERNAL,
      }
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
      elements: [],
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
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
    try {
      await editElementCommand(
        dispatchActions,
        async () => ({ service, searchLocation }),
        () => tempEditFolderUri
      )({
        type: 'ELEMENT_UP_THE_MAP',
        name: element.name,
        element,
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        parent,
        timestamp: UNIQUE_ELEMENT_FRAGMENT,
      });
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , , contentStub] = retrieveElementStub;
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
      searchContext: {
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
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
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for edit element signout to have been called with ${JSON.stringify(
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
    mockAskingForOverrideSignout([element.name])(true);
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const retrieveElementStub = mockRetrieveElementWithSignout(
      service,
      element
    )([
      {
        signOutParamsArg: {
          signoutChangeControlValue,
        },
        signOutMockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [],
          },
        },
      },
      {
        signOutParamsArg: {
          signoutChangeControlValue,
          overrideSignOut: true,
        },
        signOutMockResult: {
          status: ResponseStatus.OK,
          result: {
            content,
            fingerprint,
          },
        },
      },
    ]);
    // can be anything, but URI
    const storageUri = Uri.file(__dirname);
    const tempEditFolderUri = joinUri(storageUri)(EDIT_DIR);
    const elementDirectoryUri = getEditFolderUri(tempEditFolderUri)(
      {
        name: serviceName,
        source: Source.INTERNAL,
      },
      {
        name: searchLocationName,
        source: Source.INTERNAL,
      }
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
      elements: [],
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
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
    try {
      await editElementCommand(
        dispatchActions,
        async () => ({ service, searchLocation }),
        () => tempEditFolderUri
      )({
        type: 'ELEMENT_UP_THE_MAP',
        name: element.name,
        element,
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        parent,
        timestamp: UNIQUE_ELEMENT_FRAGMENT,
      });
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , , contentStub] = retrieveElementStub;
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
      searchContext: {
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
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
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for edit element signout to have been called with ${JSON.stringify(
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
    mockAskingForOverrideSignout([element.name])(false);
    const content = 'Show me this Endevor!';
    const fingerprint = 'finger';
    const retrieveElementWithSignOutStub = mockRetrieveElementWithSignout(
      service,
      element
    )([
      {
        signOutParamsArg: {
          signoutChangeControlValue,
        },
        signOutMockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [],
          },
        },
      },
    ]);
    const retrieveElementStub = mockRetrieveElement(
      service,
      element
    )({
      status: ResponseStatus.OK,
      result: {
        content,
        fingerprint,
      },
    });
    // can be anything, but URI
    const storageUri = Uri.file(__dirname);
    const tempEditFolderUri = joinUri(storageUri)(EDIT_DIR);
    const elementDirectoryUri = getEditFolderUri(tempEditFolderUri)(
      {
        name: serviceName,
        source: Source.INTERNAL,
      },
      {
        name: searchLocationName,
        source: Source.INTERNAL,
      }
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
      elements: [],
      parent: {
        type: 'SUB',
        name: element.subSystem,
        parent: {
          type: 'SYS',
          name: element.system,
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
    try {
      await editElementCommand(
        dispatchActions,
        async () => ({ service, searchLocation }),
        () => tempEditFolderUri
      )({
        type: 'ELEMENT_UP_THE_MAP',
        name: element.name,
        element,
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        parent,
        timestamp: UNIQUE_ELEMENT_FRAGMENT,
      });
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , , retrieveElementWithSignOutContentStub] =
      retrieveElementWithSignOutStub;
    assert.ok(
      retrieveElementWithSignOutContentStub.calledOnce,
      'Retrieve an element with sign out Endevor API was not called once'
    );
    const [, , contentStub] = retrieveElementStub;
    assert.ok(
      contentStub.calledOnce,
      'Retrieve an element copy Endevor API was not called once'
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
      searchContext: {
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
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
      dispatchActions.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for edit element signout to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchActions.args[0]?.[0]
      )}`
    );
  });
});
