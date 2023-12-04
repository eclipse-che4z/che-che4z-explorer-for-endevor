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
  ElementTypesResponse,
  ErrorResponseType,
  ProcessorGroupsResponse,
  ResponseStatus,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import {
  mockGetProcessorGroupsByType,
  mockGetTypesInPlace,
} from './_mocks/endevor';
import * as sinon from 'sinon';
import { EndevorId } from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { TypeNode } from '../../tree/_doc/ElementTree';
import { viewTypeDetails } from '../type/viewTypeDetails';

describe('view type details', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.VIEW_TYPE_DETAILS,
      (dispatch, getConnectionConfiguration, typeNode) =>
        viewTypeDetails(dispatch, getConnectionConfiguration)(typeNode)
    );
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const procGroup = 'TEST-PROC';
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

  it('should print type details', async () => {
    //arrange
    const procGroupResponse: ProcessorGroupsResponse = {
      status: ResponseStatus.OK,
      result: [
        {
          environment: element.environment,
          stageId: '1',
          stageNumber: '1',
          system: element.system,
          type: element.type,
          procGroupName: procGroup,
          nextProcGoup: procGroup,
          description: 'Test processor group',
        },
      ],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getProcGroupStub = mockGetProcessorGroupsByType(
      service,
      parent,
      procGroup
    )(procGroupResponse);

    const typeDetailsResponse: ElementTypesResponse = {
      status: ResponseStatus.OK,
      result: [
        {
          environment: element.environment,
          stageNumber: '1',
          stageId: '1',
          system: element.system,
          type: element.type,
          nextType: element.type + '1',
          description: 'TYPE-DESC',
          defaultPrcGrp: 'DEF-PROC',
          dataFm: 'DATA-FM',
          fileExt: '.TXT',
          lang: 'EN',
        },
      ],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getTypeDetailsStub = mockGetTypesInPlace(
      service,
      parent.parent.subSystemMapPath,
      parent
    )(typeDetailsResponse);
    const dispatchTypeDetailsAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.VIEW_TYPE_DETAILS,
        dispatchTypeDetailsAction,
        async () => ({ service, searchLocation }),
        parent
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [getProcGroupFunction] = getProcGroupStub;
    assert.ok(
      getProcGroupFunction.called,
      'Get Processor Groups was not called'
    );
    const [getTypeDetailsFunction] = getTypeDetailsStub;
    assert.ok(
      getTypeDetailsFunction.called,
      'Get Type details in place was not called'
    );
  });

  it('should cancel the command in case of empty type details', async () => {
    //arrange
    const procGroupResponse: ProcessorGroupsResponse = {
      status: ResponseStatus.OK,
      result: [],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getProcGroupStub = mockGetProcessorGroupsByType(
      service,
      parent,
      procGroup
    )(procGroupResponse);

    const typeDetailsResponse: ElementTypesResponse = {
      status: ResponseStatus.OK,
      result: [],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getTypeDetailsStub = mockGetTypesInPlace(
      service,
      parent.parent.subSystemMapPath,
      parent
    )(typeDetailsResponse);
    const dispatchTypeDetailsAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.VIEW_TYPE_DETAILS,
        dispatchTypeDetailsAction,
        async () => ({ service, searchLocation }),
        parent
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [getProcGroupFunction] = getProcGroupStub;
    assert.ok(
      getProcGroupFunction.called,
      'Get Processor Groups was not called'
    );
    const [getTypeDetailsFunction] = getTypeDetailsStub;
    assert.ok(
      getTypeDetailsFunction.called,
      'Get Type details in place was not called'
    );
  });

  it('should cancel the command in case get type details fails', async () => {
    //arrange
    const procGroupResponse: ProcessorGroupsResponse = {
      status: ResponseStatus.OK,
      result: [
        {
          environment: element.environment,
          stageId: '1',
          stageNumber: '1',
          system: element.system,
          type: element.type,
          procGroupName: procGroup,
          nextProcGoup: procGroup,
          description: 'Test processor group',
        },
      ],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getProcGroupStub = mockGetProcessorGroupsByType(
      service,
      parent,
      procGroup
    )(procGroupResponse);

    const typeDetailsResponse: ElementTypesResponse = {
      status: ResponseStatus.ERROR,
      type: ErrorResponseType.GENERIC_ERROR,
      details: {
        messages: ['Could not get details for this type : ('],
        returnCode: 8,
      },
    };
    const getTypeDetailsStub = mockGetTypesInPlace(
      service,
      parent.parent.subSystemMapPath,
      parent
    )(typeDetailsResponse);
    const dispatchTypeDetailsAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.VIEW_TYPE_DETAILS,
        dispatchTypeDetailsAction,
        async () => ({ service, searchLocation }),
        parent
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [getProcGroupFunction] = getProcGroupStub;
    assert.ok(
      getProcGroupFunction.called,
      'Get Processor Groups was not called'
    );
    const [getTypeDetailsFunction] = getTypeDetailsStub;
    assert.ok(
      getTypeDetailsFunction.called,
      'Get Type details in place was not called'
    );
  });

  it('should cancel the command in case of failed processor group retrieval', async () => {
    //arrange
    const procGroupResponse: ProcessorGroupsResponse = {
      status: ResponseStatus.ERROR,
      type: ErrorResponseType.GENERIC_ERROR,
      details: {
        messages: ['Could not get processor groups for the type : ('],
        returnCode: 8,
      },
    };
    const getProcGroupStub = mockGetProcessorGroupsByType(
      service,
      parent,
      procGroup
    )(procGroupResponse);

    const typeDetailsResponse: ElementTypesResponse = {
      status: ResponseStatus.OK,
      result: [
        {
          environment: element.environment,
          stageNumber: '1',
          stageId: '1',
          system: element.system,
          type: element.type,
          nextType: element.type + '1',
          description: 'TYPE-DESC',
          defaultPrcGrp: 'DEF-PROC',
          dataFm: 'DATA-FM',
          fileExt: '.TXT',
          lang: 'EN',
        },
      ],
      details: {
        messages: [],
        returnCode: 0,
      },
    };
    const getTypeDetailsStub = mockGetTypesInPlace(
      service,
      parent.parent.subSystemMapPath,
      parent
    )(typeDetailsResponse);
    const dispatchTypeDetailsAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.VIEW_TYPE_DETAILS,
        dispatchTypeDetailsAction,
        async () => ({ service, searchLocation }),
        parent
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [getProcGroupFunction] = getProcGroupStub;
    assert.ok(
      getProcGroupFunction.called,
      'Get Processor Groups was not called'
    );
    const [getTypeDetailsFunction] = getTypeDetailsStub;
    assert.ok(
      getTypeDetailsFunction.called,
      'Get Type details in place was not called'
    );
  });
});
