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

import {
  Service,
  ElementSearchLocation,
  Element,
} from '@local/endevor/_doc/Endevor';
import {
  createDirectory,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import * as vscode from 'vscode';
import { logger } from '../../globals';
import { getTempEditFolder } from '../../settings/settings';
import { toEditedElementUri } from '../../uri/editedElementUri';
import {
  getEditFolderUri,
  isError,
  updateEditFoldersWhenContext,
} from '../../utils';
import { showSavedElementContent } from '../../workspace';
import { ElementLocationName, EndevorServiceName } from '../../_doc/settings';

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
      logger.trace(`Error when reading settings: ${error}`);
      return new Error('Unable to get edit path from settings');
    }
    const editFolderUri = getEditFolderUri(workspaceUri)(editFolder)(
      serviceName,
      locationName
    )(element);
    let saveLocationUri;
    try {
      saveLocationUri = await createDirectory(editFolderUri);
    } catch (e) {
      logger.trace(`Error while creating a temp directory: ${e.message}`);
      return new Error(
        `Unable to create required temp directory: ${editFolderUri.fsPath} for editing elements`
      );
    }
    const saveResult = await saveFileIntoWorkspaceFolder(saveLocationUri)(
      {
        fileName: element.name,
        fileExtension: element.extension,
      },
      elementContent
    );
    if (isError(saveResult)) {
      const error = saveResult;
      logger.trace(`Element: ${element.name} persisting error: ${error}`);
      const userMessage = `Element: ${element.name} was not saved into file system`;
      return new Error(userMessage);
    }
    // update edit folders context variable to make sure all edited element paths are known
    updateEditFoldersWhenContext(saveLocationUri.fsPath);
    return saveResult;
  };

// TODO: needs to be refactored, we ruin our URI abstraction here,
// because now, we know, where the location and etc stored
export const withUploadOptions =
  (fileUri: vscode.Uri) =>
  (uploadOptions: {
    serviceName: EndevorServiceName;
    service: Service;
    element: Element;
    searchLocation: ElementSearchLocation;
    searchLocationName: ElementLocationName;
    fingerprint: string;
  }): vscode.Uri | undefined => {
    const elementUri = toEditedElementUri(fileUri.fsPath)({
      serviceName: uploadOptions.serviceName,
      service: uploadOptions.service,
      element: uploadOptions.element,
      searchLocation: uploadOptions.searchLocation,
      searchLocationName: uploadOptions.searchLocationName,
      fingerprint: uploadOptions.fingerprint,
    });
    if (!isError(elementUri)) {
      return fileUri.with({
        query: elementUri.query,
      });
    } else {
      logger.error(
        `Element ${uploadOptions.element.name} cannot be opened for editing. See log for more details.`,
        `Opening element ${uploadOptions.element.name} failed with error: ${elementUri.message}`
      );
      return;
    }
  };

export const showElementToEdit = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  const showResult = await showSavedElementContent(fileUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.trace(
      `Element ${fileUri.fsPath} cannot be opened because of: ${error}.`
    );
    return new Error(`Element ${fileUri.fsPath} cannot be opened.`);
  }
};
