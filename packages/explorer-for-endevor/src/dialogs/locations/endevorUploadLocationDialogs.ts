/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { ANY_VALUE } from '@local/endevor/const';
import {
  ElementMapPath,
  ElementSearchLocation,
  StageNumber,
} from '@local/endevor/_doc/Endevor';
import { showInputBox } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';
import { isError } from '../../utils';

type OperationCancelled = undefined;
type DialogResult = ElementMapPath | OperationCancelled;

export const dialogCancelled = (
  dialogResult: DialogResult
): dialogResult is OperationCancelled => {
  return dialogResult === undefined;
};

export const askForUploadLocation = async (
  defaultValue: ElementSearchLocation
): Promise<DialogResult> => {
  logger.trace('Prompt for upload location for the element.');
  const pathDelimiter = '/';
  const pathPartNames = [
    'environment',
    'stageNum',
    'system',
    'subsystem',
    'type',
    'element',
  ];
  const prettyPartNames = pathPartNames.join(pathDelimiter);

  type Result<T> = T | Error;
  const buildUploadPath = (pathParts: string[]): Result<ElementMapPath> => {
    const pathPartsRequiredAmount = pathPartNames.length;
    if (pathParts.length < pathPartsRequiredAmount) {
      return new Error(`should be ${prettyPartNames} specified`);
    }
    const environmentIndex = pathPartNames.indexOf('environment');
    const environment = validateValue(
      pathParts[environmentIndex],
      pathPartNames[environmentIndex]
    );
    if (isError(environment)) {
      const validationError = environment;
      return validationError;
    }
    const stageIndex = pathPartNames.indexOf('stageNum');
    const stageNumber = validateEndevorStage(pathParts[stageIndex]);
    if (isError(stageNumber)) {
      const validationError = stageNumber;
      return validationError;
    }
    const systemIndex = pathPartNames.indexOf('system');
    const system = validateValue(
      pathParts[systemIndex],
      pathPartNames[systemIndex]
    );
    if (isError(system)) {
      const validationError = system;
      return validationError;
    }
    const subsystemIndex = pathPartNames.indexOf('subsystem');
    const subSystem = validateValue(
      pathParts[subsystemIndex],
      pathPartNames[subsystemIndex]
    );
    if (isError(subSystem)) {
      const validationError = subSystem;
      return validationError;
    }
    const typeIndex = pathPartNames.indexOf('type');
    const type = validateValue(pathParts[typeIndex], pathPartNames[typeIndex]);
    if (isError(type)) {
      const validationError = type;
      return validationError;
    }
    const elementIndex = pathPartNames.indexOf('element');
    const name = validateValue(
      pathParts[elementIndex],
      pathPartNames[elementIndex]
    );
    if (isError(name)) {
      const validationError = name;
      return validationError;
    }
    return {
      environment,
      stageNumber,
      system,
      subSystem,
      type,
      name,
      instance: defaultValue.instance,
    };
  };
  const validateValue = (
    value: string | undefined,
    partName: string | undefined
  ): Result<string> => {
    // * is a wildcard in Endevor
    const validationPattern = '^[^\\*]{1,8}$';
    if (value && value.match(validationPattern) && value !== ANY_VALUE) {
      return value;
    }
    return new Error(
      `${partName} is incorrect, should be defined (cannot be '*') and contain up to 8 symbols.`
    );
  };

  const validateEndevorStage = (
    stage: string | undefined
  ): Result<StageNumber> => {
    if (stage === '1' || stage === '2') {
      return stage;
    }
    return new Error('Stage number is incorrect, should be only "1" or "2".');
  };

  const buildPrefilledValue =
    (value: ElementSearchLocation) =>
    (delimiter: string): string => {
      const env = value.environment;
      const stage = value.stageNumber;
      const sys = value.system;
      const subsys = value.subsystem;
      const type = value.type;
      const name = value.element;
      return [
        env ? (env !== ANY_VALUE ? env : '*ENV*') : '*ENV*',
        stage ?? '*STGNUM*',
        sys ? (sys !== ANY_VALUE ? sys : '*SYS*') : '*SYS*',
        subsys ? (subsys !== ANY_VALUE ? subsys : '*SUBSYS*') : '*SUBSYS*',
        type ? (type !== ANY_VALUE ? type : '*TYPE*') : '*TYPE*',
        name ?? '*NAME*',
      ].join(delimiter);
    };
  const prefilledValue = buildPrefilledValue(defaultValue)(pathDelimiter);

  const rawEndevorPath = await showInputBox({
    prompt: 'Enter the Endevor path where the element will be uploaded.',
    placeHolder: prettyPartNames,
    value: prefilledValue,
    validateInput: (value) => {
      const uploadPath = buildUploadPath(value.split(pathDelimiter));
      if (isError(uploadPath)) {
        const validationError = uploadPath;
        return validationError.message;
      }
      return undefined;
    },
  });
  if (operationIsCancelled(rawEndevorPath)) {
    logger.trace('No upload location for element was provided.');
    logger.trace('Operation cancelled.');
    return undefined;
  }
  const uploadPath = buildUploadPath(rawEndevorPath.split(pathDelimiter));
  if (isError(uploadPath)) {
    const validationError = uploadPath;
    logger.error(
      'Endevor path is incorrect.',
      `Endevor path parsing error: ${validationError.message}.`
    );
    return undefined;
  }
  return uploadPath;
};

const operationIsCancelled = <T>(
  value: T | undefined
): value is OperationCancelled => {
  return value === undefined;
};
