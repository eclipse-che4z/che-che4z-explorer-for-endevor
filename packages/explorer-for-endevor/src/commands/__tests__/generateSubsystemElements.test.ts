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
  ResponseStatus,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import {
  mockGenerateSubsystemElementsInPlace,
  mockSearchForElements,
} from './_mocks/endevor';
import * as sinon from 'sinon';
import { UNIQUE_ELEMENT_FRAGMENT } from '../../constants';
import {
  mockAskingForChangeControlValue,
  mockAskingForGenerateAllElements,
} from './_mocks/dialogs';
import {
  Actions,
  SubsystemElementsUpdatedInPlace,
} from '../../store/_doc/Actions';
import { EndevorId } from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { generateSubsystemElementsCommand } from '../subsystem/generateSubsystemElements';
import {
  ElementNode,
  SubSystemNode,
  TypeNode,
} from '../../tree/_doc/ElementTree';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

describe('generating subsystem elements in place', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.GENERATE_SUBSYSTEM_ELEMENTS,
      async (dispatch, getConnectionConfiguration, subSystemNode) =>
        generateSubsystemElementsCommand(
          dispatch,
          getConnectionConfiguration
        )(subSystemNode)
    );
  });

  afterEach(() => {
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
  const searchLocationName = 'searchLocationName';
  const searchLocationId: EndevorId = {
    name: searchLocationName,
    source: Source.INTERNAL,
  };
  const searchLocation: SearchLocation = {
    environment: 'ENV',
    stageNumber: '1',
    ccid: 'TEST_CCID',
    comment: 'TEST_COMMENT',
  };
  const type1: TypeNode = {
    type: 'TYPE',
    name: 'TYP',
    elements: [],
    parent: {
      type: 'SUB',
      name: 'SUBSYS',
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
  };
  const type2: TypeNode = {
    type: 'TYPE',
    name: 'ANOTHER_TYP',
    elements: [],
    parent: {
      type: 'SUB',
      name: 'SUBSYS',
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
  };
  const element1: Element = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'TYP',
    name: 'ELM',
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
    noSource: false,
    id: 'TEST-ID',
    processorGroup: '*NOPROC*',
  };
  const element1Node: ElementNode = {
    serviceId: {
      name: serviceName,
      source: Source.INTERNAL,
    },
    searchLocationId: {
      name: searchLocationName,
      source: Source.INTERNAL,
    },
    type: 'ELEMENT_IN_PLACE',
    name: element1.name,
    element: element1,
    parent: type1,
    tooltip: 'ELEMENT1',
    timestamp: UNIQUE_ELEMENT_FRAGMENT,
  };
  const element2: Element = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'TYP',
    name: 'ELM2',
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
    noSource: false,
    id: 'TEST-ID',
    processorGroup: '*NOPROC*',
  };
  const element2Node: ElementNode = {
    serviceId: {
      name: serviceName,
      source: Source.INTERNAL,
    },
    searchLocationId: {
      name: searchLocationName,
      source: Source.INTERNAL,
    },
    type: 'ELEMENT_IN_PLACE',
    name: element2.name,
    element: element2,
    parent: type1,
    tooltip: 'ELEMENT2',
    timestamp: UNIQUE_ELEMENT_FRAGMENT,
  };
  const element3: Element = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
    type: 'ANOTHER_TYP',
    name: 'ELM3',
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
    noSource: false,
    id: 'TEST-ID',
    processorGroup: '*NOPROC*',
  };
  const element3Node: ElementNode = {
    serviceId: {
      name: serviceName,
      source: Source.INTERNAL,
    },
    searchLocationId: {
      name: searchLocationName,
      source: Source.INTERNAL,
    },
    type: 'ELEMENT_IN_PLACE',
    name: element3.name,
    element: element3,
    parent: type2,
    tooltip: 'ELEMENT3',
    timestamp: UNIQUE_ELEMENT_FRAGMENT,
  };
  const actionChangeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };
  const subSystemNode: SubSystemNode = {
    type: 'SUB',
    name: 'SUBSYS',
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
    children: [
      {
        ...type1,
        elements: [element1Node, element2Node],
      },
      {
        ...type2,
        elements: [element3Node],
      },
    ],
  };
  const subSystemMapPath: SubSystemMapPath = {
    environment: 'ENV',
    stageNumber: '1',
    system: 'SYS',
    subSystem: 'SUB',
  };

  it('should generate all of the elements in place within a subsystem', async () => {
    // arrange
    mockAskingForChangeControlValue(actionChangeControlValue);
    mockAskingForGenerateAllElements(true);
    const generateSubsystemElementsStub = mockGenerateSubsystemElementsInPlace(
      service,
      subSystemMapPath,
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
    const searchForElementsStub = mockSearchForElements(
      service,
      {
        environment: subSystemMapPath.environment,
        stageNumber: subSystemMapPath.stageNumber,
      },
      subSystemMapPath.system,
      subSystemMapPath.subSystem
    )({
      status: ResponseStatus.OK,
      result: [element1],
    });
    const dispatchGenerateAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.GENERATE_SUBSYSTEM_ELEMENTS,
        dispatchGenerateAction,
        async () => ({ service, searchLocation }),
        subSystemNode
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [generalFunctionStub] = generateSubsystemElementsStub;
    assert.ok(
      generalFunctionStub.called,
      'Generate subsystem elements in place Endevor API was not called'
    );
    const [searchFunctionStub] = searchForElementsStub;
    assert.ok(
      searchFunctionStub.notCalled,
      'Search for elements in place was called'
    );
    assert.ok(
      dispatchGenerateAction.called,
      'Dispatch for the generate subsystem elements was not called'
    );
    const actualDispatchAction = dispatchGenerateAction.args[0]?.[0];
    const expectedDispatchAction: SubsystemElementsUpdatedInPlace = {
      type: Actions.SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      subSystemMapPath,
      lastActionCcid: actionChangeControlValue.ccid,
    };
    assert.deepStrictEqual(
      actualDispatchAction,
      expectedDispatchAction,
      `Dispatch for the generate subsystem elements was not called with: ${JSON.stringify(
        expectedDispatchAction
      )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
    );
  });
});
