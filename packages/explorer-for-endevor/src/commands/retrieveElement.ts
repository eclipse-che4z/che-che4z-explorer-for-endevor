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
  retrieveElementWithoutSignout,
  retrieveElementWithSignout,
} from '../endevor';
import { logger, reporter } from '../globals';
import {
  filterElementNodes,
  isDefined,
  isError,
  groupBySearchLocationId,
  getElementExtension,
  parseFilePath,
} from '../utils';
import { ElementNode } from '../tree/_doc/ElementTree';
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
} from '../settings/settings';
import { isSignoutError, toSeveralTasksProgress } from '@local/endevor/utils';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';
import {
  Service,
  Element,
  ElementSearchLocation,
  ActionChangeControlValue,
  ElementContent,
} from '@local/endevor/_doc/Endevor';
import {
  Action,
  Actions,
  SignedOutElementsPayload,
} from '../store/_doc/Actions';
import {
  RetrieveElementCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';
import { Id } from '../store/storage/_doc/Storage';
import { FileExtensionResolutions } from '../settings/_doc/v2/Settings';
import path = require('path');
import { UnreachableCaseError } from '@local/endevor/typeHelpers';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveElementCommand = async (
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
        await retrieveMultipleElementsWithSignoutOption(dispatch)(
          elementNodesGroup
        );
      }
      return;
    }
    await retrieveMultipleElements(elementNodes);
    return;
  } else if (elementNode) {
    logger.trace(
      `Retrieve element command was called for ${elementNode.name}.`
    );
    if (isAutomaticSignOut()) {
      await retrieveSingleElementWithSignoutOption(dispatch)(elementNode);
      return;
    }
    await retrieveSingleElement(elementNode);
    return;
  } else {
    return;
  }
};

const retrieveSingleElementWithSignoutOption =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    element: Readonly<{
      name: string;
      uri: vscode.Uri;
    }>
  ): Promise<void> => {
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
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: elementUri.searchLocation.ccid,
      comment: elementUri.searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out element ${element.name}.`
      );
      return;
    }
    const retrievedContent = await complexRetrieve(dispatch)(
      elementUri.serviceId,
      elementUri.service,
      elementUri.searchLocationId,
      elementUri.searchLocation
    )(elementUri.element)(signoutChangeControlValue);
    if (isError(retrievedContent)) {
      const error = retrievedContent;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `${error.message}.`
      );
      return;
    }
    const saveResult = await saveIntoWorkspace(workspaceUri)(
      elementUri.serviceId.name,
      elementUri.searchLocationId.name
    )(elementUri.element, retrievedContent);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save the element ${element.name} into the file system.`,
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
        `Unable to open the element ${element.name} for editing.`,
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
    searchLocationId: Id,
    _searchLocation: ElementSearchLocation
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementContent | Error> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout(
      service
    )(element)(signoutChangeControlValue);
    if (!isError(retrieveWithSignoutResult)) {
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceId,
        searchLocationId,
        elements: [element],
      });
    }
    if (isSignoutError(retrieveWithSignoutResult)) {
      logger.warn(
        `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      });
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        logger.trace(
          `Override signout option was not chosen, ${element.name} copy will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleElementCopy(service)(
          element
        );
        if (isError(retrieveCopyResult)) {
          const error = retrieveCopyResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
        return retrieveCopyResult;
      }
      logger.trace(
        `Override signout option was chosen, ${element.name} will be retrieved with override signout.`
      );
      const retrieveWithOverrideResult =
        await retrieveSingleElementWithOverrideSignout(service)(element)(
          signoutChangeControlValue
        );
      if (isError(retrieveWithOverrideResult)) {
        logger.warn(
          `Override signout retrieve was not successful, a copy of ${element.name} will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleElementCopy(service)(
          element
        );
        if (isError(retrieveCopyResult)) {
          const error = retrieveCopyResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
        return retrieveCopyResult;
      }
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceId,
        searchLocationId,
        elements: [element],
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return retrieveWithOverrideResult;
    }
    if (isError(retrieveWithSignoutResult)) {
      const error = retrieveWithSignoutResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
    }
    return retrieveWithSignoutResult;
  };

const retrieveSingleElementWithSignout =
  (service: Service) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) =>
    withNotificationProgress(
      `Retrieving element with signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(element)({
        signoutChangeControlValue,
      });
    });

const retrieveSingleElementWithOverrideSignout =
  (service: Service) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) =>
    withNotificationProgress(
      `Retrieving element with override signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
    });

const retrieveSingleElementCopy =
  (service: Service) => async (element: Element) => {
    return withNotificationProgress(
      `Retrieving element copy : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithoutSignout(progressReporter)(service)(element);
    });
  };

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
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
        `Unable to save the element ${element.name} into the file system because of error ${error.message}`
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

const retrieveSingleElement = async (
  element: Readonly<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
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
  const elementUri = fromTreeElementUri(element.uri);
  if (isError(elementUri)) {
    const error = elementUri;
    logger.error(
      `Unable to retrieve the element ${element.name}.`,
      `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const retrieveResult = await retrieveSingleElementCopy(elementUri.service)(
    elementUri.element
  );
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(
      `Unable to retrieve the element ${element.name}.`,
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
  const saveResult = await saveIntoWorkspace(workspaceUri)(
    elementUri.serviceId.name,
    elementUri.searchLocationId.name
  )(elementUri.element, retrieveResult);
  if (isError(saveResult)) {
    const error = saveResult;
    logger.error(
      `Unable to save the element ${element.name} into the file system.`,
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
      `Unable to open the element ${element.name} for editing.`,
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

export const retrieveMultipleElements = async (
  elements: ReadonlyArray<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
    commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
    elementsAmount: elements.length,
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
  const elementUris = elements.map((element) => {
    const elementsUploadOptions = fromTreeElementUri(element.uri);
    if (isError(elementsUploadOptions)) {
      const error = elementsUploadOptions;
      return new Error(
        `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}`
      );
    }
    return elementsUploadOptions;
  });
  const validUris = elementUris
    .map((uri) => {
      if (isError(uri)) return undefined;
      return uri;
    })
    .filter(isDefined);
  const retrievedContents = await retrieveMultipleElementCopies(
    endevorMaxRequestsNumber
  )(validUris);
  const invalidUris = elementUris
    .map((uri) => {
      if (!isError(uri)) return undefined;
      const error = uri;
      return error;
    })
    .filter(isDefined);
  const retrieveResults = [...retrievedContents, ...invalidUris].map(
    (result) => {
      if (isError(result)) {
        const error = result;
        return error;
      }
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        const error = retrieveResult;
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          status: RetrieveElementCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return error;
      }
      return {
        element: elementDetails,
        content: retrieveResult,
      };
    }
  );
  const saveResults = await Promise.all(
    retrieveResults.map(async (result) => {
      if (isError(result)) {
        const error = result;
        return error;
      }
      const saveResult = await saveIntoWorkspace(workspaceUri)(
        result.element.serviceId.name,
        result.element.searchLocationId.name
      )(result.element.element, result.content);
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
    const elementNames = elements.map((element) => element.name).join(', ');
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
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

const retrieveMultipleElementCopies =
  (endevorMaxRequestsNumber: number) =>
  async (
    elements: ReadonlyArray<ElementDetails>
  ): Promise<ReadonlyArray<[ElementDetails, Error | ElementContent]>> => {
    return (
      await withNotificationProgress(
        `Retrieving element copies: ${elements
          .map((element) => element.element.name)
          .join(', ')}`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithoutSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element);
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
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    elements: ReadonlyArray<{
      name: string;
      uri: vscode.Uri;
    }>
  ): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elements.length,
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
    const firstElementUriParams = fromTreeElementUri(elements[0]!.uri);
    if (isError(firstElementUriParams)) {
      const error = firstElementUriParams;
      logger.error(
        `Unable to show the change control value dialog.`,
        `Unable to show the change control value dialog because of an error ${error.message}.`
      );
      return;
    }
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: firstElementUriParams.searchLocation.ccid,
      comment: firstElementUriParams.searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(`CCID and Comment must be specified to sign out element.`);
      return;
    }
    const elementUris: ReadonlyArray<ElementDetails | Error> = elements.map(
      (element) => {
        const elementUploadOptions = fromTreeElementUri(element.uri);
        if (isError(elementUploadOptions)) {
          const error = elementUploadOptions;
          return new Error(
            `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}`
          );
        }
        return elementUploadOptions;
      }
    );
    const validUris = elementUris
      .map((uri) => {
        if (isError(uri)) return undefined;
        return uri;
      })
      .filter(isDefined);
    const retrieveResult = await complexRetrieveMultipleElements(dispatch)(
      endevorMaxRequestsNumber
    )(validUris)(signoutChangeControlValue);
    const invalidUris = elementUris
      .map((uri) => {
        if (!isError(uri)) return undefined;
        return uri;
      })
      .filter(isDefined);
    const overallRetrieveResult = [...invalidUris, ...retrieveResult];
    const savedElements = await Promise.all(
      overallRetrieveResult.map(async (result) => {
        if (isError(result)) {
          const error = result;
          return error;
        }
        const [elementDetails, retrievedContent] = result;
        if (isError(retrievedContent)) {
          const error = retrievedContent;
          return error;
        }
        const saveResult = await saveIntoWorkspace(workspaceUri)(
          elementDetails.serviceId.name,
          elementDetails.searchLocationId.name
        )(elementDetails.element, retrievedContent);
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
      const elementNames = elements.map((element) => element.name).join(', ');
      logger.error(
        `There were some issues during retrieving of the elements ${elementNames}`,
        `There were some issues during retrieving of the elements ${elementNames}: ${[
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
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ReadonlyArray<[ElementDetails, Error | ElementContent]>> => {
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
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
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
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
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
      const retrieveCopiesResult = await retrieveMultipleElementCopies(
        endevorMaxRequestsNumber
      )(signoutErrorsAfterSignoutRetrieve);
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      allErrors(retrieveCopiesResult).forEach(([, error]) => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
      });
      withoutErrors(retrieveCopiesResult).forEach(() => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
      });
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveCopiesResult,
      ];
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
    const notRetrievedElementsWithOverrideSignout = allErrors(
      retrieveWithOverrideSignoutResult
    );
    const secondAttemptWasSuccessful =
      !notRetrievedElementsWithOverrideSignout.length;
    if (secondAttemptWasSuccessful) {
      const signedOutElements = toSignedOutElementsPayload([
        ...[
          ...successRetrievedElementsWithSignout,
          ...successRetrievedElementsWithOverrideSignout,
        ].map(([signedOutElement]) => signedOutElement),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      successRetrievedElementsWithOverrideSignout.forEach(() => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
        });
      });
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveWithOverrideSignoutResult,
      ];
    }
    logger.warn(
      `Override signout retrieve was not successful, the copies of ${notRetrievedElementsWithOverrideSignout
        .map(([elementDetails]) => elementDetails.element.name)
        .join(', ')} will be retrieved.`
    );
    const signedOutElements = toSignedOutElementsPayload([
      ...[
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map(([signedOutElement]) => signedOutElement),
    ]);
    await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    const retrieveCopiesResult = await retrieveMultipleElementCopies(
      endevorMaxRequestsNumber
    )(
      notRetrievedElementsWithOverrideSignout.map(
        ([elementDetails]) => elementDetails
      )
    );
    allErrors(retrieveCopiesResult).forEach(([, error]) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
    });
    withoutErrors(retrieveCopiesResult).forEach(() => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
      });
    });
    return [
      ...successRetrievedElementsWithSignout,
      ...genericErrorsAfterSignoutRetrieve,
      ...successRetrievedElementsWithOverrideSignout,
      ...retrieveCopiesResult,
    ];
  };

const retrieveMultipleElementsWithSignout =
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceId: Id;
      searchLocationId: Id;
      service: Service;
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ReadonlyArray<[ElementDetails, Error | ElementContent]>> => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with signout`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element)({
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
      element: Element;
      searchLocation: ElementSearchLocation;
    }>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ReadonlyArray<[ElementDetails, Error | ElementContent]>> => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with override signout`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element)({
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
  input: ReadonlyArray<[ElementDetails, Error | ElementContent]>
): ReadonlyArray<ElementDetails> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isSignoutError(retrieveResult)) {
        return elementDetails;
      }
      return undefined;
    })
    .filter(isDefined);
};

const genericErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementContent]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult) && !isSignoutError(retrieveResult)) {
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          retrieveResult,
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const allErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementContent]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          retrieveResult,
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const withoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementContent]>
): ReadonlyArray<[ElementDetails, ElementContent]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementContent] = [
        elementDetails,
        retrieveResult,
      ];
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
