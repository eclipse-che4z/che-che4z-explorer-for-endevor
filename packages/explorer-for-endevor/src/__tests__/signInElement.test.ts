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
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { signInElementCommand } from '../commands/signInElement';
import { mockSignInElement } from '../_mocks/endevor';
import * as sinon from 'sinon';
import { toTreeElementUri } from '../uri/treeElementUri';
import { UNIQUE_ELEMENT_FRAGMENT } from '../constants';
import { Actions } from '../_doc/Actions';

describe('sign in element', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.SIGN_IN_ELEMENT,
      signInElementCommand
    );
  });

  afterEach(async () => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  it('should call sign in element properly', async () => {
    // arrange
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
    };
    const searchLocationName = 'searchLocationName';
    const searchLocation: ElementSearchLocation = {
      instance: 'ANY-INSTANCE',
      ccid: '',
      comment: '',
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
    const signInSuccessResult = undefined;
    const signInElementStub = mockSignInElement(
      service,
      element
    )(signInSuccessResult);
    const dispatchSignInAction = sinon.spy();
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.SIGN_IN_ELEMENT,
        dispatchSignInAction,
        {
          type: 'TYP',
          name: 'ELM',
          uri: elementUri,
        },
        undefined
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    const [generalFunctionStub, withServiceStub, withContentStub] =
      signInElementStub;
    assert.ok(generalFunctionStub.called, 'Signin element was not called');
    const actualService = withServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Signin element was not called with expected ${service}, it was called with ${actualService}`
    );
    const actualElement = withContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Signin element was not called with expected ${element}, it was called with ${actualElement}`
    );
    assert.deepStrictEqual(
      dispatchSignInAction.called,
      true,
      'Dispatch for signin element was not called'
    );
    const expextedSignInAction = {
      type: Actions.ELEMENT_SIGNED_IN,
      serviceName,
      searchLocationName,
      service,
      searchLocation,
      elements: [element],
    };
    assert.deepStrictEqual(
      expextedSignInAction,
      dispatchSignInAction.args[0]?.[0],
      `Expexted dispatch for signin element to have been called with ${JSON.stringify(
        expextedSignInAction
      )}, but it was called with ${JSON.stringify(
        dispatchSignInAction.args[0]?.[0]
      )}`
    );
  });
});
