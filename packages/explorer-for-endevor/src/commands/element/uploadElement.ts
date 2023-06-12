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

import { isErrorEndevorResponse } from '@local/endevor/utils';
import {
  deleteFile,
  getFileContent,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { Uri } from 'vscode';
import {
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation,
  dialogCancelled as uploadLocationDialogCancelled,
} from '../../dialogs/locations/endevorUploadLocationDialogs';
import { signOutElement, updateElement } from '../../endevor';
import { logger, reporter } from '../../globals';
import { formatWithNewLines, isError, isTheSameLocation } from '../../utils';
import {
  closeActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromEditedElementUri } from '../../uri/editedElementUri';
import {
  ActionChangeControlValue,
  ChangeControlValue,
  Element,
  ElementMapPath,
  ErrorResponseType,
  SignoutElementResponse,
  Service,
  SubSystemMapPath,
  Value,
  UpdateResponse,
} from '@local/endevor/_doc/Endevor';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { TextDecoder } from 'util';
import { ENCODING } from '../../constants';
import {
  askToOverrideSignOutForElements,
  askToSignOutElements,
} from '../../dialogs/change-control/signOutDialogs';
import { turnOnAutomaticSignOut } from '../../settings/settings';
import * as path from 'path';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  UploadElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../_doc/Telemetry';
import { Id } from '../../store/storage/_doc/Storage';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
  showElementToEdit,
} from '../utils';

export const uploadElementCommand = async (
  configurations: ConnectionConfigurations,
  dispatch: (action: Action) => Promise<void>,
  elementUri: Uri
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
  });
  const editSessionParams = fromEditedElementUri(elementUri);
  if (isError(editSessionParams)) {
    const error = editSessionParams;
    logger.error(
      `Unable to upload the selected element to Endevor.`,
      `Unable to upload the selected element to Endevor because parsing of the element's URI failed with an error:\n${error.message}.`
    );
    return;
  }
  const {
    element,
    fingerprint,
    searchContext: { searchLocationId, serviceId, initialSearchLocation },
  } = editSessionParams;
  logger.trace(
    `Upload the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} 
    of ${serviceId.source} connection ${serviceId.name} and ${searchLocationId.source} location ${searchLocationId.name}.`
  );
  const connectionParams = await getConnectionConfiguration(configurations)(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const { service, configuration, searchLocation } = connectionParams;
  const uploadValues = await askForUploadValues(searchLocation, element);
  if (isError(uploadValues)) {
    const error = uploadValues;
    logger.error(`${error.message}.`);
    return;
  }
  const content = await readEditedElementContent(elementUri.fsPath);
  if (isError(content)) {
    const error = content;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
      status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const [uploadLocation, uploadChangeControlValue] = uploadValues;
  await closeEditSession(elementUri);
  const uploadResult = await uploadElement(dispatch)(
    serviceId,
    searchLocationId,
    initialSearchLocation
  )(
    service,
    configuration,
    searchLocation
  )(uploadChangeControlValue, uploadLocation)(
    content,
    element,
    elementUri.fsPath,
    fingerprint
  );
  if (isError(uploadResult)) {
    const reopenResult = await reopenEditSession(elementUri);
    if (isError(reopenResult)) {
      logger.trace(`${reopenResult.message}.`);
    }
    return;
  }
  if (uploadResult && isErrorEndevorResponse(uploadResult)) {
    const reopenResult = await reopenEditSession(elementUri);
    if (isError(reopenResult)) {
      logger.trace(`${reopenResult.message}.`);
    }
    return;
  }
  if (
    uploadResult &&
    uploadResult.details?.returnCode &&
    uploadResult.details?.returnCode >= 4
  ) {
    logger.warn(
      `Element ${element.name} was updated with warnings`,
      `Element ${element.name} was updated with warnings: ${formatWithNewLines(
        uploadResult.details.messages
      )}`
    );
  }
  await safeRemoveUploadedElement(elementUri);
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
    status: UploadElementCommandCompletedStatus.SUCCESS,
  });
  const isNewElementAdded = uploadLocation.id !== element.name;
  if (isNewElementAdded) {
    await dispatch({
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId,
      element: {
        ...uploadLocation,
        id: uploadLocation.id,
        name: uploadLocation.id,
        noSource: false,
        extension: element.extension,
        lastActionCcid: uploadChangeControlValue.ccid.toUpperCase(),
      },
    });
    return;
  }
  const isElementEditedInPlace = isTheSameLocation(uploadLocation)(element);
  if (isElementEditedInPlace) {
    await dispatch({
      type: Actions.ELEMENT_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element: {
        ...element,
        lastActionCcid: uploadChangeControlValue.ccid.toUpperCase(),
      },
    });
    return;
  }
  await dispatch({
    type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP,
    treePath: {
      serviceId,
      searchLocationId,
      searchLocation: initialSearchLocation,
    },
    pathUpTheMap: element,
    targetElement: {
      ...uploadLocation,
      id: element.id,
      name: element.name,
      noSource: false,
      extension: element.extension,
      lastActionCcid: uploadChangeControlValue.ccid.toUpperCase(),
    },
  });
};

const askForUploadValues = async (
  searchLocation: ElementSearchLocation,
  element: Element
): Promise<[ElementMapPath, ActionChangeControlValue] | Error> => {
  const uploadType = searchLocation.type ? searchLocation.type : element.type;
  const uploadLocation = await askForUploadLocation({
    environment: searchLocation.environment,
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system,
    subsystem: searchLocation.subsystem,
    type: uploadType,
    element: element.name,
  });
  if (uploadLocationDialogCancelled(uploadLocation)) {
    return new Error(
      `Upload location must be specified to upload the element ${element.name}`
    );
  }
  const uploadChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(uploadChangeControlValue)) {
    return new Error(
      `CCID and Comment must be specified to upload the element ${uploadLocation.id}`
    );
  }
  return [uploadLocation, uploadChangeControlValue];
};

const uploadElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: Id, searchLocationId: Id, treePath: SubSystemMapPath) =>
  (
    service: Service,
    configuration: Value,
    searchLocation: ElementSearchLocation
  ) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  async (
    content: string,
    element: Element,
    elementFilePath: string,
    fingerprint: string
  ): Promise<UpdateResponse | Error | void> => {
    const uploadResult = await withNotificationProgress(
      `Uploading the element ${uploadTargetLocation.id} ...`
    )((progressReporter) => {
      return updateElement(progressReporter)(service)(configuration)(
        uploadTargetLocation
      )(uploadChangeControlValue)({
        content,
        fingerprint,
        elementFilePath,
      });
    });
    if (isErrorEndevorResponse(uploadResult)) {
      const errorResponse = uploadResult;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to upload the element ${
          uploadTargetLocation.id
        } to Endevor because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `The element ${uploadTargetLocation.id} requires a sign out action to update/add elements.`
          );
          const signOutDialogResult = await askToSignOutElements([
            element.name,
          ]);
          if (
            !signOutDialogResult.signOutElements &&
            !signOutDialogResult.automaticSignOut
          ) {
            logger.error(
              `Unable to upload the element ${element.name} to Endevor because it is signed out to somebody else or not at all.`
            );
            return errorResponse;
          }
          if (signOutDialogResult.automaticSignOut) {
            try {
              await turnOnAutomaticSignOut();
            } catch (error) {
              logger.warn(
                `Unable to update the global sign out setting.`,
                `Unable to update the global sign out setting because of an error:\n${error.message}.`
              );
            }
          }
          const preUpdateSignout = await complexSignoutElement(dispatch)(
            service,
            configuration,
            serviceId,
            searchLocationId
          )(element)(uploadChangeControlValue);
          if (isErrorEndevorResponse(preUpdateSignout)) return errorResponse;
          return uploadElement(dispatch)(serviceId, searchLocationId, treePath)(
            service,
            configuration,
            searchLocation
          )(uploadChangeControlValue, uploadTargetLocation)(
            content,
            element,
            elementFilePath,
            fingerprint
          );
        }
        case ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR: {
          return uploadFingerprintMismatch(
            serviceId,
            searchLocationId,
            treePath
          )(service, configuration)(
            uploadChangeControlValue,
            uploadTargetLocation
          )(
            element,
            elementFilePath
          )(content);
        }
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
          logger.error(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR: {
          logger.error(
            `Unable to connect to Endevor Web Services.`,
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.GENERIC_ERROR: {
          logger.error(
            `Unable to upload the element ${element.name} to Endevor.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        default: {
          throw new UnreachableCaseError(errorResponse.type);
        }
      }
    }
    return uploadResult;
  };

const readEditedElementContent = async (
  elementTempFilePath: string
): Promise<string | Error> => {
  try {
    return new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(elementTempFilePath))
    );
  } catch (error) {
    return new Error(
      `Unable to read the element content because of error ${error.message}`
    );
  }
};

const complexSignoutElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    service: Service,
    configuration: Value,
    serviceId: Id,
    searchLocationId: Id
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<SignoutElementResponse> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
      context: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
    });
    let signOutResult = await withNotificationProgress(
      `Signing out the element ${element.name}...`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(configuration)(element)({
        signoutChangeControlValue,
      })
    );
    if (isErrorEndevorResponse(signOutResult)) {
      const error = signOutResult;
      switch (error.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.warn(
            `Unable to sign out the element ${element.name} because it is signed out to somebody else.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
          });
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return error;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be signed out with override.`
          );
          signOutResult = await withNotificationProgress(
            `Signing out the element with override ${element.name} ...`
          )((progressReporter) =>
            signOutElement(progressReporter)(service)(configuration)(element)({
              signoutChangeControlValue,
              overrideSignOut: true,
            })
          );
          updateTreeAfterSuccessfulSignout(dispatch)(
            serviceId,
            searchLocationId,
            [element]
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return signOutResult;
        default:
          return error;
      }
    }
    updateTreeAfterSuccessfulSignout(dispatch)(serviceId, searchLocationId, [
      element,
    ]);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
      context: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
      status: SignoutErrorRecoverCommandCompletedStatus.SIGNOUT_SUCCESS,
    });
    return signOutResult;
  };

type LocalElement = Omit<Element, 'lastActionCcid' | 'noSource'>;

const saveLocalElementVersion =
  (elementFilePath: string) =>
  ({ name, extension }: LocalElement) =>
  async (content: string): Promise<Uri | Error> => {
    const tempEditFolder = path.dirname(elementFilePath);
    if (!tempEditFolder) {
      return new Error(
        'Unable to get a valid edit folder name to compare the elements'
      );
    }

    const tempEditFolderUri = Uri.file(tempEditFolder);
    try {
      return saveFileIntoWorkspaceFolder(tempEditFolderUri)(
        {
          fileName: `${name}-local-version`,
          fileExtension: extension,
        },
        content
      );
    } catch (e) {
      return e;
    }
  };

const closeEditSession = async (_editedFileUri: Uri) => {
  await closeActiveTextEditor();
};

const reopenEditSession = (editedElementUri: Uri) => {
  return showElementToEdit(editedElementUri);
};

const safeRemoveUploadedElement = async (editedElementUri: Uri) => {
  try {
    await deleteFile(editedElementUri);
  } catch (e) {
    logger.error(
      `Unable to remove the file ${editedElementUri.fsPath}.`,
      `Unable to remove the file ${editedElementUri.fsPath} because of error ${e.message}.`
    );
  }
};

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    serviceId: Id,
    searchLocationId: Id,
    elements: ReadonlyArray<Element>
  ): void => {
    dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceId,
      searchLocationId,
      elements,
    });
  };

const uploadFingerprintMismatch =
  (serviceId: Id, searchLocationId: Id, treePath: SubSystemMapPath) =>
  (service: Service, configuration: Value) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, elementFilePath: string) =>
  async (content: string): Promise<void | Error> => {
    logger.warn(
      `There is a conflict with the remote copy of element ${uploadTargetLocation.id}. Please resolve it before uploading again.`
    );
    const savedLocalElementVersionUri = await saveLocalElementVersion(
      elementFilePath
    )({
      ...uploadTargetLocation,
      name: uploadTargetLocation.id,
      extension: element.extension,
    })(content);
    if (isError(savedLocalElementVersionUri)) {
      const error = new Error(
        `Unable to save a local version of the element ${uploadTargetLocation.id} to compare because of error ${savedLocalElementVersionUri.message}`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
        status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL,
      context: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
    });
    const showCompareDialogResult = await compareElementWithRemoteVersion(
      service,
      configuration,
      element
    )(uploadChangeControlValue, uploadTargetLocation)(
      serviceId,
      searchLocationId,
      treePath
    )(savedLocalElementVersionUri.fsPath);
    if (isError(showCompareDialogResult)) {
      const error = showCompareDialogResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
        status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    return;
  };
