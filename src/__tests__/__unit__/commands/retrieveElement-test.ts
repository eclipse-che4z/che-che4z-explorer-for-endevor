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

import { retrieveElement } from '../../../commands/RetrieveElement';
import { logger } from '../../../globals';
import { Element } from '../../../entities/Element';
import { IEndevorQualifier } from '../../../interface/IEndevorQualifier';
import { Repository } from '../../../entities/Repository';
import { RetrieveElementService } from '../../../service/RetrieveElementService';
import { EndevorElementNode, EndevorNode } from '../../../ui/tree/EndevorNodes';
import { IElement } from '../../../interface/entities';

// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('Test function retrieveElement', () => {
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
  const testRetrieveEltService: RetrieveElementService = new RetrieveElementService();
  Object.defineProperty(testRetrieveEltService, 'retrieveElement', {
    value: mockRetrieveElement,
  });
  const testRepo = new Repository(
    'testRepo',
    'https://example.com:1234',
    'testUser',
    'testPass',
    'testRepo',
    'testConnLabel'
  );
  const testIElements: IElement[] = [
    {
      elmName: 'elmTest1',
      fullElmName: 'elmTest1',
      elmVVLL: '1100',
      envName: 'envTest',
      sysName: 'sysTest',
      sbsName: 'sbsTest',
      stgNum: '1',
      typeName: 'COBOL',
      repository: testRepo,
      getName: () => {
        return 'elmTest1';
      },
      getDescription: () => {
        return 'testDescription';
      },
      getElmName: () => {
        return 'elmTest1';
      },
      getElmVVLL: () => {
        return '1100';
      },
      getRepository: () => {
        return testRepo;
      },
      getQualifier: () => {
        return qualifier1;
      },
    },
    {
      elmName: 'elmTest2',
      fullElmName: 'elmTest2',
      elmVVLL: '1100',
      envName: 'envTest',
      sysName: 'sysTest',
      sbsName: 'sbsTest',
      stgNum: '1',
      typeName: 'COBOL',
      repository: testRepo,
      getName: () => {
        return 'elmTest1';
      },
      getDescription: () => {
        return 'testDescription';
      },
      getElmName: () => {
        return 'elmTest1';
      },
      getElmVVLL: () => {
        return '1100';
      },
      getRepository: () => {
        return testRepo;
      },
      getQualifier: () => {
        return qualifier2;
      },
    },
  ];
  const testElements: Element[] = [
    new Element(testRepo, testIElements[0]),
    new Element(testRepo, testIElements[1]),
  ];
  const qualifier1: IEndevorQualifier = {
    element: testElements[0].elmName,
    env: 'envTest',
    stage: '1',
    subsystem: 'sbsTest',
    system: 'sysTest',
    type: 'COBOL',
  };
  const qualifier2: IEndevorQualifier = {
    element: testElements[1].elmName,
    env: 'envTest',
    stage: '1',
    subsystem: 'sbsTest',
    system: 'sysTest',
    type: 'COBOL',
  };
  const testEndevorElementNodes: EndevorNode[] = [
    new EndevorElementNode(testElements[0], qualifier1),
    new EndevorElementNode(testElements[1], qualifier2),
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

    mockRetrieveElement.mockReturnValue('test/elt/path');
  });

  afterEach(() => {
    // This is here to clear the spies
    jest.clearAllMocks();
  });

  test('Should preview one element in the text editor, if passed in as arg', async () => {
    await retrieveElement(
      testEndevorElementNodes[0],
      [],
      testRetrieveEltService
    );

    expect(openDocumentSpy).toBeCalledWith('test/elt/path');
  });

  test('Should preview many elements in the text editor, if passed in as array', async () => {
    mockRetrieveElement.mockReturnValueOnce('test/elt/path/first');

    await retrieveElement(
      null,
      testEndevorElementNodes,
      testRetrieveEltService
    );

    expect(openDocumentSpy).toBeCalledTimes(2);
    expect(openDocumentSpy.mock.calls[0]).toEqual(['test/elt/path/first']);
    expect(openDocumentSpy.mock.calls[1]).toEqual(['test/elt/path']);
  });

  test('Should throw an error, if element cannot be retrieved from Endevor', async () => {
    mockRetrieveElement.mockRejectedValueOnce('test error!');

    await retrieveElement(
      testEndevorElementNodes[0],
      [],
      testRetrieveEltService
    );

    expect(retrieveElementErrorSpy).toBeCalledWith('test error!');
  });

  test('Should throw an error, if no folder is open in the workspace', async () => {
    mockWorkspaceFolders.pop();

    await retrieveElement(
      testEndevorElementNodes[0],
      [],
      testRetrieveEltService
    );

    expect(loggerErrorSpy).toBeCalledWith(
      'Specify workspace before retrieving elements'
    );
  });
});
