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
import { browseElement } from '../../../commands/BrowseElement';
import { logger } from '../../../globals';

// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('browse command submission workflow', () => {
  // input stubs
  const mockUri: vscode.Uri = {
    scheme: '',
    authority: '',
    fsPath: '',
    path: '',
    query: '',
    fragment: '',
    with: jest.fn(),
    toJSON: jest.fn()
  };

  it('should submit browse element command to content provider', async () => {
    // given
    const anyValue: any = undefined;
    const mockEditor: vscode.TextEditor = {
        document: anyValue,
        selection: anyValue,
        selections: anyValue,
        visibleRanges: anyValue,
        options: anyValue,
        edit: anyValue,
        insertSnippet: anyValue,
        show: anyValue,
        hide: anyValue,
        revealRange: anyValue,
        setDecorations: anyValue
    };
    const showWindowFunction = jest.fn()
        .mockImplementation((_uri: vscode.Uri, _options?: vscode.TextDocumentShowOptions | undefined) => {
          return Promise.resolve(mockEditor);
    });
    jest.spyOn(logger, "info").mockImplementation((_message: string) => {
      // do nothing
    });
    vscode.window.showTextDocument = showWindowFunction;
    // when
    await browseElement(mockUri);
    // then
    const keepExistingEditorTabs = { preview: false };
    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockUri, keepExistingEditorTabs);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should show error message, if something went wrong with submission', async () => {
    const browseRejectReason = "something went really wrong, dude!";
    const showWindowFunction = jest.fn()
        .mockImplementation((_uri: vscode.Uri, _options?: vscode.TextDocumentShowOptions | undefined) => {
          return Promise.reject(browseRejectReason);
    });
    vscode.window.showTextDocument = showWindowFunction;
    jest.spyOn(logger, "error").mockImplementation((_message: string) => {
        // do nothing
    });
    // when
    await browseElement(mockUri);
    // then
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
