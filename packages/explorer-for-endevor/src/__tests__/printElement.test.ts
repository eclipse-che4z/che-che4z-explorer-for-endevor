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
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { printElement } from '../commands/printElement';
import { Schemas } from '../_doc/Uri';
import { elementContentProvider } from '../view/elementContentProvider';
import { mockPrintingElementWith } from '../_mocks/endevor';
import { mockShowingDocumentWith } from '../_mocks/window';
import * as sinon from 'sinon';
import { UNIQUE_ELEMENT_FRAGMENT } from '../constants';

describe('printing element content', () => {
  before(() => {
    vscode.commands.registerCommand(CommandId.PRINT_ELEMENT, printElement);
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.TREE_ELEMENT,
      elementContentProvider
    );
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  it('should show fetched element content', async () => {
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
    const searchLocationName = 'searchLocationName';
    const searchLocation: ElementSearchLocation = {
      instance: 'ANY-INSTANCE',
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
    const expectedElementContent = 'Show me this Endevor!';
    const printElementStub = mockPrintingElementWith(
      service,
      element
    )(expectedElementContent);
    const success = Promise.resolve();
    const showElementContentStub = mockShowingDocumentWith()(success);
    // act
    try {
      await vscode.commands.executeCommand(CommandId.PRINT_ELEMENT, elementUri);
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    const [
      generalPrintFunctionStub,
      printWithServiceStub,
      printElementContentStub,
    ] = printElementStub;
    assert.ok(
      generalPrintFunctionStub.called,
      'Fetch element content was not called'
    );
    const actualService = printWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Fetch element content was not called with expected ${service}, it was called with ${actualService}`
    );
    const actualElement = printElementContentStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Fetch element content was not called with expected ${element}, it was called with ${actualElement}`
    );

    assert.ok(
      showElementContentStub.called,
      'Show element content was not called'
    );
    const showedDocument = showElementContentStub.args[0]?.[0];
    const actualShowedContent = showedDocument?.getText();
    assert.deepStrictEqual(
      actualShowedContent,
      expectedElementContent,
      `Show element content was not called with expected ${expectedElementContent}, it was called with ${actualShowedContent}`
    );
  });
});
