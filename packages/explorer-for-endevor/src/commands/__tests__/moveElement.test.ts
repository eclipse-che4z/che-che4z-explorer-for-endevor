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
  ResponseStatus,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { mockMoveElement, mockSearchForElements } from './_mocks/endevor';
import * as sinon from 'sinon';
import { mockAskingForMoveOptions } from './_mocks/dialogs';
import { TypeNode } from '../../tree/_doc/ElementTree';
import { Actions, ElementMoved } from '../../store/_doc/Actions';
import {
  CachedEndevorInventory,
  ElementFilterType,
  ElementsUpTheMapFilter,
  EndevorCacheVersion,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { moveElementCommand } from '../element/moveElement';
import { MoveOptions } from '../../dialogs/multi-step/moveOptions';
import { toSubsystemMapPathId } from '../../store/utils';

describe('moving an element', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.MOVE_ELEMENT,
      (
        dispatch,
        getConnectionConfiguration,
        getEndevorInventory,
        getElementsUpTheMapFilterValue,
        elementNode
      ) =>
        moveElementCommand(
          dispatch,
          getConnectionConfiguration,
          getEndevorInventory,
          getElementsUpTheMapFilterValue
        )(elementNode)
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
  const upTheMapFilter = (value: boolean): ElementsUpTheMapFilter => ({
    type: ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER,
    value,
  });
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
  const elementUpTheMapLocation: SubSystemMapPath = {
    environment: 'ENV',
    system: 'SYS',
    subSystem: 'SUBSYS',
    stageNumber: '2',
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
  const sourceElementMapPath: ElementMapPath = {
    ...elementLocation,
    type: parent.name,
    id: element.name,
  };
  const targetElementMapPath: ElementMapPath = {
    ...elementUpTheMapLocation,
    type: parent.name,
    id: element.name,
  };
  const targetElement: Element = {
    ...element,
    ...targetElementMapPath,
  };
  const endevorInventory: CachedEndevorInventory = {
    cacheVersion: EndevorCacheVersion.UP_TO_DATE,
    endevorMap: {
      [toSubsystemMapPathId(elementLocation)]: [
        toSubsystemMapPathId(elementUpTheMapLocation),
      ],
    },
    environmentStages: {},
  };
  const changeControlValue = {
    ccid: moveOptions.ccid,
    comment: moveOptions.comment,
  };

  describe('without "bypass element delete"', () => {
    before(() => {
      moveOptions.bypassElementDelete = false;
    });

    it('with "up the map" filter on should show target element', async () => {
      // arrange
      mockAskingForMoveOptions(moveOptions);
      const dispatchMoveAction = sinon.spy();
      const fetchTargetElementStub = mockSearchForElements(
        service,
        {
          environment: targetElement.environment,
          stageNumber: targetElement.stageNumber,
        },
        targetElement.system,
        targetElement.subSystem
      )({
        status: ResponseStatus.OK,
        result: [targetElement],
      });
      const moveElementStub = mockMoveElement(
        service,
        element,
        changeControlValue,
        moveOptions
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
          CommandId.MOVE_ELEMENT,
          dispatchMoveAction,
          async () => ({ service, searchLocation }),
          () => () => endevorInventory,
          () => () => upTheMapFilter(true),
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
      const [moveFunctionStub] = moveElementStub;
      assert.ok(
        moveFunctionStub.called,
        'Move element Endevor API was not called'
      );
      assert.ok(
        dispatchMoveAction.called,
        'Dispatch for the moved element was not called'
      );
      const actualDispatchAction = dispatchMoveAction.args[0]?.[0];
      const expectedDispatchAction: ElementMoved = {
        type: Actions.ELEMENT_MOVED,
        serviceId,
        searchLocationId,
        bypassElementDelete: false,
        sourceElement: {
          ...sourceElementMapPath,
          id: element.id,
          name: element.name,
          noSource: false,
          extension: element.extension,
          lastActionCcid: element.lastActionCcid,
          processorGroup: element.processorGroup,
        },
        targetElement: {
          ...targetElementMapPath,
          id: targetElement.id,
          name: targetElement.name,
          noSource: false,
          extension: targetElement.extension,
          lastActionCcid: changeControlValue.ccid.toUpperCase(),
          processorGroup: targetElement.processorGroup,
          signoutId: undefined,
          vvll: undefined,
        },
      };
      assert.deepStrictEqual(
        actualDispatchAction,
        expectedDispatchAction,
        `Dispatch for the moved element was not called with: ${JSON.stringify(
          expectedDispatchAction
        )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
      );
      const [fetchTargetFunctionStub] = fetchTargetElementStub;
      assert.ok(
        fetchTargetFunctionStub.called,
        'Fetch target element was not called'
      );
    });

    it('with "up the map" filter off should not show an element', async () => {
      // arrange
      mockAskingForMoveOptions(moveOptions);
      const dispatchMoveAction = sinon.spy();
      const fetchSourceElementStub = mockSearchForElements(
        service,
        {
          environment: element.environment,
          stageNumber: element.stageNumber,
        },
        element.system,
        element.subSystem
      )({
        status: ResponseStatus.OK,
        result: [element],
      });
      const moveElementStub = mockMoveElement(
        service,
        element,
        changeControlValue,
        moveOptions
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
          CommandId.MOVE_ELEMENT,
          dispatchMoveAction,
          async () => ({ service, searchLocation }),
          () => () => endevorInventory,
          () => () => upTheMapFilter(false),
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
      const [moveFunctionStub] = moveElementStub;
      assert.ok(
        moveFunctionStub.called,
        'Move element Endevor API was not called'
      );
      assert.ok(
        dispatchMoveAction.called,
        'Dispatch for the moved element was not called'
      );
      const actualDispatchAction = dispatchMoveAction.args[0]?.[0];
      const expectedDispatchAction: ElementMoved = {
        type: Actions.ELEMENT_MOVED,
        serviceId,
        searchLocationId,
        bypassElementDelete: false,
        sourceElement: {
          ...sourceElementMapPath,
          id: element.id,
          name: element.name,
          noSource: false,
          extension: element.extension,
          lastActionCcid: element.lastActionCcid,
          processorGroup: element.processorGroup,
        },
        targetElement: undefined,
      };
      assert.deepStrictEqual(
        actualDispatchAction,
        expectedDispatchAction,
        `Dispatch for the moved element was not called with: ${JSON.stringify(
          expectedDispatchAction
        )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
      );
      const [fetchSourceFunctionStub] = fetchSourceElementStub;
      assert.ok(
        fetchSourceFunctionStub.notCalled,
        'Fetch source element was called'
      );
    });
  });

  describe('with "bypass element delete"', () => {
    before(() => {
      moveOptions.bypassElementDelete = true;
    });

    it('with "up the map" filter off should show source element', async () => {
      mockAskingForMoveOptions(moveOptions);
      const dispatchMoveAction = sinon.spy();
      const fetchSourceElementStub = mockSearchForElements(
        service,
        {
          environment: element.environment,
          stageNumber: element.stageNumber,
        },
        element.system,
        element.subSystem
      )({
        status: ResponseStatus.OK,
        result: [element],
      });
      const moveElementStub = mockMoveElement(
        service,
        element,
        changeControlValue,
        moveOptions
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
          CommandId.MOVE_ELEMENT,
          dispatchMoveAction,
          async () => ({ service, searchLocation }),
          () => () => endevorInventory,
          () => () => upTheMapFilter(false),
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
      const [moveFunctionStub] = moveElementStub;
      assert.ok(
        moveFunctionStub.called,
        'Move element Endevor API was not called'
      );
      assert.ok(
        dispatchMoveAction.called,
        'Dispatch for the moved element was not called'
      );
      const actualDispatchAction = dispatchMoveAction.args[0]?.[0];
      const expectedDispatchAction: ElementMoved = {
        type: Actions.ELEMENT_MOVED,
        serviceId,
        searchLocationId,
        bypassElementDelete: true,
        sourceElement: {
          ...sourceElementMapPath,
          id: element.id,
          name: element.name,
          noSource: false,
          extension: element.extension,
          lastActionCcid: element.lastActionCcid,
          processorGroup: element.processorGroup,
        },
        targetElement: undefined,
      };
      assert.deepStrictEqual(
        actualDispatchAction,
        expectedDispatchAction,
        `Dispatch for the moved element was not called with: ${JSON.stringify(
          expectedDispatchAction
        )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
      );
      const [fetchSourceFunctionStub] = fetchSourceElementStub;
      assert.ok(
        fetchSourceFunctionStub.called,
        'Fetch source element was not called'
      );
    });

    it('with "up the map" filter on should show source element', async () => {
      mockAskingForMoveOptions(moveOptions);
      const dispatchMoveAction = sinon.spy();
      const fetchSourceElementStub = mockSearchForElements(
        service,
        {
          environment: element.environment,
          stageNumber: element.stageNumber,
        },
        element.system,
        element.subSystem
      )({
        status: ResponseStatus.OK,
        result: [element],
      });
      const moveElementStub = mockMoveElement(
        service,
        element,
        changeControlValue,
        moveOptions
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
          CommandId.MOVE_ELEMENT,
          dispatchMoveAction,
          async () => ({ service, searchLocation }),
          () => () => endevorInventory,
          () => () => upTheMapFilter(true),
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
      const [moveFunctionStub] = moveElementStub;
      assert.ok(
        moveFunctionStub.called,
        'Move element Endevor API was not called'
      );
      assert.ok(
        dispatchMoveAction.called,
        'Dispatch for the moved element was not called'
      );
      const actualDispatchAction = dispatchMoveAction.args[0]?.[0];
      const expectedDispatchAction: ElementMoved = {
        type: Actions.ELEMENT_MOVED,
        serviceId,
        searchLocationId,
        bypassElementDelete: true,
        sourceElement: {
          ...sourceElementMapPath,
          id: element.id,
          name: element.name,
          noSource: false,
          extension: element.extension,
          lastActionCcid: element.lastActionCcid,
          processorGroup: element.processorGroup,
        },
        targetElement: undefined,
      };
      assert.deepStrictEqual(
        actualDispatchAction,
        expectedDispatchAction,
        `Dispatch for the moved element was not called with: ${JSON.stringify(
          expectedDispatchAction
        )}, but with: ${JSON.stringify(actualDispatchAction)} instead`
      );
      const [fetchSourceFunctionStub] = fetchSourceElementStub;
      assert.ok(
        fetchSourceFunctionStub.called,
        'Fetch source element was not called'
      );
    });
  });
});
