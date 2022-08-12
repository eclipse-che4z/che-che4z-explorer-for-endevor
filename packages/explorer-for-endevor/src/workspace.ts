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

import {
  createNewWorkspaceDirectory,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { Progress, ProgressLocation, Uri, window } from 'vscode';
import * as path from 'path';
import { showFileContent } from '@local/vscode-wrapper/window';
import { Element } from '@local/endevor/_doc/Endevor';
import { FileExtensionResolutions } from './settings/_doc/v2/Settings';
import { getElementExtension, parseFilePath } from './utils';
import { getFileExtensionResoluton } from './settings/settings';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';

export const saveElementIntoWorkspace =
  (workspaceUri: Uri) =>
  (serviceName: string, locationName: string) =>
  async (element: Element, elementContent: string): Promise<Uri | Error> => {
    try {
      const file = toFileDescription(element)(serviceName, locationName);
      const elementDir = file.workspaceDirectoryPath;
      const directoryToSave = await createNewWorkspaceDirectory(workspaceUri)(
        elementDir
      );
      return await saveFileIntoWorkspaceFolder(directoryToSave)(
        file,
        elementContent
      );
    } catch (e) {
      return e;
    }
  };

const toFileDescription =
  (element: Element) => (serviceName: string, locationName: string) => {
    const elementDir = path.join(
      `/`,
      serviceName,
      locationName,
      element.system,
      element.subSystem,
      element.type
    );
    const fileExtResolution = getFileExtensionResoluton();
    switch (fileExtResolution) {
      case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
        return {
          fileName: element.name,
          fileExtension: getElementExtension(element),
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_TYPE_EXT:
        return {
          fileName: element.name,
          fileExtension: element.extension,
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_NAME: {
        const { fileName, fileExtension } = parseFilePath(element.name);
        return {
          fileName,
          fileExtension,
          workspaceDirectoryPath: elementDir,
        };
      }
      default:
        throw new UnreachableCaseError(fileExtResolution);
    }
  };

export const showSavedElementContent = async (
  fileUri: Uri
): Promise<void | Error> => {
  try {
    await showFileContent(fileUri);
  } catch (e) {
    return e;
  }
};

export type ProgressReport = {
  message?: string;
  increment?: number;
};

type ProgressFunction<T> = (
  progress: Progress<ProgressReport>
) => (...args: Array<T>) => Promise<void>;

/**
 * @deprecated - use vscode-wrapper/window/withNotificationProgress function instead.
 * Calls a function and measures its progress.
 * @param progressFunction - An async function which returns nothing
 * @param functionArgs - An array of arrays. Each array contains the arguments for one call to progressFunction.
 */
export const withProgress = async <T>(
  progressFunction: ProgressFunction<T>,
  functionArgs: Array<T>[]
): Promise<void> => {
  return await window.withProgress(
    {
      location: ProgressLocation.Notification,
      cancellable: true,
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        // will be returned as undefined
        window.showInformationMessage('Retrieval was cancelled.');
      });
      for (const [index, argObject] of functionArgs.entries()) {
        if (token.isCancellationRequested) {
          return;
        }
        const increment =
          index === 0 ? 0 : Math.floor((1 / functionArgs.length) * 100);
        const currProgress = {
          message: `Loading: ${index + 1} of ${functionArgs.length} elements`,
          increment,
        };
        progress.report(currProgress);
        await progressFunction(progress)(...argObject);
      }
    }
  );
};
