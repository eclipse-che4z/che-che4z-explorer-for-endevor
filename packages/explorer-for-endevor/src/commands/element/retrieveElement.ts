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
  retrieveElementAndLogActivity,
  retrieveElementWithSignoutAndLogActivity,
} from '../../api/endevor';
import { reporter } from '../../globals';
import {
  filterElementNodes,
  isDefined,
  isError,
  getElementExtension,
  parseFilePath,
  formatWithNewLines,
} from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import * as vscode from 'vscode';
import {
  createNewWorkspaceDirectory,
  getWorkspaceUri,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import {
  showFileContent,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import {
  isAutomaticSignOut,
  getMaxParallelRequests,
  getFileExtensionResolution,
} from '../../settings/settings';
import {
  isErrorEndevorResponse,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import {
  Element,
  ActionChangeControlValue,
  ErrorResponseType,
  RetrieveElementWithSignoutResponse,
  RetrieveElementWithoutSignoutResponse,
} from '@local/endevor/_doc/Endevor';
import {
  Action,
  Actions,
  SignedOutElementsPayload,
} from '../../store/_doc/Actions';
import {
  RetrieveElementCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import path = require('path');
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { Content } from '@local/endevor/_ext/Endevor';
import { groupBySearchLocationId } from '../utils';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { EndevorId } from '../../store/_doc/v2/Store';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveElementCommand =
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
  async (elementNode?: SelectedElementNode, nodes?: SelectedMultipleNodes) => {
    const logger = createEndevorLogger();
    if (nodes && nodes.length) {
      const elementNodes = filterElementNodes(nodes);
      logger.trace(
        `Retrieve element command was called for ${elementNodes
          .map((node) => {
            const element = node.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${node.name}`;
          })
          .join(',\n')}.`
      );
      if (isAutomaticSignOut()) {
        const groupedElementNodes = groupBySearchLocationId(elementNodes);
        for (const elementNodesGroup of Object.values(groupedElementNodes)) {
          await retrieveMultipleElementsWithSignoutOption(logger)(
            dispatch,
            getConnectionConfiguration
          )(elementNodesGroup);
        }
        return;
      }
      await retrieveMultipleElements(logger)(
        dispatch,
        getConnectionConfiguration
      )(elementNodes);
      return;
    } else if (elementNode) {
      logger.updateContext({
        serviceId: elementNode.serviceId,
        searchLocationId: elementNode.searchLocationId,
      });
      logger.traceWithDetails(
        `Retrieve element command was called for ${elementNode.element.environment}/${elementNode.element.stageNumber}/${elementNode.element.system}/${elementNode.element.subSystem}/${elementNode.element.type}/${elementNode.name}.`
      );
      if (isAutomaticSignOut()) {
        await retrieveSingleElementWithSignoutOption(
          dispatch,
          getConnectionConfiguration
        )(elementNode);
        return;
      }
      await retrieveSingleElement(
        dispatch,
        getConnectionConfiguration
      )(elementNode);
      return;
    } else {
      return;
    }
  };

const retrieveSingleElementWithSignoutOption =
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
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.errorWithDetails(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
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
        `CCID and Comment must be specified to sign out element ${name}.`
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
        `Unable to retrieve the element with sign out ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          retrieveResponse = await retrieveSingleElementCopy(dispatch)(
            serviceId,
            searchLocationId
          )(service)(element);
          if (isErrorEndevorResponse(retrieveResponse)) {
            const copyErrorResponse = retrieveResponse;
            // TODO: format using all possible error details
            const copyError = new Error(
              `Unable to retrieve a copy of element ${
                element.name
              } because of error:${formatWithNewLines(
                copyErrorResponse.details.messages
              )}`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
              error: copyError,
            });
            logger.errorWithDetails(
              `Unable to retrieve a copy of element ${element.name}.`,
              `${copyError.message}.`
            );
            return;
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to retrieve element with sign out ${element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const saveResult = await saveIntoWorkspace(workspaceUri)(
      serviceId.name,
      searchLocationId.name
    )(element, retrieveResponse.result.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.errorWithDetails(
        `Unable to save element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.errorWithDetails(
        `Unable to open element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
      status: RetrieveElementCommandCompletedStatus.SUCCESS,
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
      serviceId,
      searchLocationId,
    });
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)(element)(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveWithSignoutResponse)) {
      const errorResponse = retrieveWithSignoutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${element.name} cannot be retrieved with signout because it is signed out to somebody else.`
          );
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(
              `Override signout option was not chosen for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}.`
            );
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithOverrideSignout(dispatch)(
              serviceId,
              searchLocationId
            )(service)(element)(signoutChangeControlValue);
          updateTreeAfterSuccessfulSignout(dispatch)({
            serviceId,
            searchLocationId,
            elements: [element],
          });
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return retrieveWithOverrideSignoutResponse;
        }
        default:
          return errorResponse;
      }
    }
    updateTreeAfterSuccessfulSignout(dispatch)({
      serviceId,
      searchLocationId,
      elements: [element],
    });
    return retrieveWithSignoutResponse;
  };

const retrieveSingleElementWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) =>
    withNotificationProgress(
      `Retrieving element ${element.name} with signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignoutAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)({
        signoutChangeControlValue,
      });
    });

const retrieveSingleElementWithOverrideSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> =>
    withNotificationProgress(
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

const retrieveSingleElementCopy =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  async (element: Element): Promise<RetrieveElementWithoutSignoutResponse> => {
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
  (actionPayload: SignedOutElementsPayload): void => {
    dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      ...actionPayload,
    });
  };

const saveIntoWorkspace =
  (workspaceUri: vscode.Uri) =>
  (serviceName: string, locationName: string) =>
  async (
    element: Element,
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    const file = toFileDescription(element)(serviceName, locationName);
    const elementDir = file.workspaceDirectoryPath;
    const directoryToSave = await createNewWorkspaceDirectory(workspaceUri)(
      elementDir
    );
    const saveResult = await saveFileIntoWorkspaceFolder(directoryToSave)(
      file,
      elementContent
    );
    if (isError(saveResult)) {
      const error = saveResult;
      return new Error(
        `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} into the file system because of error:\n${error.message}`
      );
    }
    const savedFileUri = saveResult;
    return savedFileUri;
  };

const toFileDescription =
  (element: Element) => (serviceName: string, locationName: string) => {
    const elementDir = path.join(
      `/`,
      serviceName,
      locationName,
      element.system,
      element.subSystem,
      element.type
    );
    const fileExtResolution = getFileExtensionResolution();
    switch (fileExtResolution) {
      case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
        return {
          fileName: element.name,
          fileExtension: getElementExtension(element),
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_TYPE_EXT:
        return {
          fileName: element.name,
          fileExtension: element.extension,
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_NAME: {
        const { fileName, fileExtension } = parseFilePath(element.name);
        return {
          fileName,
          fileExtension,
          workspaceDirectoryPath: elementDir,
        };
      }
      default:
        throw new UnreachableCaseError(fileExtResolution);
    }
  };

const showElementInEditor = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  try {
    await showFileContent(fileUri);
  } catch (e) {
    return new Error(
      `Unable to open file ${fileUri.fsPath} because of error ${e.message}`
    );
  }
};

const retrieveSingleElement =
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
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: SelectedElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.errorWithDetails(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service } = connectionParams;
    const retrieveResponse = await retrieveSingleElementCopy(dispatch)(
      serviceId,
      searchLocationId
    )(service)(element);
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${
          element.type
        }/${name} because of error:${formatWithNewLines(
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to retrieve element ${name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const saveResult = await saveIntoWorkspace(workspaceUri)(
      serviceId.name,
      searchLocationId.name
    )(element, retrieveResponse.result.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.errorWithDetails(
        `Unable to save element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.errorWithDetails(
        `Unable to open element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
      status: RetrieveElementCommandCompletedStatus.SUCCESS,
    });
  };

export const retrieveMultipleElements =
  (logger: EndevorLogger) =>
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
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { name, serviceId, searchLocationId, element } = elementNode;
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service } = connectionParams;
      elementDetails.push({
        element,
        service,
        serviceId,
        searchLocationId,
      });
    }
    const validElementDetails = elementDetails
      .map((element) => {
        if (isError(element)) return undefined;
        return element;
      })
      .filter(isDefined);
    const retrievedContentResponses = await retrieveMultipleElementCopies(
      dispatch
    )(endevorMaxRequestsNumber)(validElementDetails);
    const invalidElements = elementDetails
      .map((element) => {
        if (!isError(element)) return undefined;
        const error = element;
        return error;
      })
      .filter(isDefined);
    const retrieveResults = [
      ...retrievedContentResponses,
      ...invalidElements,
    ].map((result) => {
      if (isError(result)) {
        const error = result;
        return error;
      }
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const element = elementDetails.element;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${element.type}/${
            element.name
          }} because of error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        switch (errorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
              status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return error;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
              status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return error;
          case ErrorResponseType.GENERIC_ERROR:
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
              status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return error;
          default:
            throw new UnreachableCaseError(errorResponse.type);
        }
      }
      return {
        element: elementDetails,
        content: retrieveResponse,
      };
    });
    const saveResults = await Promise.all(
      retrieveResults.map(async (result) => {
        if (isError(result)) {
          const error = result;
          return error;
        }
        const saveResult = await saveIntoWorkspace(workspaceUri)(
          result.element.serviceId.name,
          result.element.searchLocationId.name
        )(result.element.element, result.content.result.content);
        if (isError(saveResult)) {
          const error = saveResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        return saveResult;
      })
    );
    // show text editors only in sequential order (concurrency: 1)
    const sequentialShowing = 1;
    const showResults = await new PromisePool(
      saveResults.map((saveResult) => {
        if (!isError(saveResult) && saveResult) {
          const savedElementUri = saveResult;
          return async () => {
            const showResult = await showElementInEditor(savedElementUri);
            if (isError(showResult)) {
              const error = showResult;
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return Promise.resolve(error);
            }
            return Promise.resolve(showResult);
          };
        }
        const error = saveResult;
        return () => Promise.resolve(error);
      }),
      {
        concurrency: sequentialShowing,
      }
    ).start();
    const overallErrors = showResults
      .map((value) => {
        if (isError(value)) return value;
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
          status: RetrieveElementCommandCompletedStatus.SUCCESS,
        });
        return undefined;
      })
      .filter(isDefined);
    if (overallErrors.length) {
      const elementNames = elementNodes
        .map((element) => element.name)
        .join(', ');
      const elementsPaths = elementNodes
        .map((elementNode) => {
          const element = elementNode.element;
          return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
        })
        .join(',\n ');
      logger.error(
        `There were some issues during retrieving of elements ${elementNames}.`,
        `There were some issues during retrieving of elements ${elementsPaths}: ${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}.`
      );
    }
  };

type ElementDetails = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  service: EndevorAuthorizedService;
  element: Element;
}>;

const retrieveMultipleElementCopies =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  async (
    elements: ReadonlyArray<ElementDetails>
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithoutSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving element copies ${elements
          .map((element) => element.element.name)
          .join(', ')} ...`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementAndLogActivity(
                setLogActivityContext(dispatch, {
                  serviceId: element.serviceId,
                  searchLocationId: element.searchLocationId,
                  element: element.element,
                })
              )(toSeveralTasksProgress(progressReporter)(elements.length))(
                element.service
              )(element.element);
            };
          }),
          {
            concurrency: endevorMaxRequestsNumber,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [elements[index]!, retrievedContent];
    });
  };

const retrieveMultipleElementsWithSignoutOption =
  (logger: EndevorLogger) =>
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
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementNode = elementNodes[0]!;
    const connectionParams = await getConnectionConfiguration(
      firstElementNode.serviceId,
      firstElementNode.searchLocationId
    );
    if (!connectionParams) return;
    const { searchLocation } = connectionParams;
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out element.`,
        'Retrieve elements command cancelled.'
      );
      return;
    }
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { name, element, serviceId, searchLocationId } = elementNode;
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service } = connectionParams;
      elementDetails.push({
        element,
        service,
        serviceId,
        searchLocationId,
      });
    }
    const validElementDetails = elementDetails
      .map((element) => {
        if (isError(element)) return undefined;
        return element;
      })
      .filter(isDefined);
    const retrieveResults = await complexRetrieveMultipleElements(logger)(
      dispatch
    )(endevorMaxRequestsNumber)(validElementDetails)(signoutChangeControlValue);
    const allResults = await new PromisePool(
      retrieveResults.map(([elementDetails, retrieveResponse]) => {
        const retrieveMainElementCallback: () => Promise<
          [ElementDetails, string | Error]
        > = async () => {
          if (!isErrorEndevorResponse(retrieveResponse)) {
            const successRetrieve: [ElementDetails, Content] = [
              elementDetails,
              retrieveResponse.result.content,
            ];
            return successRetrieve;
          }
          const errorResponse = retrieveResponse;
          const element = elementDetails.element;
          // TODO: format using all possible error details
          const error = new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          switch (errorResponse.type) {
            case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
              const retrieveCopyResponse = await retrieveSingleElementCopy(
                dispatch
              )(
                elementDetails.serviceId,
                elementDetails.searchLocationId
              )(elementDetails.service)(elementDetails.element);
              if (isErrorEndevorResponse(retrieveCopyResponse)) {
                const retrieveCopyErrorResponse = retrieveCopyResponse;
                const element = elementDetails.element;
                // TODO: format using all possible error details
                const retrieveCopyError = new Error(
                  `Unable to retrieve a copy of element ${
                    element.environment
                  }/${element.stageNumber}/${element.system}/${
                    element.subSystem
                  }/${element.type}/${
                    element.name
                  } because of error:${formatWithNewLines(
                    retrieveCopyErrorResponse.details.messages
                  )}`
                );
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.ERROR,
                  errorContext:
                    TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
                  status:
                    SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
                  error: retrieveCopyError,
                });
                return [elementDetails, retrieveCopyError];
              }
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
                context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
                status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
              });
              return [elementDetails, retrieveCopyResponse.result.content];
            }
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
              // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return [elementDetails, error];
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return [elementDetails, error];
            case ErrorResponseType.GENERIC_ERROR:
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return [elementDetails, error];
            default:
              throw new UnreachableCaseError(errorResponse.type);
          }
        };
        return retrieveMainElementCallback;
      }),
      {
        concurrency: endevorMaxRequestsNumber,
      }
    ).start();
    const savedElements = await Promise.all(
      allResults.map(async ([elementDetails, content]) => {
        if (isError(content)) return content;
        const saveResult = await saveIntoWorkspace(workspaceUri)(
          elementDetails.serviceId.name,
          elementDetails.searchLocationId.name
        )(elementDetails.element, content);
        if (isError(saveResult)) {
          const error = saveResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        return saveResult;
      })
    );
    // show text editors only in sequential order (concurrency: 1)
    const sequentialShowing = 1;
    const showedElements = await new PromisePool(
      savedElements.map((result) => {
        if (!isError(result) && result) {
          const savedElementUri = result;
          return async () => {
            const showResult = await showElementInEditor(savedElementUri);
            if (isError(showResult)) {
              const error = showResult;
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return Promise.resolve(error);
            }
            return Promise.resolve(showResult);
          };
        }
        const error = result;
        return () => Promise.resolve(error);
      }),
      {
        concurrency: sequentialShowing,
      }
    ).start();
    const overallErrors = showedElements
      .map((value) => {
        if (isError(value)) return value;
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
          status: RetrieveElementCommandCompletedStatus.SUCCESS,
        });
        return undefined;
      })
      .filter(isDefined);
    if (overallErrors.length) {
      const elementNames = elementNodes
        .map((element) => element.name)
        .join(', ');
      const elementsPaths = elementNodes
        .map((elementNode) => {
          const element = elementNode.element;
          return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
        })
        .join(',\n ');
      logger.error(
        `There were some issues during retrieving of elements ${elementNames}`,
        `There were some issues during retrieving of elements ${elementsPaths}:\n${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}`
      );
    }
  };

const complexRetrieveMultipleElements =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: EndevorId;
      searchLocationId: EndevorId;
      service: EndevorAuthorizedService;
      element: Element;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      dispatch
    )(endevorMaxRequestsNumber)(elements)(signoutChangeControlValue);
    const successRetrievedElementsWithSignout = withoutErrors(
      retrieveWithSignoutResult
    );
    const notRetrievedElementsWithSignout = allErrors(
      retrieveWithSignoutResult
    );
    const firstAttemptWasSuccessful = !notRetrievedElementsWithSignout.length;
    if (firstAttemptWasSuccessful) {
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    const genericErrorsAfterSignoutRetrieve = genericErrors(
      retrieveWithSignoutResult
    );
    genericErrorsAfterSignoutRetrieve.forEach(([, error]) =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      })
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      logger.trace(
        `Unable to retrieve elements ${notRetrievedElementsWithSignout
          .map(
            ([elementDetails]) =>
              `${elementDetails.element.environment}/${elementDetails.element.stageNumber}/${elementDetails.element.system}/${elementDetails.element.subSystem}/${elementDetails.element.type}/${elementDetails.element.name}`
          )
          .join(',\n ')} with signout.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    const signoutErrorsAfterSignoutRetrieve = signoutErrors(
      retrieveWithSignoutResult
    );
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve
        .map((elementDetails) => elementDetails.element.name)
        .join(
          ', '
        )} cannot be retrieved with signout because they are signed out to somebody else.`
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve
          .map(
            (elementDetails) =>
              `${elementDetails.element.environment}/${elementDetails.element.stageNumber}/${elementDetails.element.system}/${elementDetails.element.subSystem}/${elementDetails.element.type}/${elementDetails.element.name}`
          )
          .join(',\n ')} copies will be retrieved.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    logger.trace(
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve
        .map(
          (elementDetails) =>
            `${elementDetails.element.environment}/${elementDetails.element.stageNumber}/${elementDetails.element.system}/${elementDetails.element.subSystem}/${elementDetails.element.type}/${elementDetails.element.name}`
        )
        .join(',\n ')} will be retrieved with override signout.`
    );
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(dispatch)(
        endevorMaxRequestsNumber
      )(signoutErrorsAfterSignoutRetrieve)(signoutChangeControlValue);
    const successRetrievedElementsWithOverrideSignout = withoutErrors(
      retrieveWithOverrideSignoutResult
    );
    const signedOutElements = toSignedOutElementsPayload([
      ...[
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map(([signedOutElement]) => signedOutElement),
    ]);
    updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    return [
      ...successRetrievedElementsWithSignout,
      ...successRetrievedElementsWithOverrideSignout,
    ];
  };

const retrieveMultipleElementsWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: EndevorId;
      searchLocationId: EndevorId;
      service: EndevorAuthorizedService;
      element: Element;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements ${elements
          .map((element) => element.element.name)
          .join(', ')} with signout ...`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignoutAndLogActivity(
                setLogActivityContext(dispatch, {
                  serviceId: element.serviceId,
                  searchLocationId: element.searchLocationId,
                  element: element.element,
                })
              )(toSeveralTasksProgress(progressReporter)(elements.length))(
                element.service
              )(element.element)({
                signoutChangeControlValue,
              });
            };
          }),
          {
            concurrency: endevorMaxRequestsNumber,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [elements[index]!, retrievedContent];
    });
  };

const retrieveMultipleElementsWithOverrideSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: EndevorId;
      searchLocationId: EndevorId;
      service: EndevorAuthorizedService;
      element: Element;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements ${elements
          .map((element) => element.element.name)
          .join(', ')} with override signout ...`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignoutAndLogActivity(
                setLogActivityContext(dispatch, {
                  serviceId: element.serviceId,
                  searchLocationId: element.searchLocationId,
                  element: element.element,
                })
              )(toSeveralTasksProgress(progressReporter)(elements.length))(
                element.service
              )(element.element)({
                signoutChangeControlValue,
                overrideSignOut: true,
              });
            };
          }),
          {
            concurrency: endevorMaxRequestsNumber,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [elements[index]!, retrievedContent];
    });
  };

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
): ReadonlyArray<ElementDetails> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        switch (errorResponse.type) {
          case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
            return elementDetails;
          default:
            return undefined;
        }
      }
      return undefined;
    })
    .filter(isDefined);
};

const genericErrors = (
  input: ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const element = elementDetails.element;
        if (errorResponse.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR) {
          return undefined;
        }
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } with sign out because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          ),
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const allErrors = (
  input: ReadonlyArray<
    [
      ElementDetails,
      RetrieveElementWithSignoutResponse | RetrieveElementWithSignoutResponse
    ]
  >
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      const element = elementDetails.element;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } with sign out because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          ),
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const withoutErrors = (
  input: ReadonlyArray<
    [
      ElementDetails,
      RetrieveElementWithSignoutResponse | RetrieveElementWithSignoutResponse
    ]
  >
): ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, RetrieveElementWithSignoutResponse] =
        [elementDetails, retrieveResponse];
      return mappedValue;
    })
    .filter(isDefined);
};

const toSignedOutElementsPayload = (
  signedOutElements: ReadonlyArray<ElementDetails>
): SignedOutElementsPayload => {
  // The accumulator should contain only elements, everything else will be filled within the reducer.
  // This is the most understandable way to initialize the accumulator.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const accumulator: SignedOutElementsPayload = {
    elements: [],
  } as unknown as SignedOutElementsPayload;
  return signedOutElements.reduce((acc, signedOutElement) => {
    return {
      serviceId: signedOutElement.serviceId,
      searchLocationId: signedOutElement.searchLocationId,
      elements: [...acc.elements, signedOutElement.element],
    };
  }, accumulator);
};
