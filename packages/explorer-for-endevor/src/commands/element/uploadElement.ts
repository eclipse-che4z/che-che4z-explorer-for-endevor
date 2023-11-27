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
import {
  getProcessorGroupsByTypeAndLogActivity,
  signOutElementAndLogActivity,
  updateElementAndLogActivity,
} from '../../api/endevor';
import { reporter } from '../../globals';
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
  ElementTypeMapPath,
  ErrorResponseType,
  ProcessorGroupValue,
  ProcessorGroupsResponse,
  SignoutElementResponse,
  SubSystemMapPath,
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
} from '../../telemetry/_doc/Telemetry';
import { Id } from '../../store/storage/_doc/Storage';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { showElementToEdit } from '../utils';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  askForProcessorGroup,
  pickedChoiceLabel,
} from '../../dialogs/processor-groups/processorGroupsDialogs';
import { ProgressReporter } from '@local/endevor/_doc/Progress';

export const uploadElementCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async (elementUri: Uri): Promise<void> => {
    const logger = createEndevorLogger();
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
    logger.updateContext({ serviceId, searchLocationId });
    logger.traceWithDetails(
      `Upload element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} was called.`
    );
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const uploadValues = await askForUploadValues(logger)(
      getProcessorGroupsByTypeAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
        })
      )(service),
      searchLocation,
      element
    );
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
        errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
        status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const [
      uploadLocation,
      uploadChangeControlValue,
      uploadProcessorGroupValue,
    ] = uploadValues;
    await closeEditSession(elementUri);
    const uploadResult = await uploadElement(logger)(dispatch)(
      serviceId,
      searchLocationId
    )(service)(initialSearchLocation)(
      uploadChangeControlValue,
      uploadProcessorGroupValue,
      uploadLocation
    )(content, element, elementUri.fsPath, fingerprint);
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
      logger.warnWithDetails(
        `Element ${element.name} was updated with warnings`,
        `Element ${element.environment}/${element.stageNumber}/${
          element.system
        }/${element.subSystem}/${element.type}/${
          element.name
        } was updated with warnings: ${formatWithNewLines(
          uploadResult.details.messages
        )}`
      );
    }
    await safeRemoveUploadedElement(logger)(elementUri);
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
          processorGroup: element.processorGroup,
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
        processorGroup: element.processorGroup,
      },
    });
  };

const askForUploadValues =
  (logger: EndevorLogger) =>
  async (
    getProcessorGroups: (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>,
    searchLocation: SearchLocation,
    element: Element
  ): Promise<
    [ElementMapPath, ActionChangeControlValue, ProcessorGroupValue] | Error
  > => {
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
        `Upload location must be specified to upload element ${element.name}`
      );
    }
    let actionProcGroup = await askForProcessorGroup(
      logger,
      {
        ...uploadLocation,
        type: element.type,
      },
      getProcessorGroups,
      element.processorGroup
    );
    if (!actionProcGroup) {
      return new Error(`Upload of element ${element.name} was cancelled.`);
    }
    actionProcGroup =
      actionProcGroup !== pickedChoiceLabel ? actionProcGroup : undefined;
    const uploadChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (changeControlDialogCancelled(uploadChangeControlValue)) {
      return new Error(
        `CCID and Comment must be specified to upload element ${uploadLocation.id}`
      );
    }
    return [uploadLocation, uploadChangeControlValue, actionProcGroup];
  };

const uploadElement =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: Id, searchLocationId: Id) =>
  (service: EndevorAuthorizedService) =>
  (treePath: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadProcessorGroupValue: ProcessorGroupValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  async (
    content: string,
    element: Element,
    elementFilePath: string,
    fingerprint: string
  ): Promise<UpdateResponse | Error | void> => {
    const uploadResult = await withNotificationProgress(
      `Uploading element ${uploadTargetLocation.id} ...`
    )((progressReporter) => {
      return updateElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(uploadTargetLocation)(
        uploadProcessorGroupValue
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
        `Unable to upload element ${uploadTargetLocation.environment}/${
          uploadTargetLocation.stageNumber
        }/${uploadTargetLocation.system}/${uploadTargetLocation.subSystem}/${
          uploadTargetLocation.type
        }/${
          uploadTargetLocation.id
        } to Endevor because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${uploadTargetLocation.id} requires a sign out action to update/add elements.`
          );
          const signOutDialogResult = await askToSignOutElements([
            element.name,
          ]);
          if (
            !signOutDialogResult.signOutElements &&
            !signOutDialogResult.automaticSignOut
          ) {
            logger.errorWithDetails(
              `Unable to upload element ${element.name} to Endevor because it is signed out to somebody else or not at all.`
            );
            return errorResponse;
          }
          if (signOutDialogResult.automaticSignOut) {
            try {
              await turnOnAutomaticSignOut();
            } catch (error) {
              logger.warnWithDetails(
                `Unable to update the global sign out setting.`,
                `Unable to update the global sign out setting because of error:\n${error.message}.`
              );
            }
          }
          const preUpdateSignout = await complexSignoutElement(logger)(
            dispatch
          )(
            serviceId,
            searchLocationId
          )(service)(element)(uploadChangeControlValue);
          if (isErrorEndevorResponse(preUpdateSignout)) return errorResponse;
          return uploadElement(logger)(dispatch)(serviceId, searchLocationId)(
            service
          )(treePath)(
            uploadChangeControlValue,
            uploadProcessorGroupValue,
            uploadTargetLocation
          )(content, element, elementFilePath, fingerprint);
        }
        case ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR: {
          return uploadFingerprintMismatch(logger)(dispatch)(
            serviceId,
            searchLocationId
          )(service)(treePath)(
            uploadChangeControlValue,
            uploadProcessorGroupValue,
            uploadTargetLocation
          )(
            element,
            elementFilePath
          )(content);
        }
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
          logger.errorWithDetails(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR: {
          logger.errorWithDetails(
            `Unable to connect to Endevor Web Services.`,
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.GENERIC_ERROR: {
          logger.errorWithDetails(
            `Unable to upload element ${element.name} to Endevor.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
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
      `Unable to read element content because of error ${error.message}`
    );
  }
};

const complexSignoutElement =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: Id, searchLocationId: Id) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<SignoutElementResponse> => {
    let signOutResult = await withNotificationProgress(
      `Signing out element ${element.name} ...`
    )((progressReporter) =>
      signOutElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)({
        signoutChangeControlValue,
      })
    );
    if (isErrorEndevorResponse(signOutResult)) {
      const error = signOutResult;
      switch (error.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.warnWithDetails(
            `Unable to sign out  element ${element.name} because it is signed out to somebody else.`
          );
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return error;
          }
          logger.trace(
            `Override signout option was chosen, ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} will be signed out with override.`
          );
          signOutResult = await withNotificationProgress(
            `Signing out element with override ${element.name} ...`
          )((progressReporter) =>
            signOutElementAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId,
                searchLocationId,
                element,
              })
            )(progressReporter)(service)(element)({
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

const safeRemoveUploadedElement =
  (logger: EndevorLogger) => async (editedElementUri: Uri) => {
    try {
      await deleteFile(editedElementUri);
    } catch (e) {
      logger.error(
        `Unable to remove file ${editedElementUri.fsPath}.`,
        `Unable to remove file ${editedElementUri.fsPath} because of error ${e.message}.`
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
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: Id, searchLocationId: Id) =>
  (service: EndevorAuthorizedService) =>
  (treePath: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadProcessorGroupValue: ProcessorGroupValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, elementFilePath: string) =>
  async (content: string): Promise<void | Error> => {
    logger.warnWithDetails(
      `There is a conflict with the remote copy of element ${uploadTargetLocation.id}. Please resolve it before uploading again.`
    );
    const savedLocalElementVersionUri = await saveLocalElementVersion(
      elementFilePath
    )({
      ...uploadTargetLocation,
      name: uploadTargetLocation.id,
      extension: element.extension,
      processorGroup: element.processorGroup,
    })(content);
    if (isError(savedLocalElementVersionUri)) {
      const error = new Error(
        `Unable to save a local version of element ${uploadTargetLocation.environment}/${uploadTargetLocation.stageNumber}/${uploadTargetLocation.system}/${uploadTargetLocation.subSystem}/${uploadTargetLocation.type}/${uploadTargetLocation.id} to compare because of error ${savedLocalElementVersionUri.message}`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
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
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)(treePath)(
      uploadChangeControlValue,
      uploadProcessorGroupValue,
      uploadTargetLocation
    )(element, savedLocalElementVersionUri.fsPath);
    if (isError(showCompareDialogResult)) {
      const error = showCompareDialogResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
        status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    return;
  };
