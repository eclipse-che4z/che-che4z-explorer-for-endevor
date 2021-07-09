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
  ChangeControlValue,
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import {
  deleteFile,
  getFileContent,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { Uri } from 'vscode';
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
import { isError } from '../utils';
import { ANY_VALUE } from '@local/endevor/const';
import {
  closeActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromEditedElementUri } from '../uri/editedElementUri';
import {
  FingerprintMismatchError,
  UpdateError,
} from '@local/endevor/_doc/Error';
import { getTempEditFolderUri } from '../workspace';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { TextDecoder } from 'util';
import { ENCODING } from '../constants';

export const uploadElementCommand = async (elementUri: Uri): Promise<void> => {
  const uriParams = fromEditedElementUri(elementUri);
  if (!isError(uriParams)) {
    logger.trace(
      `Upload element command was called for: ${stringifyWithHiddenCredential({
        query: JSON.parse(elementUri.query),
        path: elementUri.fsPath,
      })}`
    );
    const uploadResult = await uploadElement(uriParams)(elementUri.fsPath);
    if (isError(uploadResult)) {
      const error = uploadResult;
      logger.error(error.message);
      return;
    }
    await closeEditSession(elementUri);
    logger.info('Update successful!');
  } else {
    const error = uriParams;
    logger.error(
      `Element cannot be uploaded to Endevor.`,
      `Element cannot be uploaded to Endevor. Parsing the element's URI failed with error: ${error.message}`
    );
    return;
  }
};

type UploadOptions = Readonly<{
  service: Service;
  searchLocation: ElementSearchLocation;
  element: Element;
  fingerprint: string;
}>;

const uploadElement =
  ({ service, element, searchLocation, fingerprint }: UploadOptions) =>
  async (elementTempFilePath: string): Promise<void | Error> => {
    let content: string;
    try {
      content = new TextDecoder(ENCODING).decode(
        await getFileContent(Uri.file(elementTempFilePath))
      );
    } catch (error) {
      logger.trace(
        `Element ${element.name} content cannot be read because of ${error.message}`
      );
      return new Error(`Element ${element.name} content cannot be read`);
    }
    const uploadType =
      searchLocation.type && searchLocation.type !== ANY_VALUE
        ? searchLocation.type
        : element.type;
    const uploadLocation = await askForUploadLocation({
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: uploadType,
      element: element.name,
      instance: element.instance,
    });
    if (uploadLocationDialogCancelled(uploadLocation)) {
      return new Error('Upload location must be specified to upload element.');
    }
    const changeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
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
    if (
      updateResult instanceof UpdateError &&
      updateResult.causeError instanceof FingerprintMismatchError
    ) {
      const versionComparisonResult = await compareVersions(service)(
        changeControlValue
      )(
        element,
        elementTempFilePath
      )(content);
      if (isError(versionComparisonResult)) {
        const error = versionComparisonResult;
        return error;
      }
      return new Error(
        `There is a conflict with the remote copy of element ${element.name}. Please resolve it before uploading again.`
      );
    }
    return updateResult;
  };

const compareVersions =
  (service: Service) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  (element: Element, updatedElementTempFilePath: string) =>
  async (updatedContent: string): Promise<void | Error> => {
    const tempEditFolder = await getTempEditFolderUri();
    if (isError(tempEditFolder)) {
      const error = tempEditFolder;
      logger.trace(error.message);
      return new Error(
        'Unable to get a valid edit folder name from settings to compare elements.'
      );
    }
    const elementName = element.name;
    const savedLocalElementVersionUri = await saveLocalElementVersionIntoFolder(
      {
        name: elementName,
        extension: element.extension,
      },
      updatedContent
    )(tempEditFolder);
    if (isError(savedLocalElementVersionUri)) {
      const error = savedLocalElementVersionUri;
      logger.trace(error.message);
      return new Error(
        `Unable to save a local version of the element ${element.name} to compare elements.`
      );
    }
    const showCompareDialogResult = await compareElementWithRemoteVersion(
      service
    )(uploadChangeControlValue)(
      element,
      updatedElementTempFilePath
    )(savedLocalElementVersionUri.fsPath);
    if (isError(showCompareDialogResult)) {
      const error = showCompareDialogResult;
      return error;
    }
  };

const saveLocalElementVersionIntoFolder =
  (
    element: {
      name: string;
      extension?: string;
    },
    elementContent: string
  ) =>
  async (folder: Uri): Promise<Uri | Error> => {
    const saveResult = await saveFileIntoWorkspaceFolder(folder)(
      {
        fileName: `${element.name}-local-version`,
        fileExtension: element.extension,
      },
      elementContent
    );
    if (isError(saveResult)) {
      const error = saveResult;
      return new Error(
        `Unable to save local element ${element.name} version because of ${error.message}.`
      );
    }
    return saveResult;
  };

const closeEditSession = async (elementUri: Uri) => {
  await closeActiveTextEditor();
  try {
    await deleteFile(elementUri);
  } catch (e) {
    logger.trace(
      `Edited file: ${elementUri.fsPath} was not deleted because of: ${e}.`
    );
  }
};
