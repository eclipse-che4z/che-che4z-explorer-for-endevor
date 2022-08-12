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

import * as vscode from 'vscode';
import { isSignoutError } from '@local/endevor/utils';
import {
  Service,
  ActionChangeControlValue,
  ElementWithFingerprint,
  Element,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { logger, reporter } from '../../globals';
import { fromTreeElementUri } from '../../uri/treeElementUri';
import { isError } from '../../utils';
import { saveIntoEditFolder, showElementToEdit } from './common';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { retrieveElementWithFingerprint } from '../../endevor';
import {
  Action,
  Actions,
  SignedOutElementsPayload,
} from '../../store/_doc/Actions';
import {
  TreeElementCommandArguments,
  EditElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../_doc/Telemetry';
import { toEditedElementUri } from '../../uri/editedElementUri';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { Id } from '../../store/storage/_doc/Storage';

export const editSingleElementWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (getTempEditFolderUri: () => vscode.Uri) =>
  async (element: ElementNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
      autoSignOut: true,
    });
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
      elementUri.serviceId,
      elementUri.searchLocationId,
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
    const saveResult = await saveIntoEditFolder(getTempEditFolderUri())(
      elementUri.serviceId,
      elementUri.searchLocationId
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
    const uploadableElementUri = toEditedElementUri(saveResult.fsPath)({
      element: elementUri.element,
      fingerprint: retrieveResult.fingerprint,
      endevorConnectionDetails: elementUri.service,
      searchContext: {
        serviceId: elementUri.serviceId,
        searchLocationId: elementUri.searchLocationId,
        overallSearchLocation: elementUri.searchLocation,
        initialSearchLocation: {
          subSystem: element.parent.parent.name,
          system: element.parent.parent.parent.name,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: elementUri.searchLocation.stageNumber!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: elementUri.searchLocation.environment!,
        },
      },
    });
    if (isError(uploadableElementUri)) {
      const error = uploadableElementUri;
      logger.error(
        `Unable to open the element ${element.name} for editing.`,
        `Unable to open the element ${element.name} because of error ${error.message}.`
      );
      return;
    }
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
  (service: Service, _searchLocation: ElementSearchLocation) =>
  (serviceId: Id, searchLocationId: Id, element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithFingerprint | Error> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout(
      service
    )(element)(signoutChangeControlValue);
    if (!isError(signoutChangeControlValue)) {
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
        serviceId,
        searchLocationId,
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

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      ...actionPayload,
    });
  };
