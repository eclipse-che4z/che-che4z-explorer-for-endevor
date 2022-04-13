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

import { Element } from '@local/endevor/_doc/Endevor';
import {
  createDirectory,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import * as vscode from 'vscode';
import { getTempEditFolder } from '../../settings/settings';
import {
  getEditFolderUri,
  isError,
  updateEditFoldersWhenContext,
} from '../../utils';
import { showSavedElementContent } from '../../workspace';

export const saveIntoEditFolder =
  (workspaceUri: vscode.Uri) =>
  (serviceName: string, locationName: string) =>
  async (
    element: Element,
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    let editFolder: string;
    try {
      editFolder = getTempEditFolder();
    } catch (error) {
      return new Error(
        `Unable to get the edit path from the settings because of error ${error.message}`
      );
    }
    const editFolderUri = getEditFolderUri(workspaceUri)(editFolder)(
      serviceName,
      locationName
    )(element);
    let saveLocationUri;
    try {
      saveLocationUri = await createDirectory(editFolderUri);
    } catch (error) {
      return new Error(
        `Unable to create a required temp directory ${editFolderUri.fsPath} for editing the elements because of error ${error.message}`
      );
    }
    try {
      const saveResult = await saveFileIntoWorkspaceFolder(saveLocationUri)(
        {
          fileName: element.name,
          fileExtension: element.extension,
        },
        elementContent
      );
      // update edit folders context variable to make sure all edited element paths are known
      updateEditFoldersWhenContext(saveLocationUri.fsPath);
      return saveResult;
    } catch (error) {
      return new Error(
        `Unable to save the element ${element.name} into the file system because of error ${error.message}`
      );
    }
  };

export const showElementToEdit = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  const showResult = await showSavedElementContent(fileUri);
  if (isError(showResult)) {
    const error = showResult;
    return new Error(
      `Unable to open the element ${fileUri.fsPath} because of error ${error.message}`
    );
  }
};
