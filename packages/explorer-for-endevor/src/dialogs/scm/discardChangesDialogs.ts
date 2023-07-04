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

import { showModalWithOptions } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';

const operationCancelled = <T>(value: T | undefined): value is undefined => {
  return value == undefined;
};

export const askForFileDeletion = async (
  fileName: string
): Promise<boolean> => {
  // TODO: Try to add more information for the file path here:
  logger.trace(`Prompt for the file '${fileName}' deletion.`);
  const dialogResult = await showModalWithOptions({
    message: `Do you want to delete '${fileName}?'`,
    detail:
      'Warning: this action cannot be undone. The File will be lost forever!',
    options: ['Delete'],
  });
  if (operationCancelled(dialogResult)) {
    // TODO: Try to add more information for the file path here:
    logger.trace(`Deletion of the '${fileName}' was cancelled.`);
    return false;
  }
  return true;
};

export const askForDiscardChanges = async (
  fileName: string
): Promise<boolean> => {
  // TODO: Try to add more information for the file path here:
  logger.trace(`Prompt for the file '${fileName}' discard changes.`);
  const dialogResult = await showModalWithOptions({
    message: `Do you want to discard all changes in the file '${fileName}?'`,
    options: ['Discard Changes'],
  });
  if (operationCancelled(dialogResult)) {
    // TODO: Try to add more information for the file path here:
    logger.trace(`Discard changes for the file '${fileName}' was cancelled.`);
    return false;
  }
  return true;
};

export const askForDiscardMultipleChanges = async (
  filesNumber: number
): Promise<boolean> => {
  logger.trace(`Prompt for discard the multiple file changes.`);
  const dialogResult = await showModalWithOptions({
    message: `Do you want to discard all the changes in ${filesNumber} files?`,
    options: ['Discard Changes'],
  });
  if (operationCancelled(dialogResult)) {
    logger.trace(`Discard multiple files changes was cancelled.`);
    return false;
  }
  return true;
};

export const askForFileRestoration = async (
  fileName: string
): Promise<boolean> => {
  // TODO: Try to add more information for the file path here:
  logger.trace(`Prompt for the file '${fileName}' restore.`);
  const dialogResult = await showModalWithOptions({
    message: `Do you want to restore the file '${fileName}?'`,
    options: ['Restore File'],
  });
  if (operationCancelled(dialogResult)) {
    // TODO: Try to add more information for the file path here:
    logger.trace(`Restore for the file '${fileName}' was cancelled.`);
    return false;
  }
  return true;
};
