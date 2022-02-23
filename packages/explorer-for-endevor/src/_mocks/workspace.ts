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

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as workspace from '@local/vscode-wrapper/workspace';

export type CreationWorkspaceDirectoryStub = [
  sinon.SinonStub<
    [workspaceUri: vscode.Uri],
    (workspaceDirectoryPath: string) => Promise<vscode.Uri>
  >,
  sinon.SinonStub<[string], Promise<vscode.Uri>>
];

export const mockCreatingWorkspaceDirectory =
  (workspaceUriArg: vscode.Uri, directoryPathArg: string) =>
  (mockResult: vscode.Uri): CreationWorkspaceDirectoryStub => {
    const withDirectoryPathStub = sinon
      .stub<[string], Promise<vscode.Uri>>()
      .withArgs(directoryPathArg)
      .returns(Promise.resolve(mockResult));
    const generalFunctionStub = sinon
      .stub(workspace, 'createNewWorkspaceDirectory')
      .withArgs(workspaceUriArg)
      .returns(withDirectoryPathStub);
    return [generalFunctionStub, withDirectoryPathStub];
  };

export type CreationDirectoryStub = sinon.SinonStub<
  [folderUri: vscode.Uri],
  Promise<vscode.Uri>
>;

export const mockCreatingDirectory =
  (directoryUriArg?: vscode.Uri) =>
  (mockResult: vscode.Uri): CreationDirectoryStub => {
    return sinon
      .stub(workspace, 'createDirectory')
      .withArgs(directoryUriArg ?? sinon.match.any)
      .returns(Promise.resolve(mockResult));
  };

export type FileSavingIntoWorkspaceDirectoryStub = [
  sinon.SinonStub<
    [folderUri: vscode.Uri],
    (
      fileToSave: {
        fileName: string;
        fileExtension?: string | undefined;
      },
      fileContent: string
    ) => Promise<vscode.Uri>
  >,
  sinon.SinonStub<
    [
      fileToSave: {
        fileName: string;
        fileExtension?: string | undefined;
      },
      fileContent: string
    ],
    Promise<vscode.Uri>
  >
];

export const mockSavingFileIntoWorkspaceDirectory =
  (
    folderUriArg: vscode.Uri,
    fileArg: {
      content: string;
      name: string;
      extension?: string;
    }
  ) =>
  (mockResult: vscode.Uri): FileSavingIntoWorkspaceDirectoryStub => {
    const withFileStub = sinon
      .stub<
        [
          fileToSave: {
            fileName: string;
            fileExtension?: string;
          },
          fileContent: string
        ],
        Promise<vscode.Uri>
      >()
      .withArgs(
        {
          fileName: fileArg.name,
          fileExtension: fileArg.extension,
        },
        fileArg.content
      )
      .returns(Promise.resolve(mockResult));
    const generalFunctionStub = sinon
      .stub(workspace, 'saveFileIntoWorkspaceFolder')
      .withArgs(folderUriArg)
      .returns(withFileStub);
    return [generalFunctionStub, withFileStub];
  };

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

type vscodeUriArg = vscode.Uri;
type vscodeUriStub = sinon.SinonStub<[], Promise<vscode.Uri | undefined>>;

export const mockGettingWorkspaceUri = (
  mockResult: vscodeUriArg
): vscodeUriStub => {
  return sinon.stub(workspace, 'getWorkspaceUri').resolves(mockResult);
};
