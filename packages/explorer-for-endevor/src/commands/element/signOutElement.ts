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

import { reporter } from '../../globals';
import { formatWithNewLines } from '../../utils';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  SignOutElementCommandCompletedStatus,
  TelemetryEvents,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../telemetry/_doc/Telemetry';
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
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { signOutElementAndLogActivity } from '../../api/endevor';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

export const signOutElementCommand =
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
  }: ElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    logger.traceWithDetails(
      `Signout command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name}.`
    );
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
        'CCID and Comment must be specified to sign out element.',
        'Signout command cancelled.'
      );
      return;
    }
    const signoutResponse = await signOutElement(logger)(
      (element) => (signoutParams) => {
        return withNotificationProgress(`Signing out element ${name} ...`)(
          (progressReporter) =>
            signOutElementAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId,
                searchLocationId,
                element,
              })
            )(progressReporter)(service)(element)(signoutParams)
        );
      }
    )(signoutChangeControlValue, element);
    if (isErrorEndevorResponse(signoutResponse)) {
      const errorResponse = signoutResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to sign out element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${
          element.type
        }/${name} because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.errorWithDetails(
            `Unable to sign out element ${name} because it is signed out to somebody else or not at all.`,
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
          logger.errorWithDetails(
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
          logger.errorWithDetails(
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
          logger.errorWithDetails(
            `Unable to sign out element ${name}.`,
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
        {
          ...element,
          lastActionCcid: signoutChangeControlValue.ccid,
        },
      ],
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
      status: SignOutElementCommandCompletedStatus.SUCCESS,
    });
    logger.infoWithDetails(
      `Element ${element.name} was signed out successfully!`
    );
  };

export const signOutElement =
  (logger: EndevorLogger) =>
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
          logger.warnWithDetails(
            `Element ${element.name} cannot be signed out because it is signed out to somebody else.`
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
