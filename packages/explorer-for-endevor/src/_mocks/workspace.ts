/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import * as vscode from 'vscode';
import * as workspace from '@local/vscode-wrapper/workspace';

export type DeletingFileStub = sinon.SinonStub<
  [fileUri: vscode.Uri],
  Promise<void>
>;
type FileUriArg = vscode.Uri;
type DeletionResult = Promise<void>;
export const mockDeletingFileWith = (
  stubCalls: ReadonlyArray<[FileUriArg, DeletionResult]>
): DeletingFileStub => {
  const stub = sinon.stub(workspace, 'deleteFile');
  stubCalls.forEach(([fileUriArg, mockResult]) => {
    stub.withArgs(fileUriArg).returns(mockResult);
  });
  return stub;
};

export type GettingFileContentStub = sinon.SinonStub<
  [fileUri: vscode.Uri],
  Promise<Uint8Array>
>;
export const mockGettingFileContentWith =
  (fileUriArg: vscode.Uri) =>
  (mockResult: Promise<Uint8Array>): GettingFileContentStub => {
    return sinon
      .stub(workspace, 'getFileContent')
      .withArgs(fileUriArg)
      .returns(mockResult);
  };
