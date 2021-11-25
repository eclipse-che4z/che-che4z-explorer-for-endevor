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

import { commands, Uri } from 'vscode';
import { CommandId } from '../commands/id';
import { addElementFromFileSystem } from '../commands/addElementFromFileSystem';
import * as sinon from 'sinon';
import {
  ActionChangeControlValue,
  ElementMapPath,
  ElementSearchLocation,
  Service,
  Element,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import * as assert from 'assert';
import { mockGettingFileContentWith } from '../_mocks/workspace';
import { TextEncoder } from 'util';
import { mockAddingElement } from '../_mocks/endevor';
import {
  mockAskingForChangeControlValue,
  mockAskingForUploadLocation,
  mockChooseFileUriFromFs,
} from '../_mocks/dialogs';
import { LocationNode } from '../_doc/ElementTree';
import { mockGetEndevorServiceByName } from '../_mocks/services';
import { mockGetElementLocationByName } from '../_mocks/elementLocations';
import { toSearchLocationId } from '../tree/endevor';
import { Actions } from '../_doc/Actions';
import { parseFilePath } from '../utils';

describe('adding new element', () => {
  before(() => {
    commands.registerCommand(
      CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
      addElementFromFileSystem
    );
  });

  afterEach(async () => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const serviceName = 'GenU';
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
  const searchLocationNodeName = 'LOC';
  const locationNode: LocationNode = {
    id: toSearchLocationId(serviceName)(searchLocationNodeName),
    type: 'LOCATION',
    name: searchLocationNodeName,
    serviceName,
  };

  const uploadedElementFilePath = '/some/temp/element.cbl';

  it('should add element to endevor', async () => {
    // arrange
    mockGetEndevorServiceByName(locationNode.serviceName)({
      location: service.location,
      credential: service.credential,
      rejectUnauthorized: false,
    });
    const searchLocation: ElementSearchLocation = {
      instance: 'ANY-INSTANCE',
    };
    mockGetElementLocationByName(locationNode.name)(searchLocation);
    mockChooseFileUriFromFs(Uri.file(uploadedElementFilePath));
    const elementContent =
      'everybody is on hackaton, and Im sitting alone, writing tests :(';
    mockGettingFileContentWith(Uri.file(uploadedElementFilePath))(
      Promise.resolve(new TextEncoder().encode(elementContent))
    );
    const addLocation: ElementMapPath = {
      instance: 'ANY',
      environment: 'ENV',
      system: 'SYS',
      subSystem: 'SUBSYS',
      stageNumber: '1',
      type: 'TYP',
      name: 'ELM',
    };
    const prefilledLocationDialogValue: ElementSearchLocation = {
      environment: addLocation.environment,
      stageNumber: addLocation.stageNumber,
      system: addLocation.system,
      subsystem: addLocation.subSystem,
      type: addLocation.type,
      element: addLocation.name,
      instance: searchLocation.instance,
    };
    mockAskingForUploadLocation(prefilledLocationDialogValue)(addLocation);
    const addChangeControlValue: ActionChangeControlValue = {
      ccid: 'test',
      comment: 'test',
    };
    mockAskingForChangeControlValue(addChangeControlValue);
    const addElementStub = mockAddingElement(
      service,
      addLocation,
      addChangeControlValue,
      elementContent
    )([undefined]);
    const dispatchAddedAction = sinon.spy();
    // act
    try {
      await commands.executeCommand(
        CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
        () => {
          // we don't have a store inside the tests
          return;
        },
        dispatchAddedAction,
        locationNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
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
      instance: addLocation.instance,
      environment: addLocation.environment,
      system: addLocation.system,
      subSystem: addLocation.subSystem,
      stageNumber: addLocation.stageNumber,
      type: addLocation.type,
      name: addLocation.name,
      // we know, that there will be an extension for sure
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      extension: parseFilePath(uploadedElementFilePath).fileExtension!,
    };
    const expextedAddedElementAction = {
      type: Actions.ELEMENT_ADDED,
      serviceName: locationNode.serviceName,
      service,
      searchLocationName: locationNode.name,
      searchLocation,
      element: addedElement,
    };
    assert.deepStrictEqual(
      expextedAddedElementAction,
      dispatchAddedAction.args[0]?.[0],
      `Expexted dispatch for add element to have been called with ${JSON.stringify(
        expextedAddedElementAction
      )}, but it was called with ${JSON.stringify(
        dispatchAddedAction.args[0]?.[0]
      )}`
    );
    const expectedNumberOfCalls = 1;
    assert.deepStrictEqual(
      dispatchAddedAction.callCount,
      expectedNumberOfCalls,
      `Expexted dispatch for add element to have been called ${expectedNumberOfCalls} times, but it was called ${dispatchAddedAction.callCount} times.`
    );
  });
});
