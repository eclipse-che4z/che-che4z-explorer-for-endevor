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
import * as assert from 'assert';
import {
  Element,
  ErrorResponseType,
  ResponseStatus,
  Service,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { generateElementInPlaceCommand } from '../element/generateElementInPlace';
import { mockGenerateElementInPlace } from './_mocks/endevor';
import * as sinon from 'sinon';
import { UNIQUE_ELEMENT_FRAGMENT } from '../../constants';
import {
  mockAskingForChangeControlValue,
  mockAskingForListing,
  mockAskingForOverrideSignout,
} from '../../commands/__tests__/_mocks/dialogs';
import { Actions, ElementGeneratedInPlace } from '../../store/_doc/Actions';
import * as printListingCommand from '../element/printListing';
import {
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { ElementNode, TypeNode } from '../../tree/_doc/ElementTree';

describe('generating an element in place', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.GENERATE_ELEMENT,
      (
        getConnectionDetails,
        getEndevorConfiguration,
        getCredential,
        getSearchLocation,
        dispatch,
        elementNode
      ) =>
        generateElementInPlaceCommand(
          {
            getConnectionDetails,
            getEndevorConfiguration,
            getCredential,
            getSearchLocation,
          },
          dispatch
        )(elementNode)
    );
  });

  afterEach(() => {
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
  const credential: EndevorCredential = {
    value: service.credential,
    status: EndevorCredentialStatus.VALID,
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

  const actionChangeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };
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

  it('should generate an element in place with printing an element listing afterwards', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      configuration,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: {
          status: ResponseStatus.OK,
          details: {
            messages: [],
            returnCode: 0,
          },
        },
      },
    ]);
    const askForListingStub = mockAskingForListing({
      printListing: true,
      printExecutionReport: false,
    });
    const printListingStub = mockPrintElementListingCommand();
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
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
        dispatchGenerateAction,
        elementNode
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
      serviceId,
      searchLocationId,
      element: { ...element, lastActionCcid: actionChangeControlValue.ccid },
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
    assert.ok(
      askForListingStub.called,
      'Prompt for the generated elemen listing was not called'
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
    const generateElementStub = mockGenerateElementInPlace(
      service,
      configuration,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR,
          details: {
            messages: [
              'Do you really expect me to generate this crap, you think Im russian propagandist or smt ;?',
            ],
            returnCode: 8,
          },
        },
      },
    ]);
    const dispatchGenerateAction = sinon.spy();
    const printListingStub = mockPrintElementListingCommand();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
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
        dispatchGenerateAction,
        elementNode
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
      serviceId,
      searchLocationId,
      element: { ...element, lastActionCcid: actionChangeControlValue.ccid },
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
    const generateElementStub = mockGenerateElementInPlace(
      service,
      configuration,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [
              'You are trying to enter the territory which is not yours, are you Putin or smt ;?',
            ],
            returnCode: 8,
          },
        },
      },
      {
        signoutArg: { overrideSignOut: true },
        mockResult: {
          status: ResponseStatus.OK,
          details: {
            messages: [],
            returnCode: 0,
          },
        },
      },
    ]);
    const askForListingStub = mockAskingForListing({
      printExecutionReport: false,
      printListing: false,
    });
    mockAskingForOverrideSignout([element.name])(true);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
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
        dispatchGenerateAction,
        elementNode
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
      serviceId,
      searchLocationId,
      element: { ...element, lastActionCcid: actionChangeControlValue.ccid },
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generated element was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
    assert.ok(
      askForListingStub.called,
      'Prompt for the generated element listing was not called'
    );
  });

  it('should cancel the command in case of signout error', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      configuration,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [
              'You are trying to enter the territory which is not yours, are you Putin or smt ;?',
            ],
            returnCode: 8,
          },
        },
      },
    ]);
    const askForOverrideSignoutStub = mockAskingForOverrideSignout([
      element.name,
    ])(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
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
        dispatchGenerateAction,
        elementNode
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
  });

  it('should not show an element listing for the generic generate error', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    const generateElementStub = mockGenerateElementInPlace(
      service,
      configuration,
      element,
      actionChangeControlValue
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.GENERIC_ERROR,
          details: {
            messages: [
              'Something generic and usual, like peace in the whole world <3',
            ],
            returnCode: 8,
          },
        },
      },
    ]);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT,
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
        dispatchGenerateAction,
        elementNode
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
  });
});
