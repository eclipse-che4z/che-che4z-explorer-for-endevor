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

import { LocationNode } from '../../tree/_doc/ServiceLocationTree';
import {
  chooseFileUriFromFs,
  getFileContent,
} from '@local/vscode-wrapper/workspace';
import { formatWithNewLines, isError, parseFilePath } from '../../utils';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { reporter } from '../../globals';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation as askForAddLocation,
  dialogCancelled as addLocationDialogCancelled,
} from '../../dialogs/locations/endevorUploadLocationDialogs';
import {
  ActionChangeControlValue,
  AddResponse,
  ChangeControlValue,
  ElementMapPath,
  ElementTypeMapPath,
  ErrorResponseType,
  ProcessorGroupsResponse,
  Value,
} from '@local/endevor/_doc/Endevor';
import {
  addElementAndLogActivity,
  getProcessorGroupsByTypeAndLogActivity,
} from '../../api/endevor';
import { Action, Actions } from '../../store/_doc/Actions';
import { TextDecoder } from 'util';
import { Uri } from 'vscode';
import { ENCODING } from '../../constants';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import {
  AddElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { EndevorId } from '../../store/_doc/v2/Store';
import { getFileExtensionResolution } from '../../settings/settings';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { TypeNode } from '../../tree/_doc/ElementTree';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import {
  askForProcessorGroup,
  pickedChoiceLabel,
} from '../../dialogs/processor-groups/processorGroupsDialogs';

export const addElementFromFileSystem =
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
  async (node: LocationNode | TypeNode): Promise<void> => {
    const logger = createEndevorLogger();
    const fileUri = await chooseFileUriFromFs();
    if (!fileUri) {
      return;
    }
    const { fileName, fullFileName } = parseFilePath(fileUri.path);
    if (!fileName) {
      logger.error(`Unable to add element ${fileName}.`);
      return;
    }
    const content = await readElementContent(fileUri.path);
    if (isError(content)) {
      const error = content;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
        status: AddElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      logger.error(
        `Unable to read element content.`,
        `Unable to read element content because of error ${error.message}.`
      );
      return;
    }
    const serviceId = resolveServiceId(node);
    if (!serviceId) {
      logger.error(`Unable to add element ${fileName}.`);
      return;
    }
    logger.updateContext({ serviceId });
    const searchLocationId = resolveSearchLocationId(node);
    if (!searchLocationId) {
      logger.errorWithDetails(`Unable to add element ${fileName}.`);
      return;
    }
    logger.updateContext({ serviceId, searchLocationId });
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const fileNameToShow = selectFileNameToShow(fileName, fullFileName);
    const updatedSearchLocation =
      node.type === 'TYPE'
        ? {
            ...searchLocation,
            system: node.parent.subSystemMapPath.system,
            subsystem: node.parent.subSystemMapPath.subSystem,
            type: node.name,
          }
        : searchLocation;
    const addValues = await askForAddValues(logger)(
      updatedSearchLocation,
      fileNameToShow,
      getProcessorGroupsByTypeAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
        })
      )(service)
    );
    if (isError(addValues)) {
      const error = addValues;
      logger.errorWithDetails(error.message);
      return;
    }
    const [addLocation, actionControlValue, actionProcGroup] = addValues;
    const addResult = await addNewElement(dispatch)({
      id: serviceId,
      value: service,
    })({
      id: searchLocationId,
      configuration: service.configuration,
    })({
      ...addLocation,
    })(actionProcGroup)(actionControlValue)(content, fileUri.fsPath);
    if (isErrorEndevorResponse(addResult)) {
      const errorResponse = addResult;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to add element  ${addLocation.environment}/${
          addLocation.stageNumber
        }/${addLocation.system}/${addLocation.subSystem}/${addLocation.type}/${
          addLocation.id
        } to Endevor because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.DUPLICATE_ELEMENT_ENDEVOR_ERROR:
          logger.errorWithDetails(
            `Unable to add element ${fileName} because element with this name already exists.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
            status: AddElementCommandCompletedStatus.DUPLICATED_ELEMENT_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
            status: AddElementCommandCompletedStatus.GENERIC_ERROR,
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
            errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
            status: AddElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to add element ${fileName} to Endevor.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
            status: AddElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    await dispatch({
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId,
      element: {
        environment: addLocation.environment,
        stageNumber: addLocation.stageNumber,
        system: addLocation.system,
        subSystem: addLocation.subSystem,
        type: addLocation.type,
        id: addLocation.id,
        name: addLocation.id,
        noSource: false,
        lastActionCcid: actionControlValue.ccid.toUpperCase(),
      },
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED,
      status: AddElementCommandCompletedStatus.SUCCESS,
    });
    logger.infoWithDetails(`Element ${addLocation.id} was added successfully!`);
  };

const addNewElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (service: { id: EndevorId; value: EndevorAuthorizedService }) =>
  (searchLocation: { id: EndevorId; configuration: Value }) =>
  (element: ElementMapPath) =>
  (processorGroup: Value | undefined) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  async (content: string, elementFilePath: string): Promise<AddResponse> => {
    const addResult = await withNotificationProgress(
      `Adding element ${element.id} ...`
    )((progressReporter) => {
      return addElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId: service.id,
          searchLocationId: searchLocation.id,
        })
      )(progressReporter)(service.value)(element)(processorGroup)(
        uploadChangeControlValue
      )({
        content,
        elementFilePath,
      });
    });
    return addResult;
  };

const askForAddValues =
  (logger: EndevorLogger) =>
  async (
    searchLocation: SearchLocation,
    name: string,
    getProcessorGroups: (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>
  ): Promise<
    Error | [ElementMapPath, ActionChangeControlValue, Value | undefined]
  > => {
    const addLocation = await askForAddLocation({
      environment: searchLocation.environment,
      stageNumber: searchLocation.stageNumber,
      system: searchLocation.system,
      subsystem: searchLocation.subsystem,
      type: searchLocation.type,
      element: name,
    });
    if (addLocationDialogCancelled(addLocation)) {
      return new Error(
        `Add location must be specified to add element ${name}.`
      );
    }

    let actionProcGroup = await askForProcessorGroup(
      logger,
      addLocation,
      getProcessorGroups
    );
    if (!actionProcGroup) {
      return new Error('Adding of an element was cancelled.');
    }
    actionProcGroup =
      actionProcGroup !== pickedChoiceLabel ? actionProcGroup : undefined;

    const addChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (changeControlDialogCancelled(addChangeControlValue)) {
      return new Error(
        `CCID and Comment must be specified to add element ${addLocation.id}.`
      );
    }
    return [addLocation, addChangeControlValue, actionProcGroup];
  };

const readElementContent = async (
  elementTempFilePath: string
): Promise<string | Error> => {
  try {
    return new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(elementTempFilePath))
    );
  } catch (error) {
    return error;
  }
};

const resolveServiceId = (
  nodeArg: LocationNode | TypeNode
): EndevorId | undefined => {
  if (nodeArg.type === 'TYPE') {
    return nodeArg.parent.serviceId;
  }
  return {
    name: nodeArg.serviceName,
    source: nodeArg.serviceSource,
  };
};

const resolveSearchLocationId = (
  nodeArg: LocationNode | TypeNode
): EndevorId | undefined => {
  if (nodeArg.type === 'TYPE') {
    return nodeArg.parent.searchLocationId;
  }
  return {
    name: nodeArg.name,
    source: nodeArg.source,
  };
};

const selectFileNameToShow = (
  fileName: string,
  fullFileName: string
): string => {
  const fileExtResolution = getFileExtensionResolution();
  switch (fileExtResolution) {
    case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
      return fileName;
    case FileExtensionResolutions.FROM_TYPE_EXT:
      return fileName;
    case FileExtensionResolutions.FROM_NAME:
      return fullFileName;
    default:
      throw new UnreachableCaseError(fileExtResolution);
  }
};
