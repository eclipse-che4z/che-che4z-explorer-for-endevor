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
  dialogCancelled as changeControlDialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation,
  dialogCancelled as generateLocationCancelled,
} from '../../dialogs/locations/endevorUploadLocationDialogs';
import { generateElementWithCopyBack } from '../../endevor';
import { logger, reporter } from '../../globals';
import { formatWithNewLines, isError } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  Element,
  GenerateWithCopyBackParams,
  ActionChangeControlValue,
  ElementMapPath,
  SubSystemMapPath,
  Service,
  Value,
  GenerateResponse,
  ErrorResponseType,
} from '@local/endevor/_doc/Endevor';
import {
  TelemetryEvents,
  GenerateWithCopyBackCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../_doc/telemetry/v2/Telemetry';
import { ANY_VALUE } from '@local/endevor/const';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';
import { printEndevorReportCommand } from '../printEndevorReport';
import {
  askForListing,
  askForListingOrExecutionReport,
  askForExecutionReport,
} from '../../dialogs/listings/showListingDialogs';

type SelectedElementNode = ElementNode;

export const generateElementWithCopyBackCommand = async (
  configurations: ConnectionConfigurations,
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode,
  noSource: GenerateWithCopyBackParams['noSource']
) => {
  logger.trace(
    `Generate with copy back command was called for ${elementNode.name}.`
  );
  await generateSingleElementWithCopyBack(configurations)(dispatch)(
    elementNode
  )(noSource);
};

const generateSingleElementWithCopyBack =
  (configurations: ConnectionConfigurations) =>
  (dispatch: (action: Action) => Promise<void>) =>
  ({ name, element, parent, serviceId, searchLocationId }: ElementNode) =>
  async (noSource: GenerateWithCopyBackParams['noSource']) => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
      noSource: noSource ? noSource : false,
    });
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    const generateWithCopyBackValues = await askForGenerateWithCopyBackValues(
      searchLocation,
      element
    );
    if (isError(generateWithCopyBackValues)) {
      const error = generateWithCopyBackValues;
      logger.error(`${error.message}.`);
      return;
    }
    const [targetLocation, actionChangeControlValue] =
      generateWithCopyBackValues;
    const copiedBackElement: Element = {
      ...targetLocation,
      name: element.name,
      id: element.id,
      noSource: noSource ?? false,
      extension: element.extension,
      lastActionCcid: actionChangeControlValue.ccid.toUpperCase(),
    };
    const treePath: SubSystemMapPath = {
      environment: targetLocation.environment,
      stageNumber: targetLocation.stageNumber,
      subSystem: parent.parent.name,
      system: parent.parent.parent.name,
    };
    const isElementFromSearchLocation =
      isElementInSearchLocation(copiedBackElement)(treePath);
    const generatedElementNode: SelectedElementNode = {
      serviceId,
      searchLocationId,
      type: isElementFromSearchLocation
        ? 'ELEMENT_IN_PLACE'
        : 'ELEMENT_UP_THE_MAP',
      name: copiedBackElement.name,
      parent,
      element,
      timestamp: Date.now().toString(),
    };
    const generateResponse = await complexGenerateWithCopyBack(
      service,
      configuration,
      targetLocation
    )(element)(actionChangeControlValue)({ noSource });
    const executionReportId =
      generateResponse.details?.reportIds?.executionReportId;
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to generate and copy back the element ${name} because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.trace(`${error.message}.`);
      switch (errorResponse.type) {
        case ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR: {
          dispatch(
            isElementFromSearchLocation
              ? {
                  type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
                  pathUpTheMap: element,
                  treePath: {
                    serviceId,
                    searchLocationId,
                    searchLocation: treePath,
                  },
                  targetElement: copiedBackElement,
                }
              : {
                  type: Actions.ELEMENT_GENERATED_IN_PLACE,
                  searchLocationId,
                  serviceId,
                  element,
                }
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL,
            context:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
          });
          await printListingCommand(generatedElementNode);
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `The element ${name} is generated unsuccessfully. Please review the listing or execution report.`,
              MessageLevel.ERROR
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
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
            type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
            status: isElementFromSearchLocation
              ? GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION
              : GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR: {
          const message = `Unable to generate the element ${name}`;
          logger.trace(`${message}.`);
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `${message}. Would you like to see the execution report?`
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
              });
              await printEndevorReportCommand(element.name)(configuration)(
                service
              )(executionReportId);
            }
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
            error,
          });
          return;
        }
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    if (isElementInSearchLocation(copiedBackElement)(treePath)) {
      await dispatch({
        type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
        pathUpTheMap: element,
        treePath: {
          serviceId,
          searchLocationId,
          searchLocation: treePath,
        },
        targetElement: copiedBackElement,
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
        status:
          GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION,
      });
    } else {
      await dispatch({
        type: Actions.ELEMENT_GENERATED_IN_PLACE,
        searchLocationId,
        serviceId,
        element,
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
        status:
          GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION,
      });
    }
    const resultWithWarnings =
      generateResponse.details && generateResponse.details.returnCode >= 4;
    const message = `The element ${name} is generated ${
      resultWithWarnings ? 'with warnings' : 'successfully'
    }`;
    logger.trace(
      `${message}${
        generateResponse.details?.messages.length
          ? `:${generateResponse.details.messages}.`
          : '.'
      }`
    );
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
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL,
        context:
          TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
      });
      await printListingCommand(generatedElementNode);
    }
    if (executionReportId && dialogResult.printExecutionReport) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
        context:
          TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
      });
      await printEndevorReportCommand(element.name)(configuration)(service)(
        executionReportId
      );
    }
  };

const complexGenerateWithCopyBack =
  (
    service: Service,
    configuration: Value,
    generateLocationValue: ElementMapPath
  ) =>
  (element: Element) =>
  (actionChangeControlValue: ActionChangeControlValue) =>
  async (
    copyBackParams?: GenerateWithCopyBackParams
  ): Promise<GenerateResponse> => {
    const generateResult = await withNotificationProgress(
      `Generating with copying back the element: ${generateLocationValue.id}`
    )((progressReporter) =>
      generateElementWithCopyBack(progressReporter)(service)(configuration)(
        generateLocationValue
      )(actionChangeControlValue)(copyBackParams)()
    );
    if (isErrorEndevorResponse(generateResult)) {
      const error = generateResult;
      switch (error.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `The element ${element.name} requires an override sign out action to generate the element.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
          });
          const overrideSignout = await askToOverrideSignOutForElements([
            element.name,
          ]);
          if (!overrideSignout) {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              context:
                TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
            });
            return error;
          }
          const generateWithOverrideSignOut = await withNotificationProgress(
            `Generating with copying back and override signout of the element: ${element.name}`
          )((progressReporter) =>
            generateElementWithCopyBack(progressReporter)(service)(
              configuration
            )(element)(actionChangeControlValue)(copyBackParams)({
              overrideSignOut: true,
            })
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return generateWithOverrideSignOut;
        }
        default:
          return error;
      }
    }
    return generateResult;
  };

const askForGenerateWithCopyBackValues = async (
  searchLocation: ElementSearchLocation,
  element: Element
): Promise<[ElementMapPath, ActionChangeControlValue] | Error> => {
  const type =
    searchLocation.type && searchLocation.type !== ANY_VALUE
      ? searchLocation.type
      : element.type;
  const generateLocation = await askForUploadLocation({
    environment: searchLocation.environment,
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system,
    subsystem: searchLocation.subsystem,
    type,
    element: element.name,
  });
  if (generateLocationCancelled(generateLocation)) {
    return new Error(
      `Target location must be specified to generate with copying back the element ${element.name}`
    );
  }
  const generateChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(generateChangeControlValue)) {
    return new Error(
      `CCID and Comment must be specified to generate with copying back the element ${generateLocation.id}`
    );
  }
  return [generateLocation, generateChangeControlValue];
};

const isElementInSearchLocation =
  (element: Element) =>
  (treePath: SubSystemMapPath): boolean => {
    return (
      element.environment === treePath.environment &&
      element.stageNumber === treePath.stageNumber &&
      element.subSystem === treePath.subSystem &&
      element.system === treePath.system
    );
  };
