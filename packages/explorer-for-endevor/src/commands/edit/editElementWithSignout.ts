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

import { isSignoutError, toSeveralTasksProgress } from '@local/endevor/utils';
import {
  Service,
  ActionChangeControlValue,
  ElementWithFingerprint,
  Element,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { logger } from '../../globals';
import { fromTreeElementUri } from '../../uri/treeElementUri';
import * as vscode from 'vscode';
import { isDefined, isError } from '../../utils';
import {
  saveIntoEditFolder,
  showElementToEdit,
  withUploadOptions,
} from './common';
import { getMaxParallelRequests } from '../../settings/settings';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../../constants';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import { retrieveElementWithFingerprint } from '../../endevor';
import { Action, Actions, SignedOutElementsPayload } from '../../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../../_doc/settings';

export const editSingleElementWithSignout =
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
        'At least one workspace in this project should be opened to edit elements'
      );
      return;
    }
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to edit element ${element.name}`,
        `Unable to edit element ${element.name}, because of ${error.message}`
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
    const retrieveResult = await complexRetrieve(dispatch)(
      elementUri.service,
      elementUri.searchLocation
    )(
      elementUri.serviceName,
      elementUri.searchLocationName,
      elementUri.element
    )(signoutChangeControlValue);
    if (!retrieveResult) return;
    const saveResult = await saveIntoEditFolder(workspaceUri)(
      elementUri.serviceName,
      elementUri.searchLocationName
    )(elementUri.element, retrieveResult.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(error.message);
      return;
    }
    const uploadableElementUri = withUploadOptions(saveResult)({
      ...elementUri,
      fingerprint: retrieveResult.fingerprint,
    });
    if (!uploadableElementUri) return;
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(error.message);
      return;
    }
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (service: Service, searchLocation: ElementSearchLocation) =>
  (
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName,
    element: Element
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithFingerprint | undefined> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout(
      service
    )(element)(signoutChangeControlValue);
    if (!isError(signoutChangeControlValue)) {
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
        const retrieveCopyResult = await retrieveSingleCopy(service)(element);
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
        await retrieveSingleElementWithSignoutOverride(service)(element)(
          signoutChangeControlValue
        );
      if (isError(retrieveWithOverrideResult)) {
        logger.warn(
          `Override signout retrieve was not succesful, ${element.name} copy will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleCopy(service)(element);
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
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithFingerprint | Error> => {
    return withNotificationProgress(
      `Retrieving element with signout: ${element.name}`
    )(async (progressReporter) => {
      return await retrieveElementWithFingerprint(progressReporter)(service)(
        element
      )(signoutChangeControlValue);
    });
  };

const retrieveSingleElementWithSignoutOverride =
  (service: Service) =>
  (element: Element) =>
  (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithFingerprint | Error> => {
    return withNotificationProgress(
      `Retrieving element with override signout: ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithFingerprint(progressReporter)(service)(element)(
        signoutChangeControlValue,
        true
      );
    });
  };

const retrieveSingleCopy =
  (service: Service) =>
  (element: Element): Promise<ElementWithFingerprint | Error> => {
    return withNotificationProgress(`Retrieving element: ${element.name}`)(
      async (progressReporter) => {
        return retrieveElementWithFingerprint(progressReporter)(service)(
          element
        )();
      }
    );
  };

export const editMultipleElementsWithSignout =
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
        const retrievedItem = result[1];
        if (isError(retrievedItem)) {
          const error = retrievedItem;
          return error;
        }
        const elementDetails = result[0];
        const saveResult = await saveIntoEditFolder(workspaceUri)(
          elementDetails.serviceName,
          elementDetails.searchLocationName
        )(elementDetails.element, retrievedItem.content);
        if (isError(saveResult)) return saveResult;
        return withUploadOptions(saveResult)({
          ...elementDetails,
          fingerprint: retrievedItem.fingerprint,
        });
      })
    );
    const showedElements = await Promise.all(
      savedElements.map((result) => {
        if (!isError(result) && result) {
          const savedElementUri = result;
          return showElementToEdit(savedElementUri);
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

type ElementDetails = Readonly<{
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  service: Service;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

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
  ): Promise<
    ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
        endevorMaxRequestsNumber
      )(signoutErrorsAfterSignoutRetrieve);
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
      endevorMaxRequestsNumber
    )(notRetrievedElementsWithOverrideSignout);
    return [
      ...successRetrievedElementsWithSignout,
      ...genericErrorsAfterSignoutRetrieve,
      ...successRetrievedElementsWithOverrideSignout,
      ...retrieveCopiesResult,
    ];
  };

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
): ReadonlyArray<[ElementDetails, ElementWithFingerprint]> => {
  return input
    .map((result) => {
      const retrieveResult = result[1];
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementWithFingerprint] = [
        result[0],
        retrieveResult,
      ];
      return mappedValue;
    })
    .filter(isDefined);
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
  ): Promise<
    ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with signout`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithFingerprint(
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
  ): Promise<
    ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with override signout`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithFingerprint(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element)(
                signoutChangeControlValue,
                true
              );
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

const retrieveMultipleElementCopies =
  (endevorMaxRequestsNumber: number) =>
  async (
    elements: ReadonlyArray<ElementDetails>
  ): Promise<
    ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements: ${elements
          .map((element) => element.element.name)
          .join(', ')} with override signout`
      )((progressReporter) => {
        return new PromisePool(
          elements.map((element) => {
            return async () => {
              return retrieveElementWithFingerprint(
                toSeveralTasksProgress(progressReporter)(elements.length)
              )(element.service)(element.element)();
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

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNEDOUT,
      ...actionPayload,
    });
  };
