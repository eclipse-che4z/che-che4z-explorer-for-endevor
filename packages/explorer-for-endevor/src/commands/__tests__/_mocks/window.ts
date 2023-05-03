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

import * as sinon from 'sinon';
import { TextDocument, TextEditor, Uri } from 'vscode';
import * as window from '@local/vscode-wrapper/window';

export type ShowingDocumentStub = sinon.SinonStub<
  [document: TextDocument],
  Promise<void>
>;
export const mockShowingDocumentWith =
  (documentArg?: TextDocument) =>
  (mockResult: Promise<void>): ShowingDocumentStub => {
    const anyDocument = sinon.match.any;
    return sinon
      .stub(window, 'showDocument')
      .withArgs(documentArg ?? anyDocument)
      .returns(mockResult);
  };

export type GettingActiveEditorStub = sinon.SinonStub<
  [],
  TextEditor | undefined
>;
export const mockGettingActiveEditorWith = (mockResult: TextEditor) => {
  return sinon.stub(window, 'getActiveTextEditor').returns(mockResult);
};

export type GettingAllOpenedEditorsStub = sinon.SinonStub<
  [],
  ReadonlyArray<TextEditor>
>;
export const mockGettingAllOpenedEditorsWith = (
  mockResult: ReadonlyArray<TextEditor>
): GettingAllOpenedEditorsStub => {
  return sinon.stub(window, 'getAllOpenedTextEditors').returns(mockResult);
};

export type ClosingActiveEditorStub = sinon.SinonStub<[], Promise<void>>;
export const mockClosingActiveEditorWith = (
  mockResult: Promise<void>
): ClosingActiveEditorStub => {
  return sinon.stub(window, 'closeActiveTextEditor').returns(mockResult);
};

export type ShowingFileContentStub = sinon.SinonStub<
  [fileUri: Uri, title?: string],
  Promise<void>
>;
export const mockShowingFileContentWith =
  (fileUriArg?: Uri) =>
  (mockResult: Promise<void>): ShowingFileContentStub => {
    const anyUri = sinon.match.any;
    return sinon
      .stub(window, 'showFileContent')
      .withArgs(fileUriArg ?? anyUri)
      .returns(mockResult);
  };
