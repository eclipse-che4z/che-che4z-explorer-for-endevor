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
import {
  fetchElement,
  generateElementInPlaceAndLogActivity,
  getProcessorGroupsByTypeAndLogActivity,
} from '../../api/endevor';
import { reporter } from '../../globals';
import { formatWithNewLines, isError } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  ActionChangeControlValue,
  Element,
  GenerateResponse,
  ErrorResponseType,
  Value,
} from '@local/endevor/_doc/Endevor';
import {
  FetchElementCommandCompletedStatus,
  GenerateElementInPlaceCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { printEndevorReportCommand } from '../printEndevorReport';
import {
  askForListing,
  askForListingOrExecutionReport,
  askForExecutionReport,
} from '../../dialogs/listings/showListingDialogs';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  askForProcessorGroup,
  pickedChoiceLabel,
} from '../../dialogs/processor-groups/processorGroupsDialogs';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

type SelectedElementNode = ElementNode;

export const generateElementInPlaceCommand =
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
  async (elementNode: SelectedElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId: elementNode.serviceId,
      searchLocationId: elementNode.searchLocationId,
    });
    const element = elementNode.element;
    logger.traceWithDetails(
      `Generate command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name}.`
    );
    await generateSingleElement(
      dispatch,
      getConnectionConfiguration
    )(elementNode);
  };

const generateSingleElement =
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
    element,
    timestamp,
    type,
    parent,
    serviceId,
    searchLocationId,
  }: ElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    let actionProcGroup = await askForProcessorGroup(
      logger,
      {
        ...searchLocation,
        type: element.type,
      },
      getProcessorGroupsByTypeAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
        })
      )(service),
      element.processorGroup
    );
    if (!actionProcGroup) {
      logger.error(`Generation for the element ${element.name} was cancelled.`);
      return;
    }
    actionProcGroup =
      actionProcGroup !== pickedChoiceLabel ? actionProcGroup : undefined;

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
    const generateResponse = await complexGenerate(logger)(dispatch)(
      serviceId,
      searchLocationId
    )(service)(element)(actionProcGroup)(actionControlValue);
    const executionReportId = generateResponse.details?.reportIds?.C1MSGS1;
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to generate element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
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
              `Element ${name} is generated unsuccessfully. Please review the listing or execution report.`,
              MessageLevel.ERROR
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
              });
              await printEndevorReportCommand(
                serviceId,
                searchLocationId
              )(element.name)(executionReportId);
            }
          } else {
            logger.errorWithDetails(
              `Element ${name} is generated unsuccessfully. Please review the listing.`
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
          logger.errorWithDetails(
            `Unable to generate element ${name} because it is signed out to somebody else or not at all.`
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
          logger.errorWithDetails(
            `Endevor credentials are incorrect or expired.`
          );
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
          logger.errorWithDetails(`Unable to connect to Endevor Web Services.`);
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
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `Unable to generate element ${name}. Would you like to see the execution report?`
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
              });
              await printEndevorReportCommand(
                serviceId,
                searchLocationId
              )(element.name)(executionReportId);
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
    const message = `Element ${name} is generated ${
      resultWithWarnings ? 'with warnings' : 'successfully'
    }`;
    logger.traceWithDetails(
      `Element ${element.environment}/${element.stageNumber}/${
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
    fetchGeneratedElement(dispatch)(serviceId, searchLocationId)(service)(
      element
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
      await printListingCommand(updatedElementNode);
    }
    if (executionReportId && dialogResult.printExecutionReport) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      });
      await printEndevorReportCommand(
        serviceId,
        searchLocationId
      )(element.name)(executionReportId);
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      status: GenerateElementInPlaceCommandCompletedStatus.SUCCESS,
    });
  };

const complexGenerate =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  (processorGroup: Value | undefined) =>
  async (
    actionChangeControlValue: ActionChangeControlValue
  ): Promise<GenerateResponse> => {
    const generateResponse = await withNotificationProgress(
      `Generating element ${element.name} ...`
    )((progressReporter) =>
      generateElementInPlaceAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)(processorGroup)(
        actionChangeControlValue
      )()
    );
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${element.name} requires an override sign out action to generate the element.`
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
            `Generating with override signout of element ${element.name} ...`
          )((progressReporter) =>
            generateElementInPlaceAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId,
                searchLocationId,
                element,
              })
            )(progressReporter)(service)(element)(processorGroup)(
              actionChangeControlValue
            )({
              overrideSignOut: true,
            })
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

const fetchGeneratedElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  async (element: Element): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const elementFetchResponse = await withNotificationProgress(
      `Fetching generated element(s) ...`
    )((progressReporter) => {
      return fetchElement(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element);
    });

    if (isError(elementFetchResponse)) {
      const error = elementFetchResponse;
      logger.errorWithDetails(error.name, error.message);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        // TODO: specific completed status?
        status: FetchElementCommandCompletedStatus.GENERIC_ERROR,
        errorContext: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED,
        error,
      });
      return;
    }
    dispatch({
      type: Actions.SELECTED_ELEMENTS_FETCHED,
      serviceId,
      searchLocationId,
      elements: elementFetchResponse,
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED,
      context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
      status: FetchElementCommandCompletedStatus.SUCCESS,
    });
  };
