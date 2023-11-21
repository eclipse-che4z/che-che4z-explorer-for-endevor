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

import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { signInElementAndLogActivity } from '../../api/endevor';
import { reporter } from '../../globals';
import { formatWithNewLines } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  SignInElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

type SelectedElementNode = ElementNode;

export const signInElementCommand =
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
  }: SelectedElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    logger.traceWithDetails(
      `Sign in command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name}.`
    );
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service } = connectionParams;
    const signInResponse = await withNotificationProgress(
      `Signing in element ${element.name} ...`
    )((progressReporter) =>
      signInElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)
    );
    if (isErrorEndevorResponse(signInResponse)) {
      const errorResponse = signInResponse;
      // TODO: format using all possible details
      const error = new Error(
        `Unable to sign in element  ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${
          element.type
        }/${name} because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.errorWithDetails(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED,
            status: SignInElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED,
            status: SignInElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to sign in element ${name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED,
            status: SignInElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    dispatch({
      type: Actions.ELEMENT_SIGNED_IN,
      serviceId,
      searchLocationId,
      element,
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED,
      status: SignInElementCommandCompletedStatus.SUCCESS,
    });
    logger.infoWithDetails(
      `Element ${element.name} was signed in successfully!`
    );
  };
