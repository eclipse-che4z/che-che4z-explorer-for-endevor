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
  retrieveElementWithoutSignout,
  retrieveElementWithSignout,
  retrieveElementWithOverrideSignout,
} from '../endevor';
import { logger } from '../globals';
import {
  filterElementNodes,
  isDefined,
  isError,
  groupBySearchLocationId,
} from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import * as vscode from 'vscode';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  saveElementIntoWorkspace,
  showSavedElementContent,
} from '../workspace';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import {
  getMaxParallelRequests,
  isAutomaticSignOut,
} from '../settings/settings';
import { isSignoutError, toSeveralTasksProgress } from '@local/endevor/utils';
import {
  MAX_PARALLEL_REQUESTS_DEFAULT,
  AUTOMATIC_SIGN_OUT_DEFAULT,
} from '../constants';
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
import { Action, Actions, SignedOutElementsPayload } from '../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

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
        .join(',')}`
    );
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read settings value for automatic sign out, default: ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead`,
        `Reading settings error: ${e.message}`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
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
    logger.trace(`Retrieve element command was called for ${elementNode.name}`);
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read settings value for automatic sign out, default: ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead`,
        `Reading settings error: ${e.message}`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
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
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      logger.error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      return;
    }
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to retrieve element: ${element.name}`,
        `Unable to retrieve element: ${element.name}, because of ${error.message}`
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
      elementUri.serviceName,
      elementUri.service,
      elementUri.searchLocationName,
      elementUri.searchLocation
    )(elementUri.element)(signoutChangeControlValue);
    if (!retrievedContent) return;
    const saveResult = await saveIntoWorkspace(workspaceUri)(
      elementUri.serviceName,
      elementUri.searchLocationName
    )(elementUri.element, retrievedContent);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(error.message);
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(error.message);
      return;
    }
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    serviceName: string,
    service: Service,
    searchLocationName: string,
    searchLocation: ElementSearchLocation
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementContent | undefined> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout(
      service
    )(element)(signoutChangeControlValue);
    if (!isError(retrieveWithSignoutResult)) {
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        elements: [element],
      });
    }
    if (isSignoutError(retrieveWithSignoutResult)) {
      logger.warn(
        `Element ${element.name} cannot be retrieved with signout, because it is signed out to somebody else.`
      );
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
          logger.error(error.message);
          return;
        }
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
          `Override signout retrieve was not succesful, ${element.name} copy will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleElementCopy(service)(
          element
        );
        if (isError(retrieveCopyResult)) {
          const error = retrieveCopyResult;
          logger.error(error.message);
          return;
        }
        return retrieveCopyResult;
      }
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        elements: [element],
      });
      return retrieveWithOverrideResult;
    }
    if (isError(retrieveWithSignoutResult)) {
      const error = retrieveWithSignoutResult;
      logger.error(error.message);
      return;
    }
    return retrieveWithSignoutResult;
  };

const retrieveSingleElementWithSignout =
  (service: Service) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element with signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(service)(element)(
        signoutChangeControlValue
      );
    });
  };

const retrieveSingleElementWithOverrideSignout =
  (service: Service) =>
  (element: Element) =>
  async (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element with override signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithOverrideSignout(progressReporter)(service)(
        element
      )(signoutChangeControlValue);
    });
  };

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
      type: Actions.ELEMENT_SIGNEDOUT,
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
    const saveResult = await saveElementIntoWorkspace(workspaceUri)(
      serviceName,
      locationName
    )(element, elementContent);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.trace(`Element: ${element.name} persisting error: ${error}`);
      const userMessage = `Element: ${element.name} was not saved into file system`;
      return new Error(userMessage);
    }
    const savedFileUri = saveResult;
    return savedFileUri;
  };

const showElementInEditor = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  const showResult = await showSavedElementContent(fileUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.trace(
      `Element ${fileUri.fsPath} cannot be opened because of: ${error}.`
    );
    return new Error(`Element ${fileUri.fsPath} cannot be opened.`);
  }
};

const retrieveSingleElement = async (
  element: Readonly<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  const workspaceUri = await getWorkspaceUri();
  if (!workspaceUri) {
    logger.error(
      'At least one workspace in this project should be opened to retrieve elements'
    );
    return;
  }
  const elementUri = fromTreeElementUri(element.uri);
  if (isError(elementUri)) {
    const error = elementUri;
    logger.error(
      `Unable to retrieve element: ${element.name}`,
      `Unable to retrieve element: ${element.name}, because of ${error.message}`
    );
    return;
  }
  const retrieveResult = await retrieveSingleElementCopy(elementUri.service)(
    elementUri.element
  );
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(error.message);
    return;
  }
  const saveResult = await saveIntoWorkspace(workspaceUri)(
    elementUri.serviceName,
    elementUri.searchLocationName
  )(elementUri.element, retrieveResult);
  if (isError(saveResult)) {
    const error = saveResult;
    logger.error(error.message);
    return;
  }
  const savedElementUri = saveResult;
  const showResult = await showElementInEditor(savedElementUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.error(error.message);
    return;
  }
};

export const retrieveMultipleElements = async (
  elements: ReadonlyArray<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  const workspaceUri = await getWorkspaceUri();
  if (!workspaceUri) {
    logger.error(
      'At least one workspace in this project should be opened to edit elements'
    );
    return;
  }
  let endevorMaxRequestsNumber: number;
  try {
    endevorMaxRequestsNumber = getMaxParallelRequests();
  } catch (e) {
    logger.warn(
      `Cannot read settings value for endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead`,
      `Reading settings error: ${e.message}`
    );
    endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
  }
  const elementUris = elements.map((element) => {
    const elementsUploadOptions = fromTreeElementUri(element.uri);
    if (isError(elementsUploadOptions)) {
      const error = elementsUploadOptions;
      logger.trace(
        `Unable to edit element ${element.name}, because of ${error.message}`
      );
      return new Error(`Unable to edit element ${element.name}`);
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
      const retrieveResult = result[1];
      if (isError(retrieveResult)) {
        const error = retrieveResult;
        return error;
      }
      return {
        element: result[0],
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
        result.element.serviceName,
        result.element.searchLocationName
      )(result.element.element, result.content);
      if (isError(saveResult)) {
        const error = saveResult;
        return error;
      }
      return saveResult;
    })
  );
  const showResults = await Promise.all(
    saveResults.map((saveResult) => {
      if (!isError(saveResult) && saveResult) {
        const savedElementUri = saveResult;
        return showElementInEditor(savedElementUri);
      }
      const error = saveResult;
      return error;
    })
  );
  const overallErrors = showResults
    .map((value) => {
      if (isError(value)) return value;
      return undefined;
    })
    .filter(isDefined);
  if (overallErrors.length) {
    logger.error(
      `There were some issues during editing elements: ${elements
        .map((element) => element.name)
        .join(', ')}: ${JSON.stringify(
        overallErrors.map((error) => error.message)
      )}`
    );
  }
};

type ElementDetails = Readonly<{
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
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
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      logger.error(
        'At least one workspace in this project should be opened to edit elements'
      );
      return;
    }
    let endevorMaxRequestsNumber: number;
    try {
      endevorMaxRequestsNumber = getMaxParallelRequests();
    } catch (e) {
      logger.warn(
        `Cannot read settings value for endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead`,
        `Reading settings error: ${e.message}`
      );
      endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
    }
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementUriParams = fromTreeElementUri(elements[0]!.uri);
    if (isError(firstElementUriParams)) {
      const error = firstElementUriParams;
      logger.error(
        `Unable to show change control value dialog`,
        `Unable to show change control value dialog, because of ${error.message}`
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
          logger.trace(
            `Unable to edit element ${element.name}, because of ${error.message}`
          );
          return new Error(`Unable to edit element ${element.name}`);
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
        const retrievedContent = result[1];
        if (isError(retrievedContent)) {
          const error = retrievedContent;
          return error;
        }
        const elementDetails = result[0];
        const saveResult = await saveElementIntoWorkspace(workspaceUri)(
          elementDetails.serviceName,
          elementDetails.searchLocationName
        )(elementDetails.element, retrievedContent);
        if (isError(saveResult)) return saveResult;
        return saveResult;
      })
    );
    const showedElements = await Promise.all(
      savedElements.map((result) => {
        if (!isError(result) && result) {
          const savedElementUri = result;
          return showElementInEditor(savedElementUri);
        }
        return result;
      })
    );
    const errors = showedElements
      .map((value) => {
        if (isError(value)) return value;
        return undefined;
      })
      .filter(isDefined);
    if (errors.length) {
      logger.error(
        `There were some issues during editing elements: ${elements
          .map((element) => element.name)
          .join(', ')}: ${JSON.stringify(errors.map((error) => error.message))}`
      );
    }
  };

const complexRetrieveMultipleElements =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (
    elements: ReadonlyArray<{
      serviceName: EndevorServiceName;
      searchLocationName: ElementLocationName;
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
          (signedOutElement) => signedOutElement[0]
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    const genericErrorsAfterSignoutRetrieve = genericErrors(
      retrieveWithSignoutResult
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      logger.trace(
        `Unable to retrieve the ${notRetrievedElementsWithSignout.map(
          (elementDetails) => elementDetails.element.name
        )} with signout.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          (signedOutElement) => signedOutElement[0]
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    const signoutErrorsAfterSignoutRetrieve = signoutErrors(
      retrieveWithSignoutResult
    );
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )} cannot be retrieved with signout, because they are signed out to somebody else.`
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve.map(
          (elementDetails) => elementDetails.element.name
        )} copies will be retrieved.`
      );
      const retrieveCopiesResult = await retrieveMultipleElementCopies(
        endevorMaxRequestsNumber
      )(signoutErrorsAfterSignoutRetrieve);
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          (signedOutElement) => signedOutElement[0]
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveCopiesResult,
      ];
    }
    logger.trace(
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )} will be retrieved with override signout.`
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
        ].map((signedOutElement) => signedOutElement[0]),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveWithOverrideSignoutResult,
      ];
    }
    logger.warn(
      `Override signout retrieve was not succesful, ${notRetrievedElementsWithOverrideSignout.map(
        (elementDetails) => elementDetails.element.name
      )} copies will be retrieved.`
    );
    const signedOutElements = toSignedOutElementsPayload([
      ...[
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map((signedOutElement) => signedOutElement[0]),
    ]);
    await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    const retrieveCopiesResult = await retrieveMultipleElementCopies(
      endevorMaxRequestsNumber
    )(notRetrievedElementsWithOverrideSignout);
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
      serviceName: EndevorServiceName;
      searchLocationName: ElementLocationName;
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
              )(element.service)(element.element)(signoutChangeControlValue);
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
      serviceName: EndevorServiceName;
      searchLocationName: ElementLocationName;
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
              return retrieveElementWithOverrideSignout(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element)(signoutChangeControlValue);
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
      const retrieveResult = result[1];
      if (isSignoutError(retrieveResult)) {
        const elementDetails = result[0];
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
      const retrieveResult = result[1];
      if (isError(retrieveResult) && !isSignoutError(retrieveResult)) {
        const mappedValue: [ElementDetails, Error] = [
          result[0],
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
): ReadonlyArray<ElementDetails> => {
  return input
    .map((result) => {
      const retrieveResult = result[1];
      if (isError(retrieveResult)) {
        const elementDetails = result[0];
        return elementDetails;
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
      const retrieveResult = result[1];
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementContent] = [
        result[0],
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
  return signedOutElements.reduce((accum, signedOutElement) => {
    return {
      serviceName: signedOutElement.serviceName,
      service: signedOutElement.service,
      searchLocationName: signedOutElement.searchLocationName,
      searchLocation: signedOutElement.searchLocation,
      elements: [...accum.elements, signedOutElement.element],
    };
  }, accumulator);
};
