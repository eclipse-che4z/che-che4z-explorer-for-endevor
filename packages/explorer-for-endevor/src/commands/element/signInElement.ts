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
import { signInElement } from '../../endevor';
import { logger, reporter } from '../../globals';
import { formatWithNewLines } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  SignInElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';

type SelectedElementNode = ElementNode;

export const signInElementCommand =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: SelectedElementNode): Promise<void> => {
    logger.trace(
      `Signin command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name}.`
    );
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration } = connectionParams;
    const signInResponse = await withNotificationProgress(
      `Signing in the element ${element.name} ...`
    )((progressReporter) =>
      signInElement(progressReporter)(service)(configuration)(element)
    );
    if (isErrorEndevorResponse(signInResponse)) {
      const errorResponse = signInResponse;
      // TODO: format using all possible details
      const error = new Error(
        `Unable to sign in the element  ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${
          element.type
        }/${name} because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
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
          logger.error(
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
          logger.error(
            `Unable to sign in the element ${name}.`,
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
    logger.info(`Element ${element.name} was signed in successfully!`);
  };
