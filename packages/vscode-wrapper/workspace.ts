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

import { TextEncoder } from 'util';
import * as vscode from 'vscode';
import * as path from 'path';
import { showFileContent } from './window';
import { WorkspaceFile } from './_doc/workspace';

export const getWorkspaceUri = async (): Promise<vscode.Uri | undefined> => {
  const openedWorkspaces = vscode.workspace.workspaceFolders;
  if (!openedWorkspaces) {
    const noOpenedWorkspace = undefined;
    return noOpenedWorkspace;
  }
  const [openedWorkspace] = openedWorkspaces;
  return openedWorkspace?.uri;
};

export const chooseFileUriFromFs = async (): Promise<
  vscode.Uri | undefined
> => {
  const fileContents = await vscode.window.showOpenDialog({
    canSelectMany: false,
  });
  if (fileContents && fileContents[0]) {
    return fileContents[0];
  } else {
    return undefined;
  }
};

// don't forget to validate promise.reject
export const createNewWorkspaceDirectory =
  (workspaceUri: vscode.Uri) =>
  async (workspaceDirectoryPath: string): Promise<vscode.Uri> => {
    const folderUri = toFolderUri(workspaceUri)(workspaceDirectoryPath);
    return await createDirectory(folderUri);
  };

export const createDirectory = async (
  folderUri: vscode.Uri
): Promise<vscode.Uri> => {
  await vscode.workspace.fs.createDirectory(folderUri);
  return folderUri;
};

// don't forget to validate promise.reject
export const saveFileIntoWorkspace =
  (workspaceUri: vscode.Uri) =>
  async (
    fileToSave: WorkspaceFile,
    fileContent: string
  ): Promise<vscode.Uri> => {
    const fileUri = toFileUri(workspaceUri)(fileToSave);
    await vscode.workspace.fs.writeFile(
      fileUri,
      new TextEncoder().encode(fileContent)
    );
    return fileUri;
  };

const toFileUri =
  (workspaceUri: vscode.Uri) =>
  (file: WorkspaceFile): vscode.Uri => {
    const workspaceFolderUri = toFolderUri(workspaceUri)(
      file.workspaceDirectoryPath
    );
    return toFileInWorkspaceFolderUri(workspaceFolderUri)(file);
  };

const toFolderUri =
  (workspaceUri: vscode.Uri) =>
  (workspaceDirectoryPath: string): vscode.Uri => {
    return vscode.Uri.file(
      path.join(workspaceUri.fsPath, workspaceDirectoryPath)
    );
  };

const toFileInWorkspaceFolderUri =
  (folderUri: vscode.Uri) =>
  (file: { fileName: string; fileExtension?: string }): vscode.Uri => {
    const { fsPath } = folderUri;
    if (file.fileExtension) {
      return vscode.Uri.file(
        path.join(fsPath, `${file.fileName}.${file.fileExtension}`)
      );
    } else {
      return vscode.Uri.file(path.join(fsPath, file.fileName));
    }
  };

// don't forget to validate promise.reject
export const saveFileIntoWorkspaceFolder =
  (folderUri: vscode.Uri) =>
  async (
    fileToSave: {
      fileName: string;
      fileExtension?: string;
    },
    fileContent: string
  ): Promise<vscode.Uri> => {
    const fileUri = toFileInWorkspaceFolderUri(folderUri)(fileToSave);
    await vscode.workspace.fs.writeFile(
      fileUri,
      new TextEncoder().encode(fileContent)
    );
    return fileUri;
  };

// don't forget to validate promise.reject
export const showWorkspaceFileContent =
  (workspaceUri: vscode.Uri) =>
  async (file: WorkspaceFile): Promise<void> => {
    const fileUri = toFileUri(workspaceUri)(file);
    await showFileContent(fileUri);
  };

// don't forget to validate promise.reject
export const deleteFile = async (fileUri: vscode.Uri): Promise<void> => {
  return vscode.workspace.fs.delete(fileUri, { useTrash: true });
};

// don't forget to validate promise.reject
export const deleteDirectoryWithContent = async (
  directoryUri: vscode.Uri
): Promise<void> => {
  return vscode.workspace.fs.delete(directoryUri, {
    useTrash: true,
    recursive: true,
  });
};

// don't forget to validate promise.reject
export const getFileContent = async (
  fileUri: vscode.Uri
): Promise<Uint8Array> => {
  return await vscode.workspace.fs.readFile(fileUri);
};
