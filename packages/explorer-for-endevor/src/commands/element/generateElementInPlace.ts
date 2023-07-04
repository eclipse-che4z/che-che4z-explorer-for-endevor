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
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { generateElementInPlace } from '../../endevor';
import { logger, reporter } from '../../globals';
import { formatWithNewLines } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  ActionChangeControlValue,
  Element,
  GenerateResponse,
  ErrorResponseType,
  Service,
  Value,
} from '@local/endevor/_doc/Endevor';
import {
  GenerateElementInPlaceCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';
import { printEndevorReportCommand } from '../printEndevorReport';
import {
  askForListing,
  askForListingOrExecutionReport,
  askForExecutionReport,
} from '../../dialogs/listings/showListingDialogs';

type SelectedElementNode = ElementNode;

export const generateElementInPlaceCommand =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (elementNode: SelectedElementNode): Promise<void> => {
    const element = elementNode.element;
    logger.trace(
      `Generate command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name}.`
    );
    await generateSingleElement(configurations, dispatch)(elementNode);
  };

const generateSingleElement =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({
    name,
    element,
    timestamp,
    type,
    parent,
    serviceId,
    searchLocationId,
  }: ElementNode): Promise<void> => {
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    const actionControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(actionControlValue)) {
      logger.error(
        'Element can be generated only with CCID and Comment specified.'
      );
      return;
    }
    const updatedElementNode: SelectedElementNode = {
      serviceId,
      searchLocationId,
      type,
      name,
      parent,
      element,
      timestamp,
    };
    const generateResponse = await complexGenerate(service)(configuration)(
      element
    )(actionControlValue);
    const executionReportId =
      generateResponse.details?.reportIds?.executionReportId;
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to generate the element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.trace(`${error.message}.`);
      switch (errorResponse.type) {
        case ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR: {
          dispatch({
            type: Actions.ELEMENT_GENERATED_IN_PLACE,
            serviceId,
            searchLocationId,
            element: {
              ...element,
              lastActionCcid: actionControlValue.ccid.toUpperCase(),
            },
          });
          await printListingCommand(updatedElementNode);
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `The element ${name} is generated unsuccessfully. Please review the listing or execution report.`,
              MessageLevel.ERROR
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
              });
              await printEndevorReportCommand(element.name)(configuration)(
                service
              )(executionReportId);
            }
          } else {
            logger.error(
              `The element ${name} is generated unsuccessfully. Please review the listing.`
            );
          }
          // consider errors in the element processing as a success too (a part of the expected developer workflow)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
            status: GenerateElementInPlaceCommandCompletedStatus.SUCCESS,
          });
          return;
        }
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.error(
            `Unable to generate the element ${name} because it is signed out to somebody else or not at all.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
            error,
          });
          return;
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(`Endevor credentials are incorrect or expired.`);
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(`Unable to connect to Endevor Web Services.`);
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR: {
          logger.trace(
            `Unable to generate the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name}.`
          );
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `Unable to generate the element ${name}. Would you like to see the execution report?`
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
              });
              await printEndevorReportCommand(element.name)(configuration)(
                service
              )(executionReportId);
            }
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            status: GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
            error,
          });
          return;
        }
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const resultWithWarnings =
      generateResponse.details && generateResponse.details.returnCode >= 4;
    const message = `The element ${name} is generated ${
      resultWithWarnings ? 'with warnings' : 'successfully'
    }`;
    logger.trace(
      `The element ${element.environment}/${element.stageNumber}/${
        element.system
      }/${element.subSystem}/${element.type}/${name} is generated ${
        resultWithWarnings ? 'with warnings' : 'successfully'
      }${
        generateResponse.details?.messages.length
          ? `:${formatWithNewLines(generateResponse.details.messages)}.`
          : '.'
      }`
    );
    dispatch({
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element: {
        ...element,
        lastActionCcid: actionControlValue.ccid.toUpperCase(),
      },
    });
    const dialogResult = executionReportId
      ? await askForListingOrExecutionReport(
          `${message}. Would you like to see the listing or execution report?`,
          resultWithWarnings ? MessageLevel.WARN : MessageLevel.INFO
        )
      : await askForListing(
          `${message}. Would you like to see the listing?`,
          resultWithWarnings ? MessageLevel.WARN : MessageLevel.INFO
        );
    if (dialogResult.printListing) {
      await printListingCommand(updatedElementNode);
    }
    if (executionReportId && dialogResult.printExecutionReport) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      });
      await printEndevorReportCommand(element.name)(configuration)(service)(
        executionReportId
      );
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      status: GenerateElementInPlaceCommandCompletedStatus.SUCCESS,
    });
  };

const complexGenerate =
  (service: Service) =>
  (configuration: Value) =>
  (element: Element) =>
  async (
    actionChangeControlValue: ActionChangeControlValue
  ): Promise<GenerateResponse> => {
    const generateResponse = await withNotificationProgress(
      `Generating the element: ${element.name}`
    )((progressReporter) =>
      generateElementInPlace(progressReporter)(service)(configuration)(element)(
        actionChangeControlValue
      )()
    );
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `The element ${element.name} requires an override sign out action to generate the element.`
          );
          const overrideSignout = await askToOverrideSignOutForElements([
            element.name,
          ]);
          if (!overrideSignout) {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
            });
            return errorResponse;
          }
          const generateWithOverrideSignOut = await withNotificationProgress(
            `Generating with override signout of the element: ${element.name}`
          )((progressReporter) =>
            generateElementInPlace(progressReporter)(service)(configuration)(
              element
            )(actionChangeControlValue)({ overrideSignOut: true })
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return generateWithOverrideSignOut;
        }
        default:
          return errorResponse;
      }
    }
    return generateResponse;
  };
