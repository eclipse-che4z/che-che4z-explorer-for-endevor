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
import { Id } from '../../store/storage/_doc/Storage';
import {
  getEditFolderUri,
  getElementExtension,
  parseFilePath,
  updateEditFoldersWhenContext,
} from '../../utils';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import { getFileExtensionResolution } from '../../settings/settings';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { showFileContent } from '@local/vscode-wrapper/window';

export const saveIntoEditFolder =
  (tempEditFolderUri: vscode.Uri) =>
  (serviceId: Id, searchLocationId: Id) =>
  async (
    element: Element,
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    const editFolderUri = getEditFolderUri(tempEditFolderUri)(
      serviceId,
      searchLocationId
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
        selectFileParams(element),
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
  try {
    await showFileContent(fileUri);
  } catch (e) {
    return new Error(
      `Unable to open the file ${fileUri.fsPath} because of error ${e.message}`
    );
  }
};

const selectFileParams = (
  element: Element
): {
  fileName: string;
  fileExtension?: string;
} => {
  const fileExtResolution = getFileExtensionResolution();
  switch (fileExtResolution) {
    case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
      return {
        fileName: element.name,
        fileExtension: getElementExtension(element),
      };
    case FileExtensionResolutions.FROM_TYPE_EXT:
      return {
        fileName: element.name,
        fileExtension: element.extension,
      };
    case FileExtensionResolutions.FROM_NAME: {
      const { fileName, fileExtension } = parseFilePath(element.name);
      return {
        fileName,
        fileExtension,
      };
    }
    default:
      throw new UnreachableCaseError(fileExtResolution);
  }
};
