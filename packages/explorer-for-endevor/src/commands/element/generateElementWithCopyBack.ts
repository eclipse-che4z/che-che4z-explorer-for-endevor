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
import {
  generateElementWithCopyBackAndLogActivity,
  getProcessorGroupsByTypeAndLogActivity,
} from '../../api/endevor';
import { reporter } from '../../globals';
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
  GenerateResponse,
  ErrorResponseType,
  ElementTypeMapPath,
  ProcessorGroupsResponse,
  ProcessorGroupValue,
} from '@local/endevor/_doc/Endevor';
import {
  TelemetryEvents,
  GenerateWithCopyBackCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../../telemetry/_doc/Telemetry';
import { ANY_VALUE } from '@local/endevor/const';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
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
import { ProgressReporter } from '@local/endevor/_doc/Progress';

type SelectedElementNode = ElementNode;

export const generateElementWithCopyBackCommand =
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
  async (
    elementNode: SelectedElementNode,
    options: {
      noSource: GenerateWithCopyBackParams['noSource'];
    }
  ) => {
    const logger = createEndevorLogger({
      serviceId: elementNode.serviceId,
      searchLocationId: elementNode.searchLocationId,
    });
    const element = elementNode.element;
    logger.traceWithDetails(
      `Generate with copy back command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name}.`
    );
    await generateSingleElementWithCopyBack(
      dispatch,
      getConnectionConfiguration
    )(elementNode)(options.noSource);
  };

const generateSingleElementWithCopyBack =
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
  ({ name, element, parent, serviceId, searchLocationId }: ElementNode) =>
  async (noSource: GenerateWithCopyBackParams['noSource']) => {
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

    const generateWithCopyBackValues = await askForGenerateWithCopyBackValues(
      logger
    )(
      searchLocation,
      element,
      getProcessorGroupsByTypeAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
        })
      )(service)
    );
    if (isError(generateWithCopyBackValues)) {
      const error = generateWithCopyBackValues;
      logger.errorWithDetails(`${error.message}.`);
      return;
    }
    const [targetLocation, actionProcGroup, actionChangeControlValue] =
      generateWithCopyBackValues;
    const copiedBackElement: Element = {
      ...targetLocation,
      name: element.name,
      id: element.id,
      noSource: noSource ?? false,
      extension: element.extension,
      lastActionCcid: actionChangeControlValue.ccid.toUpperCase(),
      processorGroup: element.processorGroup,
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
    const generateResponse = await complexGenerateWithCopyBack(logger)(
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)(targetLocation)(element)(actionProcGroup)(
      actionChangeControlValue
    )({
      noSource,
    });
    const executionReportId = generateResponse.details?.reportIds?.C1MSGS1;
    if (isErrorEndevorResponse(generateResponse)) {
      const errorResponse = generateResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to generate and copy back element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.traceWithDetails(`${error.message}.`);
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
          await printListingCommand(generatedElementNode);
          if (executionReportId) {
            const dialogResult = await askForExecutionReport(
              `Element ${name} is generated unsuccessfully. Please review the listing or execution report.`,
              MessageLevel.ERROR
            );
            if (dialogResult.printExecutionReport) {
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
                context:
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
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
            type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
            status: isElementFromSearchLocation
              ? GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION
              : GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
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
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
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
                  TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
              });
              await printEndevorReportCommand(
                serviceId,
                searchLocationId
              )(element.name)(executionReportId);
            }
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
            errorContext:
              TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
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
      await printListingCommand(generatedElementNode);
    }
    if (executionReportId && dialogResult.printExecutionReport) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL,
        context:
          TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
      });
      await printEndevorReportCommand(
        serviceId,
        searchLocationId
      )(element.name)(executionReportId);
    }
  };

const complexGenerateWithCopyBack =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (generateLocationValue: ElementMapPath) =>
  (element: Element) =>
  (processorGroup: ProcessorGroupValue) =>
  (actionChangeControlValue: ActionChangeControlValue) =>
  async (
    copyBackParams?: GenerateWithCopyBackParams
  ): Promise<GenerateResponse> => {
    const generateResult = await withNotificationProgress(
      `Generating with copying back element ${generateLocationValue.id} ...`
    )((progressReporter) =>
      generateElementWithCopyBackAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(generateLocationValue)(processorGroup)(
        actionChangeControlValue
      )(copyBackParams)()
    );
    if (isErrorEndevorResponse(generateResult)) {
      const error = generateResult;
      switch (error.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${element.name} requires an override sign out action to generate.`
          );
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
            `Generating with copying back and override signout of element ${element.name} ...`
          )((progressReporter) =>
            generateElementWithCopyBackAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId,
                searchLocationId,
                element,
              })
            )(progressReporter)(service)(generateLocationValue)(processorGroup)(
              actionChangeControlValue
            )(copyBackParams)({
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

const askForGenerateWithCopyBackValues =
  (logger: EndevorLogger) =>
  async (
    searchLocation: SearchLocation,
    element: Element,
    getProcessorGroups: (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>
  ): Promise<
    [ElementMapPath, ProcessorGroupValue, ActionChangeControlValue] | Error
  > => {
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
        `Target location must be specified to generate with copying back element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`
      );
    }
    let actionProcGroup = await askForProcessorGroup(
      logger,
      generateLocation,
      getProcessorGroups,
      element.processorGroup
    );
    if (!actionProcGroup) {
      return new Error(
        `Generation for the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} was cancelled.`
      );
    }
    actionProcGroup =
      actionProcGroup !== pickedChoiceLabel ? actionProcGroup : undefined;
    const generateChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (changeControlDialogCancelled(generateChangeControlValue)) {
      return new Error(
        `CCID and Comment must be specified to generate with copying back element ${generateLocation.environment}/${generateLocation.stageNumber}/${generateLocation.system}/${generateLocation.subSystem}/${generateLocation.type}/${generateLocation.id}`
      );
    }
    return [generateLocation, actionProcGroup, generateChangeControlValue];
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
