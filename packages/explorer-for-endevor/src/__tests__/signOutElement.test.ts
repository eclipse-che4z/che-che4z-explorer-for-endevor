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
import { isError } from '../utils';
import * as assert from 'assert';
import {
  Element,
  ElementSearchLocation,
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { signOutElementCommand } from '../commands/signOutElement';
import { mockSignOutElement } from '../_mocks/endevor';
import * as sinon from 'sinon';
import { toTreeElementUri } from '../uri/treeElementUri';
import {
  mockAskingForChangeControlValue,
  mockAskingForOverrideSignout,
} from '../_mocks/dialogs';
import { UNIQUE_ELEMENT_FRAGMENT } from '../constants';
import { Actions } from '../_doc/Actions';
import { SignoutError } from '@local/endevor/_doc/Error';

describe('signout an element', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.SIGN_OUT_ELEMENT,
      signOutElementCommand
    );
  });

  afterEach(async () => {
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
    ccid: 'test',
    comment: 'test',
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
    service,
    element,
    searchLocation,
  })(UNIQUE_ELEMENT_FRAGMENT);
  if (isError(elementUri)) {
    const error = elementUri;
    assert.fail(
      `Uri was not built correctly for tests because of: ${error.message}`
    );
  }
  const signoutChangeControlValue = {
    ccid: '111',
    comment: 'aaa',
  };

  it('should signout an element', async () => {
    // arrange
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const signOutSuccessResult = undefined;
    const signOutElementStub = mockSignOutElement(
      service,
      element
    )([
      {
        signoutArg: {
          signoutChangeControlValue,
        },
        result: signOutSuccessResult,
      },
    ]);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.SIGN_OUT_ELEMENT,
        dispatchSignoutAction,
        {
          type: 'TYP',
          name: 'ELM',
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    const [generalFunctionStub] = signOutElementStub;
    assert.ok(generalFunctionStub.called, 'Signout element was not called');
    assert.ok(
      dispatchSignoutAction.called,
      'Dispatch for signout element was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchSignoutAction.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for signout element to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutAction.args[0]?.[0]
      )}`
    );
  });
  it('should not signout an element in case of a generic error', async () => {
    // arrange
    mockAskingForChangeControlValue(signoutChangeControlValue);
    const genericError = new Error('Error');
    const signOutElementStub = mockSignOutElement(
      service,
      element
    )([
      {
        signoutArg: {
          signoutChangeControlValue,
        },
        result: genericError,
      },
    ]);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.SIGN_OUT_ELEMENT,
        dispatchSignoutAction,
        {
          type: 'TYP',
          name: 'ELM',
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    const [generalFunctionStub] = signOutElementStub;
    assert.ok(generalFunctionStub.calledOnce, 'Signout element was not called');
    assert.ok(
      dispatchSignoutAction.notCalled,
      'Dispatch for signout element was called'
    );
  });
  it('should signout an element with an override signout', async () => {
    // arrange
    mockAskingForChangeControlValue(signoutChangeControlValue);
    mockAskingForOverrideSignout([element.name])(true);
    const signOutErrorResult = new SignoutError('some error');
    Object.setPrototypeOf(signOutErrorResult, SignoutError.prototype);
    const signOutElementStub = mockSignOutElement(
      service,
      element
    )([
      {
        signoutArg: {
          signoutChangeControlValue,
        },
        result: signOutErrorResult,
      },
      {
        signoutArg: {
          signoutChangeControlValue,
          overrideSignOut: true,
        },
        result: undefined,
      },
    ]);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.SIGN_OUT_ELEMENT,
        dispatchSignoutAction,
        {
          type: 'TYP',
          name: 'ELM',
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    const [generalFunctionStub] = signOutElementStub;
    assert.ok(
      generalFunctionStub.calledTwice,
      'Signout element was not called twice'
    );
    assert.ok(
      dispatchSignoutAction.called,
      'Dispatch for signout element was not called'
    );
    const expectedSignoutAction = {
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      dispatchSignoutAction.args[0]?.[0],
      expectedSignoutAction,
      `Expected dispatch for signout element to have been called with ${JSON.stringify(
        expectedSignoutAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignoutAction.args[0]?.[0]
      )}`
    );
  });
  it('should not signout an element after the cancellation of an override signout', async () => {
    // arrange
    mockAskingForChangeControlValue(signoutChangeControlValue);
    mockAskingForOverrideSignout([element.name])(false);
    const signOutErrorResult = new SignoutError('some error');
    Object.setPrototypeOf(signOutErrorResult, SignoutError.prototype);
    const signOutElementStub = mockSignOutElement(
      service,
      element
    )([
      {
        signoutArg: {
          signoutChangeControlValue,
        },
        result: signOutErrorResult,
      },
    ]);
    const dispatchSignoutAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.SIGN_OUT_ELEMENT,
        dispatchSignoutAction,
        {
          type: 'TYP',
          name: 'ELM',
          uri: elementUri,
        }
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    const [generalFunctionStub] = signOutElementStub;
    assert.ok(generalFunctionStub.calledOnce, 'Signout element was not called');
    assert.ok(
      dispatchSignoutAction.notCalled,
      'Dispatch for signout element was called'
    );
  });
});
