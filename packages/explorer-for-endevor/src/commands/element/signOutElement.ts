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
import { formatWithNewLines } from '../../utils';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  SignOutElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../_doc/telemetry/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import {
  ActionChangeControlValue,
  Element,
  ErrorResponseType,
  SignoutElementResponse,
  SignOutParams,
} from '@local/endevor/_doc/Endevor';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import * as endevor from '../../endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';

export const signOutElementCommand =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: ElementNode): Promise<void> => {
    logger.trace(
      `Signout command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name}.`
    );
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
        'CCID and Comment must be specified to sign out an element.',
        'Signout command cancelled.'
      );
      return;
    }
    const signoutResponse = await signOutElement(
      (element) => (signoutParams) => {
        return withNotificationProgress(`Signing out the element ${name} ...`)(
          (progressReporter) =>
            endevor.signOutElement(progressReporter)(service)(configuration)(
              element
            )(signoutParams)
        );
      }
    )(signoutChangeControlValue, element);
    if (isErrorEndevorResponse(signoutResponse)) {
      const errorResponse = signoutResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to sign out the element  ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${
          element.type
        }/${name} because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.error(
            `Unable to sign out the element ${name} because it is signed out to somebody else or not at all.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
            status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
            status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            `Unable to connect to Endevor Web Services.`,
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
            status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to sign out the element ${name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
            status: SignOutElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      searchLocationId,
      serviceId,
      elements: [
        { ...element, lastActionCcid: signoutChangeControlValue.ccid },
      ],
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
    }: SignOutParams) => Promise<SignoutElementResponse>
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue,
    element: Element
  ): Promise<SignoutElementResponse> => {
    const signOutResponse = await signOutElement(element)({
      signoutChangeControlValue,
    });
    if (isErrorEndevorResponse(signOutResponse)) {
      const errorResponse = signOutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `Element ${element.name} cannot be signed out because the element is signed out to somebody else.`
          );
          const overrideSignout = await askToOverrideSignOutForElements([
            element.name,
          ]);
          if (!overrideSignout) {
            logger.trace(
              `Override signout option was not chosen for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              context: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
            });
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}.`
          );
          const overrideSignOutResponse = await signOutElement(element)({
            signoutChangeControlValue,
            overrideSignOut: true,
          });
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return overrideSignOutResponse;
        }
        default:
          return errorResponse;
      }
    }
    return signOutResponse;
  };
