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

import { reporter } from '../../globals';
import * as vscode from 'vscode';
import { ElementNode } from '../../tree/_doc/ElementTree';
import {
  getFileExtensionResolution,
  isAutomaticSignOut,
} from '../../settings/settings';
import {
  Action,
  Actions,
  SignedOutElementsPayload,
} from '../../store/_doc/Actions';
import { showElementToEdit } from '../utils';
import {
  EditElementCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  retrieveElementAndLogActivity,
  retrieveElementWithSignoutAndLogActivity,
} from '../../api/endevor';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import {
  formatWithNewLines,
  getEditFolderUri,
  getElementExtension,
  isError,
  parseFilePath,
  updateEditFoldersWhenContext,
} from '../../utils';
import {
  ActionChangeControlValue,
  Element,
  ErrorResponseType,
  RetrieveElementWithSignoutResponse,
  RetrieveElementWithoutSignoutResponse,
} from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { toEditedElementUri } from '../../uri/editedElementUri';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  createDirectory,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

type SelectedElementNode = ElementNode;

export const editElementCommand =
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
    >,
    getTempEditFolderUri: () => vscode.Uri
  ) =>
  async (elementNode: SelectedElementNode) => {
    const logger = createEndevorLogger({
      searchLocationId: elementNode.searchLocationId,
      serviceId: elementNode.serviceId,
    });
    logger.traceWithDetails(
      `Edit element command was called for ${elementNode.element.environment}/${elementNode.element.stageNumber}/${elementNode.element.system}/${elementNode.element.subSystem}/${elementNode.element.type}/${elementNode.name}`
    );
    if (isAutomaticSignOut()) {
      await editSingleElementWithSignout(
        dispatch,
        getConnectionConfiguration,
        getTempEditFolderUri
      )(elementNode);
      return;
    }
    try {
      await editSingleElement(
        dispatch,
        getConnectionConfiguration,
        getTempEditFolderUri
      )(elementNode);
    } catch (e) {
      return;
    }
    return;
  };

const editSingleElement =
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
    >,
    getTempEditFolderUri: () => vscode.Uri
  ) =>
  async (elementNode: ElementNode): Promise<void> => {
    const element = elementNode.element;
    const logger = createEndevorLogger({
      searchLocationId: elementNode.searchLocationId,
      serviceId: elementNode.serviceId,
    });
    const connectionParams = await getConnectionConfiguration(
      elementNode.serviceId,
      elementNode.searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const retrieveResponse = await withNotificationProgress(
      `Retrieving element ${elementNode.name} ...`
    )(async (progressReporter) => {
      return retrieveElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId: elementNode.serviceId,
          searchLocationId: elementNode.searchLocationId,
          element: elementNode.element,
        })
      )(progressReporter)(service)(elementNode.element);
    });
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve the element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.errorWithDetails(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.errorWithDetails(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to edit the element ${elementNode.element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const saveResult = await saveIntoEditFolder(getTempEditFolderUri())(
      elementNode.serviceId,
      elementNode.searchLocationId
    )(elementNode.element, retrieveResponse.result.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.errorWithDetails(
        `Unable to save the element ${elementNode.name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const uploadableElementUri = toEditedElementUri(saveResult.fsPath)({
      element: elementNode.element,
      fingerprint: retrieveResponse.result.fingerprint,
      searchContext: {
        serviceId: elementNode.serviceId,
        searchLocationId: elementNode.searchLocationId,
        initialSearchLocation: {
          subSystem: elementNode.parent.parent.name,
          system: elementNode.parent.parent.parent.name,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
        },
      },
    });
    if (isError(uploadableElementUri)) {
      const error = uploadableElementUri;
      logger.errorWithDetails(
        `Unable to open the element ${elementNode.name} for editing.`,
        `Unable to open the element ${elementNode.element.environment}/${elementNode.element.stageNumber}/${elementNode.element.system}/${elementNode.element.subSystem}/${elementNode.element.type}/${elementNode.name} because of an error:\n${error.message}.`
      );
      return;
    }
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.errorWithDetails(
        `Unable to open the element ${elementNode.name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
      status: EditElementCommandCompletedStatus.SUCCESS,
    });
  };

const editSingleElementWithSignout =
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
    >,
    getTempEditFolderUri: () => vscode.Uri
  ) =>
  async ({
    name,
    parent,
    serviceId,
    searchLocationId,
    element,
  }: ElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      searchLocationId,
      serviceId,
    });
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out element ${name}.`,
        'Edit element command was cancelled.'
      );
      return;
    }
    let retrieveResponse = await complexRetrieve(dispatch)(
      serviceId,
      searchLocationId
    )(service)(element)(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve element with sign out ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          retrieveResponse = await retrieveSingleCopy(dispatch)(
            serviceId,
            searchLocationId
          )(service)(element);
          if (isErrorEndevorResponse(retrieveResponse)) {
            const errorResponse = retrieveResponse;
            const error = new Error(
              `Unable to retrieve a copy of element ${
                element.name
              } because of error:${formatWithNewLines(
                errorResponse.details.messages
              )}`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return;
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
          });
          break;
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.errorWithDetails(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.errorWithDetails(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to edit element ${element.name} with sign out.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const saveResult = await saveIntoEditFolder(getTempEditFolderUri())(
      serviceId,
      searchLocationId
    )(element, retrieveResponse.result.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const uploadableElementUri = toEditedElementUri(saveResult.fsPath)({
      element,
      fingerprint: retrieveResponse.result.fingerprint,
      searchContext: {
        serviceId,
        searchLocationId,
        initialSearchLocation: {
          subSystem: parent.parent.name,
          system: parent.parent.parent.name,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: searchLocation.stageNumber!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: searchLocation.environment!,
        },
      },
    });
    if (isError(uploadableElementUri)) {
      const error = uploadableElementUri;
      logger.error(
        `Unable to open element ${name} for editing.`,
        `Unable to open element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} because of error:\n${error.message}.`
      );
      return;
    }
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
      status: EditElementCommandCompletedStatus.SUCCESS,
    });
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    const logger = createEndevorLogger({
      searchLocationId,
      serviceId,
    });
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)(element)(signoutChangeControlValue);
    if (!isError(signoutChangeControlValue)) {
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceId,
        searchLocationId,
        elements: [element],
      });
    }
    if (isErrorEndevorResponse(retrieveWithSignoutResponse)) {
      const errorResponse = retrieveWithSignoutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${element.name} cannot be retrieved with signout because it is signed out to somebody else.`
          );
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithSignoutOverride(dispatch)(
              serviceId,
              searchLocationId
            )(service)(element)(signoutChangeControlValue);
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return retrieveWithOverrideSignoutResponse;
        }
        default:
          return errorResponse;
      }
    }
    return retrieveWithSignoutResponse;
  };

const retrieveSingleElementWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with signout ...`
    )(async (progressReporter) => {
      return await retrieveElementWithSignoutAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)({
        signoutChangeControlValue,
      });
    });
  };

const retrieveSingleElementWithSignoutOverride =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with override signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignoutAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
    });
  };

const retrieveSingleCopy =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element): Promise<RetrieveElementWithoutSignoutResponse> => {
    return withNotificationProgress(`Retrieving element ${element.name} ...`)(
      async (progressReporter) => {
        return retrieveElementAndLogActivity(
          setLogActivityContext(dispatch, {
            serviceId,
            searchLocationId,
            element,
          })
        )(progressReporter)(service)(element);
      }
    );
  };

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      ...actionPayload,
    });
  };

const saveIntoEditFolder =
  (tempEditFolderUri: vscode.Uri) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  async (
    element: Element,
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    const editFolderUri = getEditFolderUri(tempEditFolderUri)(
      serviceId,
      searchLocationId
    )(element);
    let saveLocationUri;
    try {
      saveLocationUri = await createDirectory(editFolderUri);
    } catch (error) {
      return new Error(
        `Unable to create required temp directory ${editFolderUri.fsPath} for editing the elements because of error ${error.message}`
      );
    }
    try {
      const saveResult = await saveFileIntoWorkspaceFolder(saveLocationUri)(
        selectFileParams(element),
        elementContent
      );
      // update edit folders context variable to make sure all edited element paths are known
      updateEditFoldersWhenContext(saveLocationUri.fsPath);
      return saveResult;
    } catch (error) {
      return new Error(
        `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} into the file system because of error ${error.message}`
      );
    }
  };

const selectFileParams = (
  element: Element
): {
  fileName: string;
  fileExtension?: string;
} => {
  const fileExtResolution = getFileExtensionResolution();
  switch (fileExtResolution) {
    case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
      return {
        fileName: element.name,
        fileExtension: getElementExtension(element),
      };
    case FileExtensionResolutions.FROM_TYPE_EXT:
      return {
        fileName: element.name,
        fileExtension: element.extension,
      };
    case FileExtensionResolutions.FROM_NAME: {
      const { fileName, fileExtension } = parseFilePath(element.name);
      return {
        fileName,
        fileExtension,
      };
    }
    default:
      throw new UnreachableCaseError(fileExtResolution);
  }
};
