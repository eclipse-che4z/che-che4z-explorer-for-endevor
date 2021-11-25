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
import { isSignoutError, toSeveralTasksProgress } from '@local/endevor/utils';
import {
  getMaxParallelRequests,
  isAutomaticSignOut,
} from '../settings/settings';
import {
  MAX_PARALLEL_REQUESTS_DEFAULT,
  AUTOMATIC_SIGN_OUT_DEFAULT,
} from '../constants';
import { fromTreeElementUri } from '../uri/treeElementUri';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  retrieveElementWithDependenciesWithoutSignout,
  retrieveElementWithDependenciesWithSignout,
  retrieveElementWithDependenciesOverrideSignout,
} from '../endevor';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';
import {
  Element,
  ActionChangeControlValue,
  ServiceInstance,
  ElementWithDependencies,
  Dependency,
  ElementContent,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import { SignoutError } from '@local/endevor/_doc/Error';
import { Action, Actions, SignedOutElementsPayload } from '../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveWithDependencies = async (
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
        await retrieveMultipleElementsWithDepsWithSignout(dispatch)(
          elementNodesGroup
        );
      }
      return;
    }
    await retrieveMultipleElementsWithDeps(elementNodes);
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
      await retrieveSingleElementWithDepsWithSignout(dispatch)(elementNode);
      return;
    }
    await retrieveSingleElementWithDeps(elementNode);
    return;
  } else {
    return;
  }
};

const retrieveSingleElementWithDepsWithSignout =
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
        `CCID and Comment must be specified to sign out element ${element.name}`
      );
      return;
    }
    const retrieveResult = await complexRetrieve(dispatch)(
      {
        service: elementUri.service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      },
      elementUri.searchLocation
    )(
      elementUri.serviceName,
      elementUri.searchLocationName,
      elementUri.element
    )(signoutChangeControlValue);
    if (!retrieveResult) {
      return;
    }
    const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
      elementUri.serviceName,
      elementUri.searchLocationName
    )({
      mainElement: {
        element: elementUri.element,
        content: retrieveResult.content,
      },
      dependencies: retrieveResult.dependencies,
    });
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save element: ${elementUri.element.name}`,
        `Unable to save element: ${elementUri.element.name}, because of ${error.message}`
      );
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to show element: ${element.name}`,
        `Unable to show element: ${element.name}, because of ${error.message}`
      );
      return;
    }
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    { service, requestPoolMaxSize }: ServiceInstance,
    searchLocation: ElementSearchLocation
  ) =>
  (
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName,
    element: Element
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithDependencies | undefined> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout({
      service,
      requestPoolMaxSize,
    })(element)(signoutChangeControlValue);
    if (isSignoutError(retrieveWithSignoutResult)) {
      logger.warn(
        `Element ${element.name} and its dependencies cannot be retrieved with signout, because it is signed out to somebody else.`
      );
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (overrideSignout) {
        logger.trace(
          `Override signout option was chosen, ${element.name} and its dependencies will be retrieved with override signout.`
        );
        const retrieveWithOverrideSignoutResult =
          await retrieveSingleElementWithOverrideSignout({
            service,
            requestPoolMaxSize,
          })(element)(signoutChangeControlValue);
        if (isError(retrieveWithOverrideSignoutResult)) {
          logger.warn(
            `Override signout retrieve was not succesful, copy of ${element.name} and its dependencies will be retrieved.`
          );
          const retrieveCopyResult = await retrieveSingleElementCopy({
            service,
            requestPoolMaxSize,
          })(element);
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
        return retrieveWithOverrideSignoutResult;
      } else {
        logger.trace(
          `Override signout option was not chosen, copy of ${element.name} and its dependencies will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleElementCopy({
          service,
          requestPoolMaxSize,
        })(element);
        if (isError(retrieveCopyResult)) {
          const error = retrieveCopyResult;
          logger.error(error.message);
          return;
        }
        return retrieveCopyResult;
      }
    }
    if (isError(retrieveWithSignoutResult)) {
      const error = retrieveWithSignoutResult;
      logger.error(error.message);
      return;
    }
    await updateTreeAfterSuccessfulSignout(dispatch)({
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements: [element],
    });
    return retrieveWithSignoutResult;
  };

const retrieveSingleElementWithSignout =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element and its depencencies with signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesWithSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element)(signoutChangeControlValue);
    });
  };

const retrieveSingleElementWithOverrideSignout =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element and its depencencies with override signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesOverrideSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element)(signoutChangeControlValue);
    });
  };

const retrieveSingleElementCopy =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) => {
    return withNotificationProgress(
      `Retrieving element copy and its depencencies : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesWithoutSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element);
    });
  };

const saveIntoWorkspaceWithDependencies =
  (workspaceUri: vscode.Uri) =>
  (serviceName: string, locationName: string) =>
  async (elementWithDeps: {
    mainElement: {
      element: Element;
      content: ElementContent;
    };
    dependencies: ReadonlyArray<[Dependency, ElementContent | Error]>;
  }): Promise<vscode.Uri | Error> => {
    const saveMainElementResult = await saveIntoWorkspace(workspaceUri)(
      serviceName,
      locationName
    )(elementWithDeps.mainElement.element, elementWithDeps.mainElement.content);
    if (isError(saveMainElementResult)) {
      const error = saveMainElementResult;
      return error;
    }
    const dependenciesSaveResult = await Promise.all(
      elementWithDeps.dependencies.map((dependentElement) => {
        const [element, content] = dependentElement;
        if (isError(content)) {
          const error = content;
          return error;
        }
        return saveIntoWorkspace(workspaceUri)(serviceName, locationName)(
          element,
          content
        );
      })
    );
    const errors = dependenciesSaveResult
      .map((value) => {
        if (isError(value)) return value;
        return undefined;
      })
      .filter(isDefined);
    if (errors.length) {
      logger.trace(
        `There were some issues during retrieving element ${
          elementWithDeps.mainElement.element.name
        } dependencies: ${JSON.stringify(errors.map((error) => error.message))}`
      );
    }
    return saveMainElementResult;
  };

const retrieveSingleElementWithDeps = async (
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
  const elementUri = fromTreeElementUri(element.uri);
  if (isError(elementUri)) {
    const error = elementUri;
    logger.error(
      `Unable to retrieve element: ${element.name}`,
      `Unable to retrieve element: ${element.name}, because of ${error.message}`
    );
    return;
  }
  const retrieveResult = await retrieveSingleElementCopy({
    service: elementUri.service,
    requestPoolMaxSize: endevorMaxRequestsNumber,
  })(elementUri.element);
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(error.message);
    return;
  }
  const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
    elementUri.serviceName,
    elementUri.searchLocationName
  )({
    mainElement: {
      element: elementUri.element,
      content: retrieveResult.content,
    },
    dependencies: retrieveResult.dependencies,
  });
  if (isError(saveResult)) {
    const error = saveResult;
    logger.error(
      `Unable to save element: ${elementUri.element.name}`,
      `Unable to save element: ${elementUri.element.name}, because of ${error.message}`
    );
    return;
  }
  const savedElementUri = saveResult;
  const showResult = await showElementInEditor(savedElementUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.error(
      `Unable to show element: ${element.name}`,
      `Unable to show element: ${element.name}, because of ${error.message}`
    );
    return;
  }
};

const retrieveMultipleElementsWithDeps = async (
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
  const validElementUris = elements
    .map((element) => {
      const uriParams = fromTreeElementUri(element.uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.trace(
          `Unable to retrieve element ${element.name}, because of ${error.message}`
        );
        return undefined;
      }
      return uriParams;
    })
    .filter(isDefined);
  const retrieveResults = await retrieveMultipleElementCopies(
    validElementUris.map((uri) => {
      return {
        serviceName: uri.serviceName,
        searchLocationName: uri.searchLocationName,
        element: uri.element,
        serviceInstance: {
          service: uri.service,
          requestPoolMaxSize: endevorMaxRequestsNumber,
        },
        searchLocation: uri.searchLocation,
      };
    })
  );
  const saveResults = await Promise.all(
    retrieveResults.map((retrieveResult) => {
      const elementDetails = retrieveResult[0];
      const elementWithDeps = retrieveResult[1];
      if (isError(elementWithDeps)) {
        const error = elementWithDeps;
        return error;
      }
      return saveIntoWorkspaceWithDependencies(workspaceUri)(
        elementDetails.serviceName,
        elementDetails.searchLocationName
      )({
        mainElement: {
          element: elementDetails.element,
          content: elementWithDeps.content,
        },
        dependencies: elementWithDeps.dependencies,
      });
    })
  );
  const showResults = await Promise.all(
    saveResults.map((result) => {
      if (!isError(result)) {
        const savedElementUri = result;
        return showElementInEditor(savedElementUri);
      }
      return result;
    })
  );
  const errors = showResults
    .map((value) => {
      if (isError(value)) return value;
      return undefined;
    })
    .filter(isDefined);
  if (errors.length) {
    logger.error(
      `There were some issues during retrieving elements: ${elements
        .map((element) => element.name)
        .join(', ')}: ${JSON.stringify(errors.map((error) => error.message))}`
    );
  }
};

const retrieveMultipleElementCopies = async (
  elements: ReadonlyArray<ElementDetails>
): Promise<
  ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
> => {
  const sequentialRetrieving = 1;
  return (
    await withNotificationProgress(
      `Retrieving elements: ${elements
        .map((validElementUri) => validElementUri.element.name)
        .join(', ')} copies with dependencies`
    )((progressReporter) => {
      return new PromisePool(
        elements.map(({ serviceInstance, element }) => {
          return async () => {
            return retrieveElementWithDependenciesWithoutSignout(
              toSeveralTasksProgress(progressReporter)(elements.length)
            )({
              service: serviceInstance.service,
              requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
            })(element);
          };
        }),
        {
          concurrency: sequentialRetrieving,
        }
      ).start();
    })
  ).map((elementContentWithDeps, index) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return [elements[index]!, elementContentWithDeps];
  });
};

const retrieveMultipleElementsWithDepsWithSignout =
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
    const validElementUris = elements
      .map((element) => {
        const uriParams = fromTreeElementUri(element.uri);
        if (isError(uriParams)) {
          const error = uriParams;
          logger.trace(
            `Unable to retrieve element ${element.name}, because of ${error.message}`
          );
          return undefined;
        }
        return uriParams;
      })
      .filter(isDefined);
    const retrieveResults = await complexMultipleRetrieve(dispatch)(
      validElementUris.map((uri) => {
        return {
          element: uri.element,
          searchLocationName: uri.searchLocationName,
          serviceName: uri.serviceName,
          serviceInstance: {
            service: uri.service,
            requestPoolMaxSize: endevorMaxRequestsNumber,
          },
          searchLocation: uri.searchLocation,
        };
      })
    )(signoutChangeControlValue);
    const saveResults = await Promise.all(
      retrieveResults.map((retrieveResult) => {
        const elementDetails = retrieveResult[0];
        const elementWithDeps = retrieveResult[1];
        if (isError(elementWithDeps)) {
          const error = elementWithDeps;
          return error;
        }
        return saveIntoWorkspaceWithDependencies(workspaceUri)(
          elementDetails.serviceName,
          elementDetails.searchLocationName
        )({
          mainElement: {
            element: elementDetails.element,
            content: elementWithDeps.content,
          },
          dependencies: elementWithDeps.dependencies,
        });
      })
    );
    const showedResults = await Promise.all(
      saveResults.map((result) => {
        if (!isError(result)) {
          const savedElementUri = result;
          return showElementInEditor(savedElementUri);
        }
        return result;
      })
    );
    const errors = showedResults
      .map((value) => {
        if (isError(value)) return value;
        return undefined;
      })
      .filter(isDefined);
    if (errors.length) {
      logger.error(
        `There were some issues during retrieving elements: ${elements
          .map((element) => element.name)
          .join(', ')}: ${JSON.stringify(errors.map((error) => error.message))}`
      );
    }
  };

type ElementDetails = Readonly<{
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  serviceInstance: ServiceInstance;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

const complexMultipleRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      validElementUris
    )(signoutChangeControlValue);
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
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          (signedOutElement) => signedOutElement[0]
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      logger.trace(
        `Unable to retrieve the ${notRetrievedElementsWithSignout.map(
          (elementDetails) => elementDetails.element.name
        )} with signout.`
      );
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
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          (signedOutElement) => signedOutElement[0]
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      const retrieveCopiesResult = await retrieveMultipleElementCopies(
        signoutErrorsAfterSignoutRetrieve
      );
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
        signoutErrorsAfterSignoutRetrieve
      )(signoutChangeControlValue);
    const successRetrievedElementsWithOverrideSignout = withoutErrors(
      retrieveWithOverrideSignoutResult
    );
    const notRetrievedElementsWithOverrideSignout = allErrors(
      retrieveWithOverrideSignoutResult
    );
    const secondAttemptWasSuccessful =
      !notRetrievedElementsWithOverrideSignout.length;
    if (secondAttemptWasSuccessful) {
      const signedOutElements = toSignedOutElementsPayload(
        [
          ...successRetrievedElementsWithSignout,
          ...successRetrievedElementsWithOverrideSignout,
        ].map((signedOutElement) => signedOutElement[0])
      );
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
    const signedOutElements = toSignedOutElementsPayload(
      [
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map((signedOutElement) => signedOutElement[0])
    );
    await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    const retrieveCopiesResult = await retrieveMultipleElementCopies(
      notRetrievedElementsWithOverrideSignout
    );
    return [
      ...successRetrievedElementsWithSignout,
      ...genericErrorsAfterSignoutRetrieve,
      ...successRetrievedElementsWithOverrideSignout,
      ...retrieveCopiesResult,
    ];
  };

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
): ReadonlyArray<[ElementDetails, ElementWithDependencies]> => {
  return input
    .map((result) => {
      const retrieveResult = result[1];
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementWithDependencies] = [
        result[0],
        retrieveResult,
      ];
      return mappedValue;
    })
    .filter(isDefined);
};

const retrieveMultipleElementsWithSignout =
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<
      [ElementDetails, ElementWithDependencies | Error | SignoutError]
    >
  > => {
    const sequentialRetrieving = 1;
    return (
      await withNotificationProgress(
        `Retrieving elements: ${validElementUris
          .map((validElementUri) => validElementUri.element.name)
          .join(', ')} with signout and dependencies`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map(({ serviceInstance, element }) => {
            return async () => {
              return retrieveElementWithDependenciesWithSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )({
                service: serviceInstance.service,
                requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
              })(element)(signoutChangeControlValue);
            };
          }),
          {
            concurrency: sequentialRetrieving,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [validElementUris[index]!, retrievedContent];
    });
  };

const retrieveMultipleElementsWithOverrideSignout =
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
  > => {
    const sequentialRetrieving = 1;
    return (
      await withNotificationProgress(
        `Retrieving elements: ${validElementUris
          .map((validElementUri) => validElementUri.element.name)
          .join(', ')} with override signout and dependencies`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map(({ serviceInstance, element }) => {
            return async () => {
              return retrieveElementWithDependenciesOverrideSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )({
                service: serviceInstance.service,
                requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
              })(element)(signoutChangeControlValue);
            };
          }),
          {
            concurrency: sequentialRetrieving,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [validElementUris[index]!, retrievedContent];
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
      service: signedOutElement.serviceInstance.service,
      searchLocationName: signedOutElement.searchLocationName,
      searchLocation: signedOutElement.searchLocation,
      elements: [...accum.elements, signedOutElement.element],
    };
  }, accumulator);
};

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNEDOUT,
      ...actionPayload,
    });
  };
