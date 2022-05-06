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

import { describe } from 'mocha';
import * as vscode from 'vscode';
import { CommandId } from '../commands/id';
import { toTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import * as assert from 'assert';
import {
  Element,
  ElementSearchLocation,
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { generateElementInPlaceCommand } from '../commands/generateElementInPlace';
import { mockGenerateElementInPlace } from '../_mocks/endevor';
import * as sinon from 'sinon';
import { UNIQUE_ELEMENT_FRAGMENT } from '../constants';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
  mockAskingForPrintListing,
} from '../_mocks/dialogs';
import { Actions, ElementGeneratedInPlace } from '../_doc/Actions';
import * as printListingCommand from '../commands/printListing';
import {
  ProcessorStepMaxRcExceededError,
  SignoutError,
} from '@local/endevor/_doc/Error';

describe('generating an element in place', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.GENERATE_ELEMENT,
      generateElementInPlaceCommand
    );
  });

  afterEach(() => {
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
  const actionChangeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };

  it('should generate an element in place with printing an element listing afterwards', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: undefined,
      },
    ]);
    mockAskingForPrintListing(true);
    const printListingStub = mockPrintElementListingCommand();
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalFunctionStub] = generateElementStub;
    assert.ok(
      generalFunctionStub.called,
      'Generate element in place Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedInPlace = {
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceName,
      searchLocationName,
      searchLocation,
      service,
      elements: [element],
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
    assert.ok(
      printListingStub.called,
      'Print listing command for the generated element was not called'
    );
  });

  const mockPrintElementListingCommand = () => {
    return sinon
      .stub(printListingCommand, 'printListingCommand')
      .returns(Promise.resolve());
  };

  it('should print an element listing for the generate processor element error', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const generateProcessorError = new ProcessorStepMaxRcExceededError(
      'Do you really expect me to generate this crap, you think Im russian propagandist or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      generateProcessorError,
      ProcessorStepMaxRcExceededError.prototype
    );
    const generateElementStub = mockGenerateElementInPlace(
      service,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: generateProcessorError,
      },
    ]);
    const dispatchGenerateAction = sinon.spy();
    const printListingStub = mockPrintElementListingCommand();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalFunctionStub] = generateElementStub;
    assert.ok(
      generalFunctionStub.called,
      'Generate element in place Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedInPlace = {
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceName,
      searchLocationName,
      searchLocation,
      service,
      elements: [element],
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
    assert.ok(
      printListingStub.called,
      'Print listing command for the generated element was not called'
    );
  });

  it('should generate an element with overriding the signout', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const signoutError = new SignoutError(
      'You are trying to enter the territory which is not yours, are you Putin or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: signoutError,
      },
      {
        signoutArg: { overrideSignOut: true },
        mockResult: undefined,
      },
    ]);
    const askToPrintListingStub = mockAskingForPrintListing(false);
    mockAskingForOverrideSignout([element.name])(true);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , , generalFunctionStub] = generateElementStub;
    assert.ok(
      generalFunctionStub.calledTwice,
      `Generate element in place Endevor API was not called twice`
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedInPlace = {
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceName,
      searchLocationName,
      searchLocation,
      service,
      elements: [element],
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
    assert.ok(
      askToPrintListingStub.called,
      'Dialog about printing listing the generated element was not called'
    );
  });

  it('should cancel the command in case of signout error', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const signoutError = new SignoutError(
      'You are trying to enter the territory which is not yours, are you Putin or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: signoutError,
      },
    ]);
    const askToPrintListingStub = mockAskingForPrintListing(false);
    const askForOverrideSignoutStub = mockAskingForOverrideSignout([
      element.name,
    ])(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalFunctionStub] = generateElementStub;
    assert.ok(
      generalFunctionStub.called,
      'Generate element in place Endevor API was not called'
    );
    assert.ok(
      askForOverrideSignoutStub.called,
      'Dialog about overriding the signout of the element was not called'
    );
    assert.ok(
      dispatchGenerateAction.notCalled,
      'Dispatch for the generated element was called'
    );
    assert.ok(
      askToPrintListingStub.notCalled,
      'Dialog about printing listing the generated element was called'
    );
  });

  it('should not show an element listing for the generic generate error', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const genericError = new Error(
      'Something generic and usual, like peace in the whole world <3'
    );
    const generateElementStub = mockGenerateElementInPlace(
      service,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: genericError,
      },
    ]);
    const askToPrintListingStub = mockAskingForPrintListing(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalFunctionStub] = generateElementStub;
    assert.ok(
      generalFunctionStub.called,
      'Generate element in place Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.notCalled,
      'Dispatch for the generated element was called'
    );
    assert.ok(
      askToPrintListingStub.notCalled,
      'Dialog about printing listing the generated element was called'
    );
  });
});
