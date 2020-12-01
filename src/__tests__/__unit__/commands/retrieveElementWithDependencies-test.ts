/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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

import * as vscode from 'vscode';

import { QueryACMComponents } from '@broadcom/endevor-for-zowe-cli';
import { retrieveWithDependencies } from '../../../commands/RetrieveElementWithDependencies';
import { logger } from '../../../globals';
import { Element } from '../../../entities/Element';
import { IEndevorQualifier } from '../../../interface/IEndevorQualifier';
import { Repository } from '../../../entities/Repository';
import { RetrieveElementService } from '../../../service/RetrieveElementService';
import { EndevorElementNode, EndevorNode } from '../../../ui/tree/EndevorNodes';
import { IElementDependencies } from '../../../interface/IElementDependencies';

// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('Test function retrieveWithDependencies (retrieve element with dependencies)', () => {
  // Mock the workspace folder so it is selected/unselected, as needed
  const mockWorkspaceFolders = ['testFolder'];
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: mockWorkspaceFolders,
  });

  // Mock vscode's progress function
  const mockWithProgress = jest.fn();
  Object.defineProperty(vscode, 'ProgressLocation', {
    value: { Notification: 15 },
  });
  Object.defineProperty(vscode.window, 'withProgress', {
    value: mockWithProgress,
  });

  // Mock the elements, nodes, and repo
  const mockRetrieveElement = jest.fn();
  const mockQueryACMComponents = jest.fn();
  const testRetrieveEltService: RetrieveElementService = new RetrieveElementService();
  Object.defineProperty(testRetrieveEltService, 'retrieveElement', {
    value: mockRetrieveElement,
  });
  Object.defineProperty(QueryACMComponents, 'queryACMComponents', {
    value: mockQueryACMComponents,
  });
  const testRepo = new Repository(
    'testRepo',
    'https://example.com:1234',
    'testUser',
    'testPass',
    'testRepo',
    'testConnLabel'
  );
  const qualifier1: IEndevorQualifier = {
    element: 'elmTest1',
    env: 'envTest',
    stage: '1',
    subsystem: 'sbsTest',
    system: 'sysTest',
    type: 'COBOL',
  };
  const qualifier2: IEndevorQualifier = {
    element: 'elmTest2',
    env: 'envTest',
    stage: '1',
    subsystem: 'sbsTest',
    system: 'sysTest',
    type: 'COBOL',
  };
  const testElements: Element[] = [
    new Element(testRepo, qualifier1),
    new Element(testRepo, qualifier2),
  ];
  const testEndevorElementNodes: EndevorNode[] = [
    new EndevorElementNode(testElements[0], qualifier1),
    new EndevorElementNode(testElements[1], qualifier2),
  ];
  const testDependencies: IElementDependencies[] = [
    {
      elmName: 'depTest1',
      envName: 'envTest',
      sysName: 'sysTest',
      sbsName: 'sbsTest',
      stgNumber: '1',
      typeName: 'COBOL',
      components: [testElements[0]],
    },
  ];

  // All spies are listed here
  const openDocumentSpy = jest.spyOn(vscode.workspace, 'openTextDocument');
  const retrieveElementErrorSpy = jest.spyOn(
    testRetrieveEltService,
    'processRetrieveElementError'
  );
  const loggerErrorSpy = jest.spyOn(logger, 'error');

  beforeEach(() => {
    // Redefine mocks, because we clear them after each run
    mockWithProgress.mockImplementation(async (progLocation, callback) => {
      const ProgressLocation = {
        Notification: 15,
        report: jest.fn(),
      };
      return await callback(ProgressLocation);
    });

    testDependencies[0].components = [testElements[0]];
    mockRetrieveElement.mockReturnValue('test/elt/path');
    mockQueryACMComponents.mockReturnValue({ data: testDependencies });
  });

  afterEach(() => {
    // This is here to clear the spies
    jest.clearAllMocks();
  });

  test("Should preview an element's single dependency in the text editor (happy path)", async () => {
    await retrieveWithDependencies(
      testEndevorElementNodes[0],
      testRetrieveEltService
    );

    expect(openDocumentSpy).toBeCalledWith('test/elt/path');
  });

  test('Should cancel dependency download, when there are many dependencies and user decides to cancel', async () => {
    // Create a giant array of dependencies
    for (let i = 0; i < 21; ++i) {
      testDependencies[0].components.push(testElements[0]);
    }

    // Mock vscode's warning function
    const mockShowWarningMessage = jest.fn();
    mockShowWarningMessage.mockResolvedValue('Cancel');
    Object.defineProperty(vscode.window, 'showWarningMessage', {
      value: mockShowWarningMessage,
    });

    await retrieveWithDependencies(
      testEndevorElementNodes[0],
      testRetrieveEltService
    );

    expect(openDocumentSpy).toBeCalledTimes(0);
  });

  test('Should retrieve dependencies of passed arg, if no element is fetched by retrieveElementService', async () => {
    mockQueryACMComponents.mockReturnValueOnce({ data: [] });

    await retrieveWithDependencies(
      testEndevorElementNodes[0],
      testRetrieveEltService
    );

    expect(openDocumentSpy).toBeCalledWith('test/elt/path');
  });

  test('Should throw an error, if element cannot be retrieved from Endevor', async () => {
    mockRetrieveElement.mockRejectedValueOnce('test error!');

    await retrieveWithDependencies(
      testEndevorElementNodes[0],
      testRetrieveEltService
    );

    expect(retrieveElementErrorSpy).toBeCalledWith('test error!');
  });

  test('Should throw an error, if no folder is open in the workspace', async () => {
    mockWorkspaceFolders.pop();

    await retrieveWithDependencies(
      testEndevorElementNodes[0],
      testRetrieveEltService
    );

    expect(loggerErrorSpy).toBeCalledWith(
      'Specify workspace before retrieving elements'
    );
  });
});
