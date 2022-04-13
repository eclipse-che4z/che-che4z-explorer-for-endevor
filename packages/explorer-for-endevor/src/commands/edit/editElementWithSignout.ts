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
import { logger, reporter } from '../../globals';
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
import {
  TreeElementCommandArguments,
  EditElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../_doc/Telemetry';

export const editSingleElementWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    element: Readonly<{
      name: string;
      uri: vscode.Uri;
    }>
  ): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to edit elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to edit the element ${element.name}.`,
        `Unable to edit the element ${element.name} because of error ${error.message}.`
      );
      return;
    }
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: elementUri.searchLocation.ccid,
      comment: elementUri.searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out the element ${element.name}.`
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
    if (isError(retrieveResult)) {
      const error = retrieveResult;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `${error.message}.`
      );
      return;
    }
    const saveResult = await saveIntoEditFolder(workspaceUri)(
      elementUri.serviceName,
      elementUri.searchLocationName
    )(elementUri.element, retrieveResult.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save the element ${element.name} into the file system.`,
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
    const uploadableElementUri = withUploadOptions(saveResult)({
      ...elementUri,
      fingerprint: retrieveResult.fingerprint,
    });
    if (!uploadableElementUri) return;
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${element.name} for editing.`,
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
  (service: Service, searchLocation: ElementSearchLocation) =>
  (
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName,
    element: Element
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithFingerprint | Error> => {
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
        `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      });
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
          context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
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
          `Override signout retrieve was not successful, a copy of ${element.name} will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleCopy(service)(element);
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
          context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
        return retrieveCopyResult;
      }
      await updateTreeAfterSuccessfulSignout(dispatch)({
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        elements: [element],
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return retrieveWithOverrideResult;
    }
    if (isError(retrieveWithSignoutResult)) {
      const error = retrieveWithSignoutResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
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
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
        elementsAmount: elements.length,
      },
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to edit elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    let endevorMaxRequestsNumber: number;
    try {
      endevorMaxRequestsNumber = getMaxParallelRequests();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for the Endevor pool size, the default ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
        `Reading settings error ${e.message}.`
      );
      endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
    }
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementUriParams = fromTreeElementUri(elements[0]!.uri);
    if (isError(firstElementUriParams)) {
      const error = firstElementUriParams;
      logger.error(
        `Unable to show the change control value dialog.`,
        `Unable to show the change control value dialog because of error ${error.message}.`
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
            `Unable to edit the element ${element.name} because of error ${error.message}`
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
        const [elementDetails, retrievedItem] = result;
        if (isError(retrievedItem)) {
          const error = retrievedItem;
          return error;
        }
        const saveResult = await saveIntoEditFolder(workspaceUri)(
          elementDetails.serviceName,
          elementDetails.searchLocationName
        )(elementDetails.element, retrievedItem.content);
        if (isError(saveResult)) {
          const error = saveResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
            status: EditElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        return withUploadOptions(saveResult)({
          ...elementDetails,
          fingerprint: retrievedItem.fingerprint,
        });
      })
    );
    // show text editors only in sequential order (concurrency: 1)
    const showedElements = await new PromisePool(
      savedElements.map((result) => {
        if (!isError(result) && result) {
          const savedElementUri = result;
          return async () => {
            const showResult = await showElementToEdit(savedElementUri);
            if (isError(showResult)) {
              const error = showResult;
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
                status: EditElementCommandCompletedStatus.GENERIC_ERROR,
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
        concurrency: 1,
      }
    ).start();
    const overallErrors = showedElements
      .map((value) => {
        if (isError(value)) return value;
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
          status: EditElementCommandCompletedStatus.SUCCESS,
        });
        return undefined;
      })
      .filter(isDefined);
    if (overallErrors.length) {
      const elementNames = elements.map((element) => element.name).join(', ');
      logger.error(
        `There were some issues during editing of the elements ${elementNames}`,
        `There were some issues during editing of the elements ${elementNames}: ${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}`
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
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      })
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      const signedOutElements = toSignedOutElementsPayload(
        successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        )
      );
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      logger.trace(
        `Unable to retrieve the element(s) ${notRetrievedElementsWithSignout.map(
          ([elementDetails]) => elementDetails.element.name
        )} with signout.`
      );
      return retrieveWithSignoutResult;
    }
    const signoutErrorsAfterSignoutRetrieve = signoutErrors(
      retrieveWithSignoutResult
    );
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve.map(
        ([elementDetails]) => elementDetails.element.name
      )} cannot be retrieved with signout because the elements are signed out to somebody else.`
    );
    signoutErrorsAfterSignoutRetrieve.forEach(() =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      })
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        ([elementDetails]) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve.map(
          ([elementDetails]) => elementDetails.element.name
        )} copies will be retrieved.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      const retrieveCopiesResult = await retrieveMultipleElementCopies(
        endevorMaxRequestsNumber
      )(
        signoutErrorsAfterSignoutRetrieve.map(
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
          context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve.map(
        ([elementDetails]) => elementDetails.element.name
      )} will be retrieved with override signout.`
    );
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(
        endevorMaxRequestsNumber
      )(
        signoutErrorsAfterSignoutRetrieve.map(
          ([elementDetails]) => elementDetails
        )
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
        ].map(([signedOutElement]) => signedOutElement)
      );
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      successRetrievedElementsWithOverrideSignout.forEach(() => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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
      `Override signout retrieve was not successful, the copies of ${notRetrievedElementsWithOverrideSignout.map(
        ([elementDetails]) => elementDetails.element.name
      )} will be retrieved.`
    );
    const signedOutElements = toSignedOutElementsPayload(
      [
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map(([signedOutElement]) => signedOutElement)
    );
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
        context: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
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

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isSignoutError(retrieveResult)) {
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

const genericErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
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
  input: ReadonlyArray<[ElementDetails, Error | ElementWithFingerprint]>
): ReadonlyArray<[ElementDetails, ElementWithFingerprint]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementWithFingerprint] = [
        elementDetails,
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
  return signedOutElements.reduce((acc, signedOutElement) => {
    return {
      serviceName: signedOutElement.serviceName,
      service: signedOutElement.service,
      searchLocationName: signedOutElement.searchLocationName,
      searchLocation: signedOutElement.searchLocation,
      elements: [...acc.elements, signedOutElement.element],
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
