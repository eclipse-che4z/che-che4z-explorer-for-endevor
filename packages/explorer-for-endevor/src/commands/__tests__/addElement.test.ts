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

import { commands, Uri } from 'vscode';
import { CommandId } from '../id';
import { addElementFromFileSystem } from '../location/addElementFromFileSystem';
import * as sinon from 'sinon';
import {
  ActionChangeControlValue,
  ElementMapPath,
  Element,
  ResponseStatus,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import * as assert from 'assert';
import { mockGettingFileContentWith } from './_mocks/workspace';
import { TextEncoder } from 'util';
import { mockAddingElement } from './_mocks/endevor';
import {
  mockAskingForChangeControlValue,
  mockAskingForProcGroup,
  mockAskingForUploadLocation,
  mockChooseFileUriFromFs,
} from './_mocks/dialogs';
import { LocationNode } from '../../tree/_doc/ServiceLocationTree';
import { Actions } from '../../store/_doc/Actions';
import { EndevorId } from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { toServiceLocationCompositeKey } from '../../store/utils';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

describe('adding new element', () => {
  before(() => {
    commands.registerCommand(
      CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
      (dispatch, getConnectionConfiguration, elementNode) =>
        addElementFromFileSystem(
          dispatch,
          getConnectionConfiguration
        )(elementNode)
    );
  });

  afterEach(async () => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const configuration = 'TEST-CONFIG';
  const serviceName = 'GenU';
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
    rejectUnauthorized: false,
    credential: {
      type: CredentialType.BASE,
      user: 'test',
      password: 'something',
    },
    configuration,
  };
  const searchLocationNodeName = 'LOC';
  const searchLocationNodeId: EndevorId = {
    name: searchLocationNodeName,
    source: Source.INTERNAL,
  };
  const locationNode: LocationNode = {
    id: toServiceLocationCompositeKey(serviceId)(searchLocationNodeId),
    type: 'LOCATION',
    name: searchLocationNodeName,
    source: searchLocationNodeId.source,
    serviceName,
    serviceSource: serviceId.source,
    duplicated: false,
  };

  const uploadedElementFilePath = '/some/temp/element.cbl';

  it('should add element to endevor', async () => {
    // arrange
    const searchLocation: SearchLocation = {
      environment: 'ENV',
      stageNumber: '1',
    };
    mockChooseFileUriFromFs(Uri.file(uploadedElementFilePath));
    const elementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(uploadedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(elementContent))
    );
    const addLocation: ElementMapPath = {
      environment: 'ENV',
      system: 'SYS',
      subSystem: 'SUBSYS',
      stageNumber: '1',
      type: 'TYP',
      id: 'ELM',
    };
    const prefilledLocationDialogValue: SearchLocation = {
      environment: addLocation.environment,
      stageNumber: addLocation.stageNumber,
      system: addLocation.system,
      subsystem: addLocation.subSystem,
      type: addLocation.type,
      element: addLocation.id,
    };
    mockAskingForUploadLocation(prefilledLocationDialogValue)(addLocation);
    const addChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(addChangeControlValue);
    const procGroup = 'ProcessAllToCobol';
    mockAskingForProcGroup(procGroup);
    const addElementStub = mockAddingElement(
      service,
      addLocation,
      procGroup,
      addChangeControlValue,
      { content: elementContent, elementFilePath: uploadedElementFilePath }
    )([
      {
        status: ResponseStatus.OK,
        details: {
          messages: ['ELEMENT ADDED LIKE A CHARM, RC FOLLOWS:'],
          returnCode: 0,
        },
      },
    ]);
    const dispatchAddedAction = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
        dispatchAddedAction,
        () => {
          return { service, searchLocation };
        },
        locationNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalAddFunctionStub] = addElementStub;
    assert.ok(generalAddFunctionStub.called, `Add element was not called`);
    assert.deepStrictEqual(
      dispatchAddedAction.called,
      true,
      'Dispatch for add element was not called'
    );
    const addedElement: Element = {
      environment: addLocation.environment,
      system: addLocation.system,
      subSystem: addLocation.subSystem,
      stageNumber: addLocation.stageNumber,
      type: addLocation.type,
      name: addLocation.id,
      id: addLocation.id,
      noSource: false,
      lastActionCcid: addChangeControlValue.ccid.toUpperCase(),
    };
    const expectedAddedElementAction = {
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId: searchLocationNodeId,
      element: addedElement,
    };
    assert.deepStrictEqual(
      expectedAddedElementAction,
      dispatchAddedAction.args[0]?.[0],
      `Expected dispatch for add element to have been called with ${JSON.stringify(
        expectedAddedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchAddedAction.args[0]?.[0]
      )}`
    );
    const expectedNumberOfCalls = 1;
    assert.deepStrictEqual(
      dispatchAddedAction.callCount,
      expectedNumberOfCalls,
      `Expected dispatch for add element to have been called ${expectedNumberOfCalls} times, but it was called ${dispatchAddedAction.callCount} times.`
    );
  });
});
