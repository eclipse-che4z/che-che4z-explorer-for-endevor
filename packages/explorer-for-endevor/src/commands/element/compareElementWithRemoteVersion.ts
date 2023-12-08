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

import {
  ChangeControlValue,
  Element,
  ElementMapPath,
  SubSystemMapPath,
  UpdateParams,
} from '@local/endevor/_doc/Endevor';
import {
  withNotificationProgress,
  showDiffEditor,
} from '@local/vscode-wrapper/window';
import { saveFileIntoWorkspaceFolder } from '@local/vscode-wrapper/workspace';
import * as path from 'path';
import { Uri } from 'vscode';
import { retrieveElementFirstFoundAndLogActivity } from '../../api/endevor';
import { reporter } from '../../globals';
import { toComparedElementUri } from '../../uri/comparedElementUri';
import { formatWithNewLines, isError } from '../../utils';
import { Schemas } from '../../uri/_doc/Uri';
import {
  TelemetryEvents,
  ResolveConflictWithRemoteCompletedStatus,
} from '../../telemetry/_doc/Telemetry';
import { EndevorId } from '../../store/_doc/v2/Store';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { logActivity as setLogActivityContext } from '../../logger';
import { Action } from '../../store/_doc/Actions';
import { EndevorAuthorizedService } from '../../api/_doc/Endevor';

export const compareElementWithRemoteVersion =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (initialSearchLocation: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadParameters: UpdateParams,
    uploadTargetLocation: ElementMapPath
  ) =>
  async (
    element: Element,
    localVersionElementTempFilePath: string
  ): Promise<void | Error> => {
    const tempFolder = path.dirname(localVersionElementTempFilePath);
    if (!tempFolder) {
      return new Error(
        'Unable to get a valid edit folder name to compare elements'
      );
    }
    const tempFolderUri = Uri.file(tempFolder);
    const savedRemoteElementVersion = await retrieveRemoteVersionIntoFolder(
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)({
      ...uploadTargetLocation,
      name: uploadTargetLocation.id,
      extension: element.extension,
    })(tempFolderUri);
    if (isError(savedRemoteElementVersion)) {
      const error = savedRemoteElementVersion;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED,
        status: ResolveConflictWithRemoteCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    const { savedRemoteVersionUri, fingerprint: remoteVersionFingerprint } =
      savedRemoteElementVersion;
    const remoteVersionTempFilePath = savedRemoteVersionUri.fsPath;
    const localElementVersionUploadableUri = toUploadableDiffEditorUri(
      initialSearchLocation
    )(uploadChangeControlValue, uploadParameters, uploadTargetLocation)(
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
        `Unable to open a local version of element ${uploadTargetLocation.environment}/${uploadTargetLocation.stageNumber}/${uploadTargetLocation.system}/${uploadTargetLocation.subSystem}/${uploadTargetLocation.type}/${uploadTargetLocation.id} to compare because of error ${error.message}`
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
          TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED,
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

type LocalElement = Omit<
  Element,
  'lastActionCcid' | 'noSource' | 'processorGroup'
>;
type RetrieveResult = {
  savedRemoteVersionUri: Uri;
  fingerprint: string;
};

const retrieveRemoteVersionIntoFolder =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (localElement: LocalElement) =>
  async (folder: Uri): Promise<RetrieveResult | Error> => {
    const retrieveRemoteElementVersionResponse = await withNotificationProgress(
      `Retrieving a remote version of element ${localElement.name} ...`
    )((progressReporter) => {
      return retrieveElementFirstFoundAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element: {
            ...localElement,
            noSource: false,
          },
        })
      )(progressReporter)(service)(localElement);
    });
    if (isErrorEndevorResponse(retrieveRemoteElementVersionResponse)) {
      const errorResponse = retrieveRemoteElementVersionResponse;
      // TODO: format using all possible details
      const error = new Error(
        `Unable to save a remote version of element ${
          localElement.environment
        }/${localElement.stageNumber}/${localElement.system}/${
          localElement.subSystem
        }/${localElement.type}/${
          localElement.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      return error;
    }
    try {
      const savedFileUri = await saveFileIntoWorkspaceFolder(folder)(
        {
          fileName: `${localElement.name}-remote-version`,
          fileExtension: `${localElement.extension}`,
        },
        retrieveRemoteElementVersionResponse.result.content
      );
      return {
        savedRemoteVersionUri: savedFileUri,
        fingerprint: retrieveRemoteElementVersionResponse.result.fingerprint,
      };
    } catch (error) {
      return new Error(
        `Unable to save a remote version of element ${localElement.environment}/${localElement.stageNumber}/${localElement.system}/${localElement.subSystem}/${localElement.type}/${localElement.name} into the file system because of error ${error.message}`
      );
    }
  };

const toUploadableDiffEditorUri =
  (initialSearchLocation: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadParameters: UpdateParams,
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
      uploadParameters,
      uploadTargetLocation,
      initialSearchContext: {
        serviceId,
        searchLocationId,
        initialSearchLocation,
      },
    });
  };
