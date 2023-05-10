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
import { logger, reporter } from '../../globals';
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
  ErrorResponseType,
  Service,
  Value,
} from '@local/endevor/_doc/Endevor';
import { addElement } from '../../endevor';
import { Action, Actions } from '../../store/_doc/Actions';
import { TextDecoder } from 'util';
import { Uri } from 'vscode';
import { ENCODING } from '../../constants';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import {
  AddElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/Telemetry';
import { EndevorId } from '../../store/_doc/v2/Store';
import { getFileExtensionResolution } from '../../settings/settings';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';

export const addElementFromFileSystem = async (
  configurations: ConnectionConfigurations,
  dispatch: (action: Action) => Promise<void>,
  searchLocationNode: LocationNode
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
  });
  const fileUri = await chooseFileUriFromFs();
  if (!fileUri) {
    return;
  }
  const { fileName, fullFileName } = parseFilePath(fileUri.path);
  if (!fileName) {
    logger.error(`Unable to add the element ${fileName}.`);
    return;
  }
  const content = await readElementContent(fileUri.path);
  if (isError(content)) {
    const error = content;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
      status: AddElementCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    logger.error(
      `Unable to read the element content.`,
      `Unable to read the element content because of error ${error.message}.`
    );
    return;
  }
  const serviceId = resolveServiceId(searchLocationNode);
  if (!serviceId) {
    logger.error(`Unable to add the element ${fileName}.`);
    return;
  }
  const searchLocationId = resolveSearchLocationId(searchLocationNode);
  if (!searchLocationId) {
    logger.error(`Unable to add the element ${fileName}.`);
    return;
  }
  const connectionParams = await getConnectionConfiguration(configurations)(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const { service, configuration, searchLocation } = connectionParams;
  const connectionDetails = await configurations.getConnectionDetails(
    serviceId
  );
  if (!connectionDetails) {
    logger.error(`Unable to add the element ${fileName}.`);
    return;
  }
  const fileNameToShow = selectFileNameToShow(fileName, fullFileName);
  const addValues = await askForAddValues(
    {
      configuration,
      ...searchLocation,
    },
    fileNameToShow
  );
  if (isError(addValues)) {
    const error = addValues;
    logger.error(error.message);
    return;
  }
  const [addLocation, actionControlValue] = addValues;
  const addResult = await addNewElement(service)(configuration)({
    ...addLocation,
  })(actionControlValue)(content, fileUri.fsPath);
  if (isErrorEndevorResponse(addResult)) {
    const errorResponse = addResult;
    // TODO: format using all possible error details
    const error = new Error(
      `Unable to add the element ${
        addLocation.id
      } to Endevor because of an error:${formatWithNewLines(
        errorResponse.details.messages
      )}`
    );
    switch (errorResponse.type) {
      case ErrorResponseType.DUPLICATE_ELEMENT_ENDEVOR_ERROR:
        logger.error(
          `Unable to add the element ${fileName} because an element with this name already exists.`,
          `${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
          status: AddElementCommandCompletedStatus.DUPLICATED_ELEMENT_ERROR,
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
          errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
          status: AddElementCommandCompletedStatus.GENERIC_ERROR,
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
          errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
          status: AddElementCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      case ErrorResponseType.GENERIC_ERROR:
        logger.error(
          `Unable to add the element ${fileName} to Endevor.`,
          `${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED,
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
  logger.info('Add successful!');
};

const addNewElement =
  (service: Service) =>
  (configuration: Value) =>
  (element: ElementMapPath) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  async (content: string, elementFilePath: string): Promise<AddResponse> => {
    const addResult = await withNotificationProgress(
      `Adding element: ${element.id}.`
    )((progressReporter) => {
      return addElement(progressReporter)(service)(configuration)(element)(
        uploadChangeControlValue
      )({
        content,
        elementFilePath,
      });
    });
    return addResult;
  };

const askForAddValues = async (
  searchLocation: ElementSearchLocation,
  name: string
): Promise<Error | [ElementMapPath, ActionChangeControlValue]> => {
  const addLocation = await askForAddLocation({
    environment: searchLocation.environment,
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system,
    subsystem: searchLocation.subsystem,
    type: searchLocation.type,
    element: name,
  });
  if (addLocationDialogCancelled(addLocation)) {
    return new Error(`Add location must be specified to add element ${name}.`);
  }

  const addChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(addChangeControlValue)) {
    return new Error(
      `CCID and Comment must be specified to add element ${addLocation.id}.`
    );
  }
  return [addLocation, addChangeControlValue];
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
  serviceLocationArg: LocationNode
): EndevorId | undefined => {
  return {
    name: serviceLocationArg.serviceName,
    source: serviceLocationArg.serviceSource,
  };
};

const resolveSearchLocationId = (
  serviceLocationArg: LocationNode
): EndevorId | undefined => {
  return {
    name: serviceLocationArg.name,
    source: serviceLocationArg.source,
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
