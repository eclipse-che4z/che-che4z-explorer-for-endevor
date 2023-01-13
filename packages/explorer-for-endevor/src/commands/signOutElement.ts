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

import { logger, reporter } from '../globals';
import { isDefined, isError } from '../utils';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  SignOutElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../_doc/telemetry/v2/Telemetry';
import { isSignoutError } from '@local/endevor/utils';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';
import {
  Element,
  ElementSearchLocation,
  SignOutParams,
} from '@local/endevor/_doc/Endevor';
import { SignoutError } from '@local/endevor/_doc/Error';
import { ElementNode } from '../tree/_doc/ElementTree';
import { Action, Actions } from '../store/_doc/Actions';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import * as endevor from '../endevor';

export const signOutElementCommand =
  (dispatch: (action: Action) => Promise<void>) =>
  async (elementNode: ElementNode) => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to sign out the element ${elementNode.name}.`,
        `Unable to sign out the element ${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
    });
    const { serviceId, searchLocationId, service, element, searchLocation } =
      uriParams;
    const signoutResult = await signOutElement((element) => (signoutParams) => {
      return withNotificationProgress(
        `Signing out the element: ${elementNode.name}`
      )((progressReporter) =>
        endevor.signOutElement(progressReporter)(service)(element)(
          signoutParams
        )
      );
    })(searchLocation, element);
    if (isError(signoutResult)) {
      const error = signoutResult;
      logger.error(
        `Unable to sign out the element ${element.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
        status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    if (!isDefined(signoutResult)) {
      logger.trace('Signout command cancelled.');
      return;
    }
    dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      searchLocationId,
      serviceId,
      elements: [signoutResult],
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
      status: SignOutElementCommandCompletedStatus.SUCCESS,
    });
    logger.info(`Element ${element.name} was signed out successfully!`);
  };

export const signOutElement =
  (
    signOutElement: (
      element: Element
    ) => ({
      signoutChangeControlValue,
      overrideSignOut,
    }: SignOutParams) => Promise<void | SignoutError | Error>
  ) =>
  async (
    searchLocation: ElementSearchLocation,
    element: Element
  ): Promise<Element | undefined | Error> => {
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        'CCID and Comment must be specified to sign out an element.'
      );
      return;
    }
    const signOutResult = await signOutElement(element)({
      signoutChangeControlValue,
    });
    if (isSignoutError(signOutResult)) {
      logger.warn(
        `Element ${element.name} cannot be signed out because the element is signed out to somebody else.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
      });
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
        });
        return;
      }
      logger.trace(
        `Override signout option was chosen for ${element.name}. Elements sign out will be overriden`
      );
      const overrideSignOutResult = await signOutElement(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
      if (isError(overrideSignOutResult)) {
        const error = overrideSignOutResult;
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
        context: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return element;
    }
    if (isError(signOutResult)) {
      const error = signOutResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
        status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
        error: signOutResult,
      });
      return error;
    }
    return element;
  };
