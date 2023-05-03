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

import { retrieveElement, retrieveElementWithSignout } from '../../endevor';
import { logger, reporter } from '../../globals';
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
  Service,
  Element,
  ActionChangeControlValue,
  Value,
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
  TreeElementCommandArguments,
} from '../../_doc/Telemetry';
import { Id } from '../../store/storage/_doc/Storage';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import path = require('path');
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { Content } from '@local/endevor/_ext/Endevor';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
  groupBySearchLocationId,
} from '../utils';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveElementCommand = async (
  configurations: ConnectionConfigurations,
  dispatch: (action: Action) => Promise<void>,
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes && nodes.length) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Retrieve element command was called for ${elementNodes
        .map((node) => node.name)
        .join(', ')}.`
    );
    if (isAutomaticSignOut()) {
      const groupedElementNodes = groupBySearchLocationId(elementNodes);
      for (const elementNodesGroup of Object.values(groupedElementNodes)) {
        await retrieveMultipleElementsWithSignoutOption(
          configurations,
          dispatch
        )(elementNodesGroup);
      }
      return;
    }
    await retrieveMultipleElements(configurations)(elementNodes);
    return;
  } else if (elementNode) {
    logger.trace(
      `Retrieve element command was called for ${elementNode.name}.`
    );
    if (isAutomaticSignOut()) {
      await retrieveSingleElementWithSignoutOption(
        configurations,
        dispatch
      )(elementNode);
      return;
    }
    await retrieveSingleElement(configurations)(elementNode);
    return;
  } else {
    return;
  }
};

const retrieveSingleElementWithSignoutOption =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      commandArguments: TreeElementCommandArguments.SINGLE_ELEMENT,
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
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
        `CCID and Comment must be specified to sign out element ${name}.`
      );
      return;
    }
    let retrieveResponse = await complexRetrieve(dispatch)(
      serviceId,
      service,
      configuration,
      searchLocationId,
      searchLocation
    )(element)(signoutChangeControlValue);
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
          retrieveResponse = await retrieveSingleElementCopy(service)(
            configuration
          )(element);
          if (isErrorEndevorResponse(retrieveResponse)) {
            const copyErrorResponse = retrieveResponse;
            // TODO: format using all possible error details
            const copyError = new Error(
              `Unable to retrieve a copy of the element ${
                element.name
              } because of an error:${formatWithNewLines(
                copyErrorResponse.details.messages
              )}`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
              error: copyError,
            });
            logger.error(copyError.message);
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
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to retrieve element with sign out ${element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
      logger.error(
        `Unable to save the element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
  (
    serviceId: Id,
    service: Service,
    configuration: Value,
    searchLocationId: Id,
    _searchLocation: ElementSearchLocation
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      service
    )(configuration)(element)(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveWithSignoutResponse)) {
      const errorResponse = retrieveWithSignoutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          });
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithOverrideSignout(service)(
              configuration
            )(element)(signoutChangeControlValue);
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
  (service: Service) =>
  (configuration: Value) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) =>
    withNotificationProgress(
      `Retrieving element ${element.name} with signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(
        configuration
      )(element)({
        signoutChangeControlValue,
      });
    });

const retrieveSingleElementWithOverrideSignout =
  (service: Service) =>
  (configuration: Value) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> =>
    withNotificationProgress(
      `Retrieving element ${element.name} with override signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(
        configuration
      )(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
    });

const retrieveSingleElementCopy =
  (service: Service) =>
  (configuration: Value) =>
  async (element: Element): Promise<RetrieveElementWithoutSignoutResponse> => {
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
        `Unable to save the element ${element.name} into the file system because of an error:\n${error.message}`
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
      `Unable to open the file ${fileUri.fsPath} because of error ${e.message}`
    );
  }
};

const retrieveSingleElement =
  (configurations: ConnectionConfigurations) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: SelectedElementNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      commandArguments: TreeElementCommandArguments.SINGLE_ELEMENT,
      autoSignOut: false,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration } = connectionParams;
    const retrieveResponse = await retrieveSingleElementCopy(service)(
      configuration
    )(element);
    if (isErrorEndevorResponse(retrieveResponse)) {
      const errorResponse = retrieveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve the element ${name} because of an error:${formatWithNewLines(
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
            status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to retrieve the element ${name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
      logger.error(
        `Unable to save the element ${name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
  (configurations: ConnectionConfigurations) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elementNodes.length,
      autoSignOut: false,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { name, serviceId, searchLocationId, element } = elementNode;
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve the element ${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service, configuration, searchLocation } = connectionParams;
      elementDetails.push({
        element,
        service,
        configuration,
        searchLocation,
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
      endevorMaxRequestsNumber
    )(validElementDetails);
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
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve the element ${
            elementDetails.element.name
          } because of an error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        switch (errorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
              status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return error;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
              status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return error;
          case ErrorResponseType.GENERIC_ERROR:
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
                errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
      logger.error(
        `There were some issues during retrieving of the elements ${elementNames}.`,
        `There were some issues during retrieving of the elements ${elementNames}: ${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}.`
      );
    }
  };

type ElementDetails = Readonly<{
  serviceId: Id;
  searchLocationId: Id;
  service: Service;
  configuration: Value;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

const retrieveMultipleElementCopies =
  (endevorMaxRequestsNumber: number) =>
  async (
    elements: ReadonlyArray<ElementDetails>
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithoutSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving element copies: ${elements
          .map((element) => element.element.name)
          .join(', ')}`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElement(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.configuration)(element.element);
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
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elementNodes.length,
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementNode = elementNodes[0]!;
    const connectionParams = await getConnectionConfiguration(configurations)(
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
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve the element ${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service, configuration, searchLocation } = connectionParams;
      elementDetails.push({
        element,
        service,
        configuration,
        searchLocation,
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
    const retrieveResults = await complexRetrieveMultipleElements(dispatch)(
      endevorMaxRequestsNumber
    )(validElementDetails)(signoutChangeControlValue);
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
          // TODO: format using all possible error details
          const error = new Error(
            `Unable to retrieve the element ${
              elementDetails.element.name
            } because of an error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          switch (errorResponse.type) {
            case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
              const retrieveCopyResponse = await retrieveSingleElementCopy(
                elementDetails.service
              )(elementDetails.configuration)(elementDetails.element);
              if (isErrorEndevorResponse(retrieveCopyResponse)) {
                const retrieveCopyErrorResponse = retrieveCopyResponse;
                // TODO: format using all possible error details
                const retrieveCopyError = new Error(
                  `Unable to retrieve a copy of the element ${
                    elementDetails.element.name
                  } because of an error:${formatWithNewLines(
                    retrieveCopyErrorResponse.details.messages
                  )}`
                );
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.ERROR,
                  errorContext:
                    TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
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
                errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return [elementDetails, error];
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
                status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
                error,
              });
              return [elementDetails, error];
            case ErrorResponseType.GENERIC_ERROR:
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
            errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
                errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
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
      logger.error(
        `There were some issues during retrieving of the elements ${elementNames}`,
        `There were some issues during retrieving of the elements ${elementNames}:\n${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}`
      );
    }
  };

const complexRetrieveMultipleElements =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: Id;
      searchLocationId: Id;
      service: Service;
      configuration: Value;
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      endevorMaxRequestsNumber
    )(elements)(signoutChangeControlValue);
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
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      })
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      logger.trace(
        `Unable to retrieve the elements ${notRetrievedElementsWithSignout
          .map(([elementDetails]) => elementDetails.element.name)
          .join(', ')} with signout.`
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
    signoutErrorsAfterSignoutRetrieve.forEach(() =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      })
    );
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve
        .map((elementDetails) => elementDetails.element.name)
        .join(
          ', '
        )} cannot be retrieved with signout because the elements are signed out to somebody else.`
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve
          .map((elementDetails) => elementDetails.element.name)
          .join(', ')} copies will be retrieved.`
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
        .map((elementDetails) => elementDetails.element.name)
        .join(', ')} will be retrieved with override signout.`
    );
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(
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
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: Id;
      searchLocationId: Id;
      service: Service;
      configuration: Value;
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with signout ...`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.configuration)(element.element)({
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
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: Id;
      searchLocationId: Id;
      service: Service;
      configuration: Value;
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with override signout ...`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.configuration)(element.element)({
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
        if (errorResponse.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR) {
          return undefined;
        }
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          new Error(
            `Unable to retrieve the element ${
              elementDetails.element.name
            } with sign out because of an error:${formatWithNewLines(
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
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          new Error(
            `Unable to retrieve the element ${
              elementDetails.element.name
            } with sign out because of an error:${formatWithNewLines(
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
