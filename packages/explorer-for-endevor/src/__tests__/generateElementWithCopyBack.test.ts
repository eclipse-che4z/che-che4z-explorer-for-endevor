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
  ElementMapPath,
  ElementSearchLocation,
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { generateElementWithCopyBackCommand } from '../commands/generateElementWithCopyBack';
import { mockGenerateElementWithCopyBack } from '../_mocks/endevor';
import * as sinon from 'sinon';
import { UNIQUE_ELEMENT_FRAGMENT } from '../constants';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
  mockAskingForPrintListing,
  mockAskingForUploadLocation,
} from '../dialogs/_mocks/dialogs';
import { TypeNode } from '../tree/_doc/ElementTree';
import * as printListingCommand from '../commands/printListing';
import {
  Actions,
  ElementGeneratedInPlace,
  ElementGeneratedWithCopyBack,
} from '../store/_doc/Actions';
import {
  ProcessorStepMaxRcExceededError,
  SignoutError,
} from '@local/endevor/_doc/Error';
import { EndevorId } from '../store/_doc/v2/Store';
import { Source } from '../store/storage/_doc/Storage';

describe('generating an element with copy back', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
      generateElementWithCopyBackCommand
    );
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

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
    apiVersion: ServiceApiVersion.V2,
  };
  const searchLocationName = 'searchLocationName';
  const searchLocationId: EndevorId = {
    name: searchLocationName,
    source: Source.INTERNAL,
  };
  const searchLocation: ElementSearchLocation = {
    configuration: 'ANY-CONFIG',
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
  const elementUri = toTreeElementUri({
    serviceId,
    searchLocationId,
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
  const changeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };
  const parent: TypeNode = {
    type: 'TYPE',
    name: 'TYP',
    elements: new Map(),
    parent: {
      type: 'SUB',
      name: 'SUB',
      parent: {
        type: 'SYS',
        name: 'SYS',
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

  it('should generate an element with copy back with printing an element listing afterwards', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: undefined,
      },
    ]);
    mockAskingForPrintListing(true);
    const dispatchGenerateAction = sinon.spy();
    const printListingStub = mockPrintElementListingCommand();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      'Generate element with copy back Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedWithCopyBack = {
      type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
      targetLocation,
      pathUpTheMap: element,
      fetchElementsArgs: { service, searchLocation },
      treePath: {
        serviceId,
        searchLocationId,
        searchLocation: {
          environment: targetLocation.environment,
          stageNumber: targetLocation.stageNumber,
          system: parent.parent.parent.name,
          subSystem: parent.parent.name,
        },
      },
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

  it('should generate an element with no source', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: true }
    )([
      {
        mockResult: undefined,
      },
    ]);
    mockAskingForPrintListing(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
        },
        true
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
      'Generate element with copy back Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedWithCopyBack = {
      type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
      targetLocation,
      pathUpTheMap: element,
      fetchElementsArgs: { service, searchLocation },
      treePath: {
        serviceId,
        searchLocationId,
        searchLocation: {
          environment: targetLocation.environment,
          stageNumber: targetLocation.stageNumber,
          system: parent.parent.parent.name,
          subSystem: parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
  });

  it('should generate an element in place', async () => {
    // arrange
    const targetLocation: ElementMapPath = element;
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: undefined,
      },
    ]);
    mockAskingForPrintListing(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      'Generate element with copy back Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedInPlace = {
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element,
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
  });

  it('should generate an element with overriding the element signout', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const signoutError = new SignoutError(
      'You are trying to enter the territory which is not yours, are you Putin or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: signoutError,
      },
      {
        signoutArg: {
          overrideSignOut: true,
        },
        mockResult: undefined,
      },
    ]);
    mockAskingForPrintListing(false);
    mockAskingForOverrideSignout([element.name])(true);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      `Generate element with copy back Endevor API was not called twice`
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedWithCopyBack = {
      type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
      targetLocation,
      pathUpTheMap: element,
      fetchElementsArgs: { service, searchLocation },
      treePath: {
        serviceId,
        searchLocationId,
        searchLocation: {
          environment: targetLocation.environment,
          stageNumber: targetLocation.stageNumber,
          system: parent.parent.parent.name,
          subSystem: parent.parent.name,
        },
      },
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
  });

  it('should show an element listing for the generate processor error', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateProcessorError = new ProcessorStepMaxRcExceededError(
      'Do you really expect me to generate this crap, you think Im russian propagandist or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(
      generateProcessorError,
      ProcessorStepMaxRcExceededError.prototype
    );
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
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
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      'Generate element with copy back Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generated element was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: ElementGeneratedWithCopyBack = {
      type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
      targetLocation,
      pathUpTheMap: element,
      fetchElementsArgs: { service, searchLocation },
      treePath: {
        serviceId,
        searchLocationId,
        searchLocation: {
          environment: targetLocation.environment,
          stageNumber: targetLocation.stageNumber,
          system: parent.parent.parent.name,
          subSystem: parent.parent.name,
        },
      },
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

  it('should cancel the command in case of signout error', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const signoutError = new SignoutError(
      'You are trying to enter the territory which is not yours, are you Putin or smt ;?'
    );
    // workaround for the tests, for some reason, the error is passed incorrectly,
    // but works properly in the code itself
    Object.setPrototypeOf(signoutError, SignoutError.prototype);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: signoutError,
      },
    ]);
    mockAskingForOverrideSignout([element.name])(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      'Generate element with copy back Endevor API was not called'
    );
    assert.ok(
      dispatchGenerateAction.notCalled,
      'Dispatch for the generated element was called'
    );
  });

  it('should not show an element listing for the generic generate error', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      configuration: searchLocation.configuration,
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      name: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const genericError = new Error(
      'Something generic and usual, like peace in the whole world <3'
    );
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      element,
      changeControlValue,
      { noSource: false }
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
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          uri: elementUri,
          parent,
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
      'Generate element with copy back Endevor API was not called'
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
