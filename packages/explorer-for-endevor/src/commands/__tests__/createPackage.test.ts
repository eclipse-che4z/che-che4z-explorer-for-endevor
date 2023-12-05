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
import { mockCreatePackage } from './_mocks/endevor';
import * as sinon from 'sinon';
import {
  mockAskingForPackageCreateOptions,
  mockAskingForPackageMoveOptions,
} from './_mocks/dialogs';
import { TypeNode } from '../../tree/_doc/ElementTree';
import { EndevorId } from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { MoveOptions } from '../../dialogs/multi-step/moveOptions';
import { createPackageCommand } from '../package/createPackage';
import { PackageCreateOptions } from '../../dialogs/multi-step/packageCreate';

describe('creating a package', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.CREATE_PACKAGE,
      (dispatch, getConnectionConfiguration, elementNode, nodes) =>
        createPackageCommand(dispatch, getConnectionConfiguration)(
          elementNode,
          nodes
        )
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
  };
  const packageOptions: PackageCreateOptions = {
    name: 'TESTPACKAGE',
    description: 'special delivery',
    sharable: true,
    backoutEnabled: true,
    doNotValidateSCL: false,
    isEmergency: false,
  };
  const sclContent = 'MOVE PACKAGE FROM SOMEWHERE OPTIONS SOME.';
  const moveOptions: MoveOptions = {
    ccid: 'M2TEST',
    comment: 'Move it',
    withHistory: false,
    bypassElementDelete: false,
    synchronize: false,
    retainSignout: false,
    ackElementJump: false,
  };

  const elementLocation: SubSystemMapPath = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '1',
  };

  const element: Element = {
    ...elementLocation,
    type: 'TYP',
    id: 'ELM',
    name: 'ELM',
    extension: 'ext',
    lastActionCcid: 'LAST-CCID',
    noSource: false,
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

  describe('with one element node', () => {
    it('should create a package', async () => {
      // arrange
      const askForPackageOptionsStub =
        mockAskingForPackageCreateOptions(packageOptions);
      const askForMoveOptionsStub =
        mockAskingForPackageMoveOptions(moveOptions);
      const dispatchCreatePackageAction = sinon.spy();
      const createPackageStub = mockCreatePackage(
        service,
        { name: packageOptions.name, description: packageOptions.description },
        packageOptions,
        sclContent
      )({
        status: ResponseStatus.OK,
        details: {
          messages: [],
          returnCode: 0,
        },
      });
      // act
      try {
        await vscode.commands.executeCommand(
          CommandId.CREATE_PACKAGE,
          dispatchCreatePackageAction,
          async () => ({ service, searchLocation }),
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
      const [createPackageFunctionStub] = createPackageStub;
      assert.ok(
        createPackageFunctionStub.called,
        'Create package Endevor API was not called'
      );
      assert.ok(
        askForPackageOptionsStub.called,
        'Create package Endevor API was not called'
      );
      assert.ok(
        askForMoveOptionsStub.called,
        'Create package Endevor API was not called'
      );
    });
  });

  describe('with multiple element nodes', () => {
    it('should fail if nodes from different search locations', async () => {
      // arrange
      const otherSearchLocationName = 'otherSearchLocationName';
      const otherSearchLocationId: EndevorId = {
        name: otherSearchLocationName,
        source: Source.INTERNAL,
      };
      const askForPackageOptionsStub =
        mockAskingForPackageCreateOptions(packageOptions);
      const askForMoveOptionsStub =
        mockAskingForPackageMoveOptions(moveOptions);
      const dispatchCreatePackageAction = sinon.spy();
      const createPackageStub = mockCreatePackage(
        service,
        { name: packageOptions.name, description: packageOptions.description },
        packageOptions,
        sclContent
      )({
        status: ResponseStatus.OK,
        details: {
          messages: [],
          returnCode: 0,
        },
      });
      // act
      try {
        await vscode.commands.executeCommand(
          CommandId.CREATE_PACKAGE,
          dispatchCreatePackageAction,
          async () => ({ service, searchLocation }),
          {
            type: element.type,
            name: element.name,
            element,
            parent,
            serviceId,
            searchLocationId,
          },
          [
            {
              type: element.type,
              name: element.name,
              element,
              parent,
              serviceId,
              searchLocationId,
            },
            {
              type: element.type,
              name: element.name,
              element,
              parent,
              otherSearchLocationId,
              otherSearchLocationName,
            },
          ]
        );
      } catch (e) {
        assert.fail(
          `Test failed because of uncaught error inside command: ${e.message}`
        );
      }
      // assert
      const [createPackageFunctionStub] = createPackageStub;
      assert.ok(
        createPackageFunctionStub.notCalled,
        'Create package Endevor API was called'
      );
      assert.ok(
        askForPackageOptionsStub.notCalled,
        'Create package Endevor API was called'
      );
      assert.ok(
        askForMoveOptionsStub.notCalled,
        'Create package Endevor API was called'
      );
    });
  });
});
