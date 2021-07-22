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

import {
  Service,
  ChangeControlValue,
  Element,
} from '@local/endevor/_doc/Endevor';
import {
  withNotificationProgress,
  showDiffEditor,
} from '@local/vscode-wrapper/window';
import { saveFileIntoWorkspaceFolder } from '@local/vscode-wrapper/workspace';
import { Uri } from 'vscode';
import { retrieveElementWithFingerprint } from '../endevor';
import { logger } from '../globals';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import { getTempEditFolderUri } from '../workspace';
import { Schemas } from '../_doc/Uri';

export const compareElementWithRemoteVersion = (service: Service) => (
  uploadChangeControlValue: ChangeControlValue
) => (element: Element, editedElementTempFilePath: string) => async (
  localVersionElementTempFilePath: string
): Promise<void | Error> => {
  const tempFolderUri = await getTempEditFolderUri();
  if (isError(tempFolderUri)) {
    const error = tempFolderUri;
    logger.trace(error.message);
    return new Error(
      'Unable to get a valid edit folder name from settings to compare elements.'
    );
  }
  const savedRemoteElementVersion = await retrieveRemoteVersionIntoFolder(
    service
  )(element)(tempFolderUri);
  if (isError(savedRemoteElementVersion)) {
    const error = savedRemoteElementVersion;
    return error;
  }
  const {
    savedRemoteVersionUri,
    fingerprint: remoteVersionFingerprint,
  } = savedRemoteElementVersion;
  const remoteVersionTempFilePath = savedRemoteVersionUri.fsPath;
  const localElementVersionUploadableUri = toUploadableDiffEditorUri(service)(
    uploadChangeControlValue
  )(element, editedElementTempFilePath)(
    remoteVersionTempFilePath,
    remoteVersionFingerprint
  )(localVersionElementTempFilePath);
  if (isError(localElementVersionUploadableUri)) {
    const error = localElementVersionUploadableUri;
    logger.trace(
      `Unable to construct local element ${element.name} version URI because of ${error.message}.`
    );
    return new Error(
      `Unable to open a local version of the element ${element.name} to compare elements.`
    );
  }
  const remoteElementVersionReadonlyUri = savedRemoteVersionUri.with({
    scheme: Schemas.READ_ONLY_FILE,
  });
  try {
    return await showDiffEditor(remoteElementVersionReadonlyUri)(
      localElementVersionUploadableUri
    );
  } catch (error) {
    logger.trace(`Unable to open a diff editor because of ${error.message}.`);
    return new Error(`Unable to open a diff editor to compare elements.`);
  }
};

type RetrieveResult = {
  savedRemoteVersionUri: Uri;
  fingerprint: string;
};

const retrieveRemoteVersionIntoFolder = (service: Service) => (
  element: Element
) => async (folder: Uri): Promise<RetrieveResult | Error> => {
  const remoteElementVersion = await withNotificationProgress(
    `Retrieving remote element ${element.name} version`
  )((progressReporter) => {
    return retrieveElementWithFingerprint(progressReporter)(service)(element);
  });
  if (!remoteElementVersion) {
    return new Error(
      `Unable to retrieve remote version of the element ${element.name} to compare.`
    );
  }
  try {
    const savedFileUri = await saveFileIntoWorkspaceFolder(folder)(
      {
        fileName: `${element.name}-remote-version`,
        fileExtension: `${element.extension}`,
      },
      remoteElementVersion.content
    );
    return {
      savedRemoteVersionUri: savedFileUri,
      fingerprint: remoteElementVersion.fingerprint,
    };
  } catch (error) {
    logger.trace(
      `Unable to save remote element ${element.name} version because of ${error.message}.`
    );
    return new Error(
      `Unable to save a remote version of the element ${element.name} to compare elements.`
    );
  }
};

const toUploadableDiffEditorUri = (service: Service) => (
  uploadChangeControlValue: ChangeControlValue
) => (element: Element, editedElementTempFilePath: string) => (
  remoteVersionTempFilePath: string,
  remoteVersionFingerprint: string
) => (localVersionTempFilePath: string) => {
  return toComparedElementUri(localVersionTempFilePath)({
    service,
    element,
    fingerprint: remoteVersionFingerprint,
    uploadChangeControlValue,
    initialElementTempFilePath: editedElementTempFilePath,
    remoteVersionTempFilePath,
  });
};
