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
  ElementMapPath,
  ErrorResponseType,
  ResponseStatus,
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { generateElementWithCopyBackCommand } from '../element/generateElementWithCopyBack';
import { mockGenerateElementWithCopyBack } from './_mocks/endevor';
import * as sinon from 'sinon';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
  mockAskingForListing,
  mockAskingForUploadLocation,
} from './_mocks/dialogs';
import { TypeNode } from '../../tree/_doc/ElementTree';
import * as printListingCommand from '../element/printListing';
import {
  Actions,
  ElementGeneratedInPlace,
  ElementGeneratedWithCopyBack,
} from '../../store/_doc/Actions';
import {
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { ConnectionConfigurations } from '../utils';

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
  const searchLocationName = 'searchLocationName';
  const searchLocationId: EndevorId = {
    name: searchLocationName,
    source: Source.INTERNAL,
  };
  const searchLocation: ElementSearchLocation = {
    configuration: 'ANY-CONFIG',
  };
  const credential: EndevorCredential = {
    value: service.credential,
    status: EndevorCredentialStatus.VALID,
  };
  const configurations: ConnectionConfigurations = {
    getConnectionDetails: async () => {
      return {
        status: EndevorConnectionStatus.VALID,
        value: {
          location: service.location,
          rejectUnauthorized: service.rejectUnauthorized,
          apiVersion: ServiceApiVersion.V2,
        },
      };
    },
    getEndevorConfiguration: async () => {
      return searchLocation.configuration;
    },
    getCredential: () => async () => {
      return credential;
    },
    getSearchLocation: async () => {
      return searchLocation;
    },
  };
  const changeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };
  const element: Element = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'TYP',
    id: 'ELM',
    name: 'ELM',
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
    noSource: false,
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

  it('should generate an element with copy back with printing an element listing afterwards', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
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
    const dispatchGenerateAction = sinon.spy();
    const askForListingStub = mockAskingForListing({
      printListing: true,
      printExecutionReport: false,
    });
    const printListingStub = mockPrintElementListingCommand();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
      pathUpTheMap: element,
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
      targetElement: {
        ...targetLocation,
        id: element.id,
        name: element.name,
        noSource: false,
        extension: element.extension,
        lastActionCcid: changeControlValue.ccid.toUpperCase(),
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

  it('should generate an element with no source', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: true }
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
    const dispatchGenerateAction = sinon.spy();
    const askForListingStub = mockAskingForListing({
      printListing: false,
      printExecutionReport: false,
    });
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
      pathUpTheMap: element,
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
      targetElement: {
        ...targetLocation,
        id: element.id,
        name: element.name,
        noSource: true,
        extension: element.extension,
        lastActionCcid: changeControlValue.ccid.toUpperCase(),
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
      askForListingStub.called,
      'Prompt for the generated elemen listing was not called'
    );
  });

  it('should generate an element in place', async () => {
    // arrange
    const targetLocation: ElementMapPath = element;
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
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
    const dispatchGenerateAction = sinon.spy();
    const askForListingStub = mockAskingForListing({
      printListing: false,
      printExecutionReport: false,
    });
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
    assert.ok(
      askForListingStub.called,
      'Prompt for the generated elemen listing was not called'
    );
  });

  it('should generate an element with overriding the element signout', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
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
        signoutArg: {
          overrideSignOut: true,
        },
        mockResult: {
          status: ResponseStatus.OK,
          details: {
            messages: [],
            returnCode: 0,
          },
        },
      },
    ]);
    mockAskingForOverrideSignout([element.name])(true);
    const dispatchGenerateAction = sinon.spy();
    const askForListingStub = mockAskingForListing({
      printListing: false,
      printExecutionReport: false,
    });
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [, , , , , generalFunctionStub] = generateElementStub;
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
      pathUpTheMap: element,
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
      targetElement: {
        ...targetLocation,
        id: element.id,
        name: element.name,
        noSource: element.noSource,
        extension: element.extension,
        lastActionCcid: changeControlValue.ccid.toUpperCase(),
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
      askForListingStub.called,
      'Prompt for the generated elemen listing was not called'
    );
  });

  it('should show an element listing for the generate processor error', async () => {
    // arrange
    const targetLocation: ElementMapPath = {
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
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
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
      pathUpTheMap: element,
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
      targetElement: {
        ...targetLocation,
        id: element.id,
        name: element.name,
        noSource: element.noSource,
        extension: element.extension,
        lastActionCcid: changeControlValue.ccid.toUpperCase(),
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
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR,
          details: {
            messages: [
              'You are trying to enter the territory which is not yours, are you Putin or smt ;?',
            ],
            reasonCode: 8,
          },
        },
      },
    ]);
    mockAskingForOverrideSignout([element.name])(false);
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
      environment: 'PREVENV',
      system: parent.parent.parent.name,
      subSystem: parent.parent.name,
      stageNumber: '1',
      type: parent.type,
      id: element.name,
    };
    mockAskingForUploadLocation(element)(targetLocation);
    mockAskingForChangeControlValue(changeControlValue);
    const generateElementStub = mockGenerateElementWithCopyBack(
      service,
      configuration,
      element,
      changeControlValue,
      { noSource: false }
    )([
      {
        mockResult: {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.GENERIC_ERROR,
          details: {
            messages: [
              'Something generic and usual, like peace in the whole world <3',
            ],
            reasonCode: 8,
          },
        },
      },
    ]);
    const askToPrintListingStub = mockAskingForListing({
      printExecutionReport: false,
      printListing: false,
    });
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
        configurations,
        dispatchGenerateAction,
        {
          type: element.type,
          name: element.name,
          element,
          parent,
          serviceId,
          searchLocationId,
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
