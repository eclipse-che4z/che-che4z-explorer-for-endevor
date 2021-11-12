/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { QuickPickItem, QuickPickOptions } from 'vscode';
import { logger } from '../../globals';
import {
  showInputBox,
  showVscodeQuickPick,
} from '@local/vscode-wrapper/window';
import {
  ElementSearchLocation,
  StageNumber,
} from '@local/endevor/_doc/Endevor';
import { ANY_VALUE } from '@local/endevor/const';

type ChosenLocationName = string;
type CreatedLocation = {
  name: string;
  value: ElementSearchLocation;
};
type OperationCancelled = undefined;
type DialogResult = ChosenLocationName | CreatedLocation | OperationCancelled;

export const dialogCancelled = (
  value: DialogResult
): value is OperationCancelled => {
  return value === undefined;
};

export const locationChosen = (
  value: DialogResult
): value is ChosenLocationName => {
  return typeof value === 'string';
};

export const askForElementLocationOrCreateNew =
  (dialogRestrictions: {
    unusedLocations: ReadonlyArray<string>;
    allLocations: ReadonlyArray<string>;
  }) =>
  async (
    getInstanceNames: () => Promise<ReadonlyArray<string>>
  ): Promise<DialogResult> => {
    const createNewLocationItem: QuickPickItem = {
      label: '+ Create a New Endevor location Profile',
    };
    const choice = await showLocationsInQuickPick([
      createNewLocationItem,
      ...dialogRestrictions.unusedLocations.map(toQuickPickItem),
    ]);
    if (operationCancelled(choice) || valueNotProvided(choice)) {
      logger.trace('No location profile name was provided.');
      logger.trace('Operation cancelled.');
      return undefined;
    }
    if (choice.label === createNewLocationItem.label) {
      const locationName = await askForLocationName(
        dialogRestrictions.allLocations
      );
      if (operationCancelled(locationName) || valueNotProvided(locationName)) {
        logger.trace('No new location profile name was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      const existingInstances = await getInstanceNames();
      const locationValue = await askForLocationValue(existingInstances);
      if (
        operationCancelled(locationValue) ||
        valueNotProvided(locationValue)
      ) {
        logger.trace('No location profile value was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      return {
        name: locationName,
        value: locationValue,
      };
    }
    return choice.label;
  };

const toQuickPickItem = (input: string): QuickPickItem => {
  return {
    label: input,
  };
};

const showLocationsInQuickPick = async (
  locations: QuickPickItem[]
): Promise<QuickPickItem | undefined> => {
  const quickPickOptions: QuickPickOptions = {
    placeHolder: 'Select from available location profiles or create a new one',
    ignoreFocusOut: true,
  };
  return showVscodeQuickPick(locations, quickPickOptions);
};

const operationCancelled = <T>(value: T | undefined): value is undefined => {
  return value == undefined;
};

const valueNotProvided = <T>(value: T | undefined): value is undefined => {
  if (typeof value == 'boolean') {
    return !value.toString();
  }
  return !value;
};

const askForLocationName = async (
  existingElementLocations: ReadonlyArray<string>
): Promise<string | undefined> => {
  logger.trace('Prompt for location profile name.');
  return showInputBox({
    prompt: 'Custom name for Endevor location profile',
    placeHolder: 'Custom name for Endevor location profile',
    validateInput: (inputValue) =>
      inputValue.length
        ? inputValue.includes(' ')
          ? 'Profile name must not contain spaces'
          : existingElementLocations.some((name) => name === inputValue)
          ? 'A profile with this name already exists. Please enter a different name.'
          : undefined
        : 'Profile name must not be empty.',
  });
};

const askForLocationValue = async (
  existingInstanceNames: ReadonlyArray<string>
): Promise<ElementSearchLocation | undefined> => {
  const instance = await askForInstanceName(existingInstanceNames);
  if (operationCancelled(instance) || valueNotProvided(instance)) {
    logger.trace('No instance was provided.');
    return undefined;
  }
  const endevorPath = await askForEndevorPath();
  if (operationCancelled(endevorPath) || valueNotProvided(endevorPath)) {
    logger.trace('No Endevor path was provided.');
    return undefined;
  }
  const ccid = await askForCcid();
  if (operationCancelled(ccid)) {
    logger.trace('No ccid was provided.');
    return undefined;
  }
  const comment = await askForComment();
  if (operationCancelled(comment)) {
    logger.trace('No comment was provided.');
    return undefined;
  }
  return {
    instance,
    environment: endevorPath.environment,
    system: endevorPath.system,
    subsystem: endevorPath.subsystem,
    stageNumber: endevorPath.stageNumber,
    type: endevorPath.type,
    ccid,
    comment,
  };
};

const askForInstanceName = async (
  existingInstanceNames: ReadonlyArray<string>
): Promise<string | undefined> => {
  logger.trace('Prompt for Endevor instance.');
  const choice = await showVscodeQuickPick(
    existingInstanceNames.map(toQuickPickItem),
    {
      placeHolder: 'Select from instances available under your profile',
      ignoreFocusOut: true,
      canPickMany: false,
    }
  );
  if (!choice) {
    return undefined;
  }
  return choice.label;
};

type EndevorPath = Readonly<{
  environment: string;
  stageNumber: '1' | '2';
  system: string;
  subsystem: string;
  type: string;
}>;

// TODO: rewrite this function with better approach or go away for such endevor path asking
const askForEndevorPath = async (): Promise<EndevorPath | undefined> => {
  logger.trace('Prompt for Endevor path.');
  const pathDelimiter = '/';
  const pathPartNames = [
    'environment',
    'stageNum',
    'system',
    'subsystem',
    'type',
  ];
  const prettyPartNames = pathPartNames.join(pathDelimiter);

  type Result<T> = T | Error;
  const isError = <T>(result: Result<T>): result is Error => {
    return result instanceof Error;
  };
  const buildEndevorPath = (pathParts: string[]): Result<EndevorPath> => {
    const pathPartsRequiredAmount = pathPartNames.length;
    if (pathParts.length < pathPartsRequiredAmount) {
      return new Error(`should be ${prettyPartNames} specified`);
    }
    const environmentIndex = pathPartNames.indexOf('environment');
    const environment = validateEnvironment(pathParts[environmentIndex]);
    if (isError(environment)) {
      const validationError = environment;
      return validationError;
    }
    const stageIndex = pathPartNames.indexOf('stageNum');
    const stageNumber = validateStageNumber(pathParts[stageIndex]);
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
    const subsystem = validateValue(
      pathParts[subsystemIndex],
      pathPartNames[subsystemIndex]
    );
    if (isError(subsystem)) {
      const validationError = subsystem;
      return validationError;
    }
    const typeIndex = pathPartNames.indexOf('type');
    const type = validateValue(pathParts[typeIndex], pathPartNames[typeIndex]);
    if (isError(type)) {
      const validationError = type;
      return validationError;
    }
    return {
      environment,
      stageNumber,
      system,
      subsystem,
      type,
    };
  };
  const validateValue = (
    value: string | undefined,
    partName: string | undefined
  ): Result<string> => {
    const onlyCharactersUpToLengthEight = '^.{1,8}$';
    if (value && value.match(onlyCharactersUpToLengthEight)) {
      return value;
    }
    return new Error(
      `${partName} is incorrect, should be defined (can be '*') and contain up to 8 symbols.`
    );
  };

  const validateEnvironment = (value: string | undefined): Result<string> => {
    const onlyCharactersUpToLengthEight = '^.{1,8}$';
    if (
      value &&
      value.match(onlyCharactersUpToLengthEight) &&
      value !== ANY_VALUE
    ) {
      return value;
    }
    return new Error(
      `Environment is incorrect, should be defined (cannot be '*') and contain up to 8 symbols.`
    );
  };

  const validateStageNumber = (
    stage: string | undefined
  ): Result<StageNumber> => {
    if (stage === '1' || stage === '2') {
      return stage;
    }
    return new Error('Stage number is incorrect, should be only "1" or "2".');
  };

  const rawEndevorPath = await showInputBox({
    prompt: 'Enter the Endevor path for the location profile.',
    placeHolder: prettyPartNames,
    validateInput: (value) => {
      const endevorPath = buildEndevorPath(value.split(pathDelimiter));
      if (isError(endevorPath)) {
        const validationError = endevorPath;
        return validationError.message;
      }
      return undefined;
    },
  });
  if (operationCancelled(rawEndevorPath) || valueNotProvided(rawEndevorPath)) {
    return undefined;
  }
  const endevorPath = buildEndevorPath(rawEndevorPath.split(pathDelimiter));
  if (isError(endevorPath)) {
    const validationError = endevorPath;
    logger.error(
      'Endevor path is incorrect.',
      `Endevor path parsing error: ${validationError.message}.`
    );
    return undefined;
  }
  return endevorPath;
};

const askForCcid = async (): Promise<string | undefined> => {
  logger.trace('Prompt for CCID.');
  const ccidMaxLength = 12;
  return showInputBox({
    prompt: 'Enter the CCID for the location profile.',
    placeHolder: '(Optional) CCID',
    validateInput: (value) => {
      if (value.length > ccidMaxLength) {
        return `CCID can be up to ${ccidMaxLength} characters only!`;
      }
      return undefined;
    },
  });
};

const askForComment = async (): Promise<string | undefined> => {
  logger.trace('Prompt for comment.');
  const commentMaxLength = 40;
  return showInputBox({
    prompt: 'Enter the comment for the location profile.',
    placeHolder: '(Optional) Comment',
    validateInput: (value) => {
      if (value.length > commentMaxLength) {
        return `Comment can be up to ${commentMaxLength} characters only!`;
      }
      return undefined;
    },
  });
};
