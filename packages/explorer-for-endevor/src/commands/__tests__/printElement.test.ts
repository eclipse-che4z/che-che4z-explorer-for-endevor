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
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { printElement } from '../element/printElement';
import { Schemas } from '../../_doc/Uri';
import { elementContentProvider } from '../../view/elementContentProvider';
import { mockPrintingElementWith } from './_mocks/endevor';
import { mockShowingDocumentWith } from './_mocks/window';
import * as sinon from 'sinon';
import {
  EndevorConnectionStatus,
  EndevorCredential,
  EndevorCredentialStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { ElementSearchLocation } from '../../_doc/Endevor';

describe('printing element content', () => {
  before(() => {
    vscode.commands.registerCommand(CommandId.PRINT_ELEMENT, printElement);
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  // arrange
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
  vscode.workspace.registerTextDocumentContentProvider(
    Schemas.TREE_ELEMENT,
    elementContentProvider({
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
    })
  );

  it('should show fetched element content', async () => {
    const expectedElementContent = 'Show me this Endevor!';

    const printElementStub = mockPrintingElementWith(
      service,
      configuration,
      element
    )({
      status: ResponseStatus.OK,
      details: {
        messages: [],
        returnCode: 0,
      },
      result: expectedElementContent,
    });
    const success = Promise.resolve();
    const showElementContentStub = mockShowingDocumentWith()(success);
    // act
    try {
      await vscode.commands.executeCommand(CommandId.PRINT_ELEMENT, {
        name: element.name,
        element,
        serviceId,
        searchLocationId,
        noSource: element.noSource,
      });
    } catch (e) {
      assert.fail(
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    const [
      generalPrintFunctionStub,
      printWithServiceStub,
      _,
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
