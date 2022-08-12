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
  Service,
  ChangeControlValue,
  Element,
  ElementSearchLocation,
  ElementMapPath,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import {
  withNotificationProgress,
  showDiffEditor,
} from '@local/vscode-wrapper/window';
import { saveFileIntoWorkspaceFolder } from '@local/vscode-wrapper/workspace';
import * as path from 'path';
import { Uri } from 'vscode';
import { retrieveElementWithFingerprint } from '../endevor';
import { reporter } from '../globals';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import { Schemas } from '../_doc/Uri';
import {
  TelemetryEvents,
  ResolveConflictWithRemoteCompletedStatus,
} from '../_doc/Telemetry';
import { EndevorId } from '../store/_doc/v2/Store';

export const compareElementWithRemoteVersion =
  (service: Service, searchLocation: ElementSearchLocation, element: Element) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    initialSearchLocation: SubSystemMapPath
  ) =>
  async (localVersionElementTempFilePath: string): Promise<void | Error> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED,
    });
    const tempFolder = path.dirname(localVersionElementTempFilePath);
    if (!tempFolder) {
      return new Error(
        'Unable to get a valid edit folder name to compare the elements'
      );
    }
    const tempFolderUri = Uri.file(tempFolder);
    const savedRemoteElementVersion = await retrieveRemoteVersionIntoFolder(
      service
    )({
      ...uploadTargetLocation,
      extension: element.extension,
    })(tempFolderUri);
    if (isError(savedRemoteElementVersion)) {
      const error = savedRemoteElementVersion;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED,
        status: ResolveConflictWithRemoteCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    const { savedRemoteVersionUri, fingerprint: remoteVersionFingerprint } =
      savedRemoteElementVersion;
    const remoteVersionTempFilePath = savedRemoteVersionUri.fsPath;
    const localElementVersionUploadableUri = toUploadableDiffEditorUri(
      service,
      searchLocation,
      initialSearchLocation
    )(uploadChangeControlValue, uploadTargetLocation)(
      element,
      serviceId,
      searchLocationId
    )(
      remoteVersionTempFilePath,
      remoteVersionFingerprint
    )(localVersionElementTempFilePath);
    if (isError(localElementVersionUploadableUri)) {
      const error = localElementVersionUploadableUri;
      return new Error(
        `Unable to open a local version of the element ${uploadTargetLocation.name} to compare because of error ${error.message}`
      );
    }
    const remoteElementVersionReadonlyUri = savedRemoteVersionUri.with({
      scheme: Schemas.READ_ONLY_FILE,
    });
    try {
      await showDiffEditor(remoteElementVersionReadonlyUri)(
        localElementVersionUploadableUri
      );
    } catch (e) {
      const error = new Error(
        `Unable to open a diff editor because of error ${e.message}`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED,
        status: ResolveConflictWithRemoteCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED,
      status: ResolveConflictWithRemoteCompletedStatus.SUCCESS,
    });
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
      `Retrieving a remote version of the element ${element.name}...`
    )((progressReporter) => {
      return retrieveElementWithFingerprint(progressReporter)(service)(
        element
      )();
    });
    if (isError(remoteElementVersion)) {
      const error = remoteElementVersion;
      return error;
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
      return new Error(
        `Unable to save a remote version of the element ${element.name} into file system because of error ${error.message}`
      );
    }
  };

const toUploadableDiffEditorUri =
  (
    service: Service,
    searchLocation: ElementSearchLocation,
    initialSearchLocation: SubSystemMapPath
  ) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, serviceId: EndevorId, searchLocationId: EndevorId) =>
  (remoteVersionTempFilePath: string, remoteVersionFingerprint: string) =>
  (localVersionTempFilePath: string) => {
    return toComparedElementUri(localVersionTempFilePath)({
      element,
      fingerprint: remoteVersionFingerprint,
      remoteVersionTempFilePath,
      uploadChangeControlValue,
      uploadTargetLocation,
      endevorConnectionDetails: service,
      initialSearchContext: {
        serviceId,
        searchLocationId,
        overallSearchLocation: searchLocation,
        initialSearchLocation,
      },
    });
  };
