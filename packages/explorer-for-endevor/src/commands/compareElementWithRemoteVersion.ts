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
  ChangeControlValue,
  Element,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import {
  withNotificationProgress,
  showDiffEditor,
} from '@local/vscode-wrapper/window';
import { saveFileIntoWorkspaceFolder } from '@local/vscode-wrapper/workspace';
import * as path from 'path';
import { Uri } from 'vscode';
import { retrieveElementWithFingerprint } from '../endevor';
import { logger } from '../globals';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import { Schemas } from '../_doc/Uri';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

export const compareElementWithRemoteVersion =
  (service: Service, searchLocation: ElementSearchLocation) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  (
    element: Element,
    editedElementTempFilePath: string,
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName
  ) =>
  async (localVersionElementTempFilePath: string): Promise<void | Error> => {
    const tempFolder = path.dirname(editedElementTempFilePath);
    if (!tempFolder) {
      logger.trace(
        'Unable to get a valid edit folder name to compare elements.'
      );
      return new Error(
        'Unable to get a valid edit folder name to compare elements.'
      );
    }
    const tempFolderUri = Uri.file(tempFolder);
    const savedRemoteElementVersion = await retrieveRemoteVersionIntoFolder(
      service
    )(element)(tempFolderUri);
    if (isError(savedRemoteElementVersion)) {
      const error = savedRemoteElementVersion;
      return error;
    }
    const { savedRemoteVersionUri, fingerprint: remoteVersionFingerprint } =
      savedRemoteElementVersion;
    const remoteVersionTempFilePath = savedRemoteVersionUri.fsPath;
    const localElementVersionUploadableUri = toUploadableDiffEditorUri(
      service,
      searchLocation
    )(uploadChangeControlValue)(
      element,
      editedElementTempFilePath,
      serviceName,
      searchLocationName
    )(
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

const retrieveRemoteVersionIntoFolder =
  (service: Service) =>
  (element: Element) =>
  async (folder: Uri): Promise<RetrieveResult | Error> => {
    const remoteElementVersion = await withNotificationProgress(
      `Retrieving remote element ${element.name} version`
    )((progressReporter) => {
      return retrieveElementWithFingerprint(progressReporter)(service)(
        element
      )();
    });
    if (!remoteElementVersion) {
      return new Error(
        `Unable to retrieve remote version of the element ${element.name} to compare.`
      );
    }
    try {
      if (remoteElementVersion instanceof Error) {
        return new Error(
          `Unable to save a remote version of the element ${element.name} to compare elements.`
        );
      }
      let tempContent;
      if ('content' in remoteElementVersion) {
        tempContent = remoteElementVersion.content;
      } else {
        return new Error('Unable to retrieve remote element content.');
      }
      const savedFileUri = await saveFileIntoWorkspaceFolder(folder)(
        {
          fileName: `${element.name}-remote-version`,
          fileExtension: `${element.extension}`,
        },
        tempContent
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

const toUploadableDiffEditorUri =
  (service: Service, searchLocation: ElementSearchLocation) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  (
    element: Element,
    editedElementTempFilePath: string,
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName
  ) =>
  (remoteVersionTempFilePath: string, remoteVersionFingerprint: string) =>
  (localVersionTempFilePath: string) => {
    return toComparedElementUri(localVersionTempFilePath)({
      service,
      serviceName,
      element,
      fingerprint: remoteVersionFingerprint,
      searchLocation,
      searchLocationName,
      uploadChangeControlValue,
      initialElementTempFilePath: editedElementTempFilePath,
      remoteVersionTempFilePath,
    });
  };
