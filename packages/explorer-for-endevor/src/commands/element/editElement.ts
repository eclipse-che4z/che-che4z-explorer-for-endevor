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

import { logger, reporter } from '../../globals';
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
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
  showElementToEdit,
} from '../utils';
import {
  EditElementCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/Telemetry';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { retrieveElement, retrieveElementWithSignout } from '../../endevor';
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
  Service,
  Value,
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

type SelectedElementNode = ElementNode;

type CommandContext = Readonly<{
  getTempEditFolderUri: () => vscode.Uri;
  dispatch: (action: Action) => Promise<void>;
}>;

export const editElementCommand =
  (
    configurations: ConnectionConfigurations,
    { getTempEditFolderUri, dispatch }: CommandContext
  ) =>
  async (elementNode: SelectedElementNode) => {
    logger.trace(`Edit element command was called for ${elementNode.name}`);
    if (isAutomaticSignOut()) {
      await editSingleElementWithSignout(
        configurations,
        dispatch
      )(getTempEditFolderUri)(elementNode);
      return;
    }
    try {
      await editSingleElement(
        configurations,
        getTempEditFolderUri
      )(elementNode);
    } catch (e) {
      return;
    }
    return;
  };

const editSingleElement =
  (
    configurations: ConnectionConfigurations,
    getTempEditFolderUri: () => vscode.Uri
  ) =>
  async (elementNode: ElementNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      autoSignOut: false,
    });
    const connectionParams = await getConnectionConfiguration(configurations)(
      elementNode.serviceId,
      elementNode.searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    const retrieveResponse = await withNotificationProgress(
      `Retrieving element ${elementNode.name} ...`
    )(async (progressReporter) => {
      return retrieveElement(progressReporter)(service)(configuration)(
        elementNode.element
      );
    });
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve the element ${
          elementNode.element.name
        } because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to edit the element ${elementNode.element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
      logger.error(
        `Unable to save the element ${elementNode.name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
      logger.error(
        `Unable to open the element ${elementNode.name} for editing.`,
        `Unable to open the element ${elementNode.name} because of an error:\n${error.message}.`
      );
      return;
    }
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${elementNode.name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  (getTempEditFolderUri: () => vscode.Uri) =>
  async ({
    name,
    parent,
    serviceId,
    searchLocationId,
    element,
  }: ElementNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      autoSignOut: true,
    });
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out the element ${name}.`,
        'Edit element command cancelled'
      );
      return;
    }
    let retrieveResponse = await complexRetrieve(dispatch)(
      service,
      configuration
    )(
      serviceId,
      searchLocationId,
      element
    )(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve the element with sign out ${
          element.name
        } because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          retrieveResponse = await retrieveSingleCopy(service)(configuration)(
            element
          );
          if (isErrorEndevorResponse(retrieveResponse)) {
            const errorResponse = retrieveResponse;
            const error = new Error(
              `Unable to retrieve a copy of the element ${
                element.name
              } because of an error:${formatWithNewLines(
                errorResponse.details.messages
              )}`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
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
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to edit with sign out the element ${element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
        `Unable to save the element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
        `Unable to open the element ${name} for editing.`,
        `Unable to open the element ${name} because of an error:\n${error.message}.`
      );
      return;
    }
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
  (service: Service, configuration: Value) =>
  (serviceId: EndevorId, searchLocationId: EndevorId, element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      service
    )(configuration)(element)(signoutChangeControlValue);
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
          logger.warn(
            `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
          });
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithSignoutOverride(service)(
              configuration
            )(element)(signoutChangeControlValue);
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
  (service: Service) =>
  (configuration: Value) =>
  (element: Element) =>
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with signout ...`
    )(async (progressReporter) => {
      return await retrieveElementWithSignout(progressReporter)(service)(
        configuration
      )(element)({ signoutChangeControlValue });
    });
  };

const retrieveSingleElementWithSignoutOverride =
  (service: Service) =>
  (configuration: Value) =>
  (element: Element) =>
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with override signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(
        configuration
      )(element)({ signoutChangeControlValue, overrideSignOut: true });
    });
  };

const retrieveSingleCopy =
  (service: Service) =>
  (configuration: Value) =>
  (element: Element): Promise<RetrieveElementWithoutSignoutResponse> => {
    return withNotificationProgress(`Retrieving element ${element.name} ...`)(
      async (progressReporter) => {
        return retrieveElement(progressReporter)(service)(configuration)(
          element
        );
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
        `Unable to create a required temp directory ${editFolderUri.fsPath} for editing the elements because of error ${error.message}`
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
        `Unable to save the element ${element.name} into the file system because of error ${error.message}`
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
