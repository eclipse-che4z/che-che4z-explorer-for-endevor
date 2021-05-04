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

import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { deleteFile, getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import { commands, Uri } from 'vscode';
import {
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation,
  dialogCancelled as uploadLocationDialogCancelled,
} from '../dialogs/locations/endevorUploadLocationDialogs';
import { updateElement } from '../endevor';
import { logger } from '../globals';
import { getTempEditFolder } from '../settings/settings';
import { fromVirtualDocUri } from '../uri';
import {
  fromEditFileName,
  getEditFolderUri,
  isError,
  splitIntoPathAndFileName,
} from '../utils';
import { ANY_VALUE } from '@local/endevor/const';
import { withNotificationProgress } from '@local/vscode-wrapper/window';

export const uploadElementCommand = (elementUri: Uri) => async (
  content: string
): Promise<void> => {
  logger.trace(
    `Upload element command was called for: ${stringifyWithHiddenCredential({
      query: JSON.parse(elementUri.query),
      path: elementUri.fsPath,
    })}`
  );
  const workspace = await getWorkspaceUri();
  if (!workspace) return undefined;
  let editFolder;
  try {
    editFolder = getTempEditFolder();
  } catch (e) {
    logger.error(
      'Unable to get edit folder from settings.',
      `Error when reading settings: ${e}.`
    );
    return undefined;
  }
  const { fsPath: editFolderPath } = getEditFolderUri(workspace)(editFolder);
  const { path, fileName } = splitIntoPathAndFileName(elementUri.fsPath);
  if (isEditedElement(editFolderPath)(path)) {
    const editFileParams = fromEditFileName(fileName);
    if (!editFileParams) {
      logger.error(
        `Edited file: ${fileName} become inconsistent.`,
        `File with wrong name pattern: ${fileName} was saved into edited folder: ${editFolder}.`
      );
      return undefined;
    }
    const uploadResult = await uploadElement(fromVirtualDocUri(elementUri))({
      fingerprint: editFileParams.fingerprint,
      content,
    });
    if (isError(uploadResult)) {
      const error = uploadResult;
      logger.error(error.message);
      return undefined;
    }
    await closeEditSession(elementUri);
  }
};

const isEditedElement = (editFolderPath: string) => (
  elementFolderPath: string
): boolean => {
  return editFolderPath === elementFolderPath;
};

type UploadOptions = Readonly<{
  service: Service;
  endevorSearchLocation: ElementSearchLocation;
  element: Element;
}>;

type ElementToUpload = Readonly<{
  content: string;
  fingerprint: string;
}>;

const uploadElement = ({
  service,
  element,
  endevorSearchLocation,
}: UploadOptions) => async ({
  content,
  fingerprint,
}: ElementToUpload): Promise<void | Error> => {
  const uploadType =
    endevorSearchLocation.type && endevorSearchLocation.type !== ANY_VALUE
      ? endevorSearchLocation.type
      : element.type;
  const uploadLocation = await askForUploadLocation({
    environment: endevorSearchLocation.environment,
    stageNumber: endevorSearchLocation.stageNumber,
    system: endevorSearchLocation.system,
    subsystem: endevorSearchLocation.subsystem,
    type: uploadType,
    element: element.name,
    instance: element.instance,
  });
  if (uploadLocationDialogCancelled(uploadLocation)) {
    return new Error('Upload location must be specified to upload element.');
  }
  const changeControlValue = await askForChangeControlValue({
    ccid: endevorSearchLocation.ccid,
    comment: endevorSearchLocation.comment,
  });
  if (changeControlDialogCancelled(changeControlValue)) {
    return new Error('CCID and Comment must be specified to upload element.');
  }
  const updateResult = await withNotificationProgress(
    `Uploading element: ${element.name}`
  )((progressReporter) => {
    return updateElement(progressReporter)(service)({
      instance: element.instance,
      environment: uploadLocation.environment,
      stageNumber: uploadLocation.stageNumber,
      system: uploadLocation.system,
      subSystem: uploadLocation.subSystem,
      type: uploadLocation.type,
      name: uploadLocation.name,
    })({
      comment: changeControlValue.comment,
      ccid: changeControlValue.ccid,
    })({
      fingerprint,
      content,
    });
  });
  if (isError(updateResult)) {
    const error = updateResult;
    return error;
  }
  logger.info('Update successful!');
};

const closeEditSession = async (elementUri: Uri) => {
  await commands.executeCommand('workbench.action.closeActiveEditor');
  try {
    await deleteFile(elementUri);
  } catch (e) {
    logger.error(
      `Edited file: ${elementUri.fsPath} was not deleted correctly.`,
      `Edited file: ${elementUri.fsPath} was not deleted because of: ${e}.`
    );
  }
};
