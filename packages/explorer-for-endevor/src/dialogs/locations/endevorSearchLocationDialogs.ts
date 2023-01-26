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

import { QuickPick, QuickPickItem } from 'vscode';
import { logger } from '../../globals';
import {
  showInputBox,
  showVscodeQuickPick,
  createVscodeQuickPick,
  showModalWithOptions,
  showMessageWithOptions,
} from '@local/vscode-wrapper/window';
import {
  ElementSearchLocation,
  Configuration,
  StageNumber,
} from '@local/endevor/_doc/Endevor';
import { ANY_VALUE } from '@local/endevor/const';
import {
  isDefined,
  isError,
  isTimeoutError,
  toPromiseWithTimeout,
} from '../../utils';
import {
  CachedElement,
  ElementFilterType,
  EndevorId,
  ValidEndevorSearchLocationDescription,
  ValidEndevorSearchLocationDescriptions,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  FILTER_VALUE_DEFAULT,
  FILTER_DELIMITER,
  NOTIFICATION_TIMEOUT,
  ZOWE_PROFILE_DESCRIPTION,
} from '../../constants';
import { QuickPickOptions } from '@local/vscode-wrapper/_doc/window';
import { ConnectionError } from '@local/endevor/_doc/Error';
import { isConnectionError } from '@local/endevor/utils';
import { getFirstFoundFilteredElement } from '../../store/utils';

const enum DialogResultTypes {
  CREATED = 'CREATED',
  CHOSEN = 'CHOSEN',
}
type CreatedLocation = {
  type: DialogResultTypes.CREATED;
  id: {
    name: string;
    source: Source.INTERNAL;
  };
  value: ElementSearchLocation;
};
type ChosenLocation = {
  type: DialogResultTypes.CHOSEN;
  id: EndevorId;
};
type OperationCancelled = undefined;
type ChooseDialogResult = ChosenLocation | OperationCancelled;
type DialogResult = CreatedLocation | ChosenLocation | OperationCancelled;

export const dialogCancelled = (
  value: DialogResult
): value is OperationCancelled => {
  return value === undefined;
};

export const locationChosen = (
  value: DialogResult
): value is ChosenLocation => {
  return value?.type === DialogResultTypes.CHOSEN;
};

export interface LocationQuickPickItem extends QuickPickItem {
  id?: EndevorId;
}

export const askForSearchLocationOrCreateNew =
  (dialogRestrictions: {
    locationsToChoose: ValidEndevorSearchLocationDescriptions;
    allExistingLocationNames: ReadonlyArray<string>;
  }) =>
  async (
    getConfigurations: () => Promise<
      ReadonlyArray<Configuration> | Error | undefined
    >
  ): Promise<DialogResult | ConnectionError> => {
    const createNewLocationItem: QuickPickItem = {
      label: '+ Create a new inventory location',
      alwaysShow: true,
    };
    const choice = await showLocationsInQuickPick([
      createNewLocationItem,
      ...Object.values(dialogRestrictions.locationsToChoose).map(
        toLocationQuickPickItem
      ),
    ]);
    if (
      operationCancelled(choice) ||
      valueNotProvided(choice) ||
      !isDefined(choice.activeItems[0])
    ) {
      logger.trace('No inventory location name was provided.');
      logger.trace('Operation cancelled.');
      return undefined;
    }
    if (choice.activeItems[0].label === createNewLocationItem.label) {
      let locationName;
      if (!isDefined(choice.value) || choice.value.length === 0) {
        locationName = await askForLocationName(
          dialogRestrictions.allExistingLocationNames
        );
      } else if (
        dialogRestrictions.allExistingLocationNames.includes(choice.value)
      ) {
        logger.warn(
          `Inventory location with name ${choice.value} already exists, please, provide a new name.`
        );
        locationName = await askForLocationName(
          dialogRestrictions.allExistingLocationNames
        );
      } else {
        locationName = choice.value;
      }
      if (operationCancelled(locationName) || valueNotProvided(locationName)) {
        logger.trace('No new inventory location name was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      const existingConfigurations = await getConfigurations();
      if (!existingConfigurations) {
        logger.trace('Operation cancelled.');
        return undefined;
      }
      if (isConnectionError(existingConfigurations)) {
        const error = existingConfigurations;
        return error;
      }
      if (isError(existingConfigurations)) {
        const error = existingConfigurations;
        logger.error(
          'Unable to fetch the list of Endevor configurations.',
          `${error.message}.`
        );
        logger.trace('Operation cancelled.');
        return undefined;
      }
      if (!existingConfigurations.length) {
        logger.error(
          'Unable to fetch the list of Endevor configurations.',
          'The list of Endevor configurations is empty.'
        );
        logger.trace('Operation cancelled.');
        return undefined;
      }
      const locationValue = await askForLocationValue(existingConfigurations);
      if (
        operationCancelled(locationValue) ||
        valueNotProvided(locationValue)
      ) {
        logger.trace('No inventory location value was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      return {
        type: DialogResultTypes.CREATED,
        id: {
          name: locationName,
          source: Source.INTERNAL,
        },
        value: locationValue,
      };
    }
    const location = choice.activeItems[0];
    if (!location || !location.id) return undefined;
    return {
      type: DialogResultTypes.CHOSEN,
      id: location.id,
    };
  };

export const askForSearchLocation = async (
  locationsToChoose: ValidEndevorSearchLocationDescriptions
): Promise<ChooseDialogResult> => {
  const locationQuickPickItems = Object.values(locationsToChoose).map(
    toLocationQuickPickItem
  );
  if (!locationQuickPickItems.length) {
    logger.warn('No inventory locations to select from.');
    return undefined;
  }
  const quickPickOptions: QuickPickOptions = {
    title: 'Select from the available inventory locations',
    placeholder: 'Start typing a name to filter...',
    ignoreFocusOut: true,
  };
  const choice = await createVscodeQuickPick(
    locationQuickPickItems,
    quickPickOptions
  );
  if (
    operationCancelled(choice) ||
    valueNotProvided(choice) ||
    !isDefined(choice.activeItems[0])
  ) {
    logger.trace('No inventory location name was provided.');
    logger.trace('Operation cancelled.');
    return undefined;
  }
  const location = choice.activeItems[0];
  if (!location || !location.id) return undefined;
  return {
    type: DialogResultTypes.CHOSEN,
    id: location.id,
  };
};

const toLocationQuickPickItem = ({
  id,
  path,
  duplicated,
}: ValidEndevorSearchLocationDescription): LocationQuickPickItem => {
  const locationQuickPickItem: LocationQuickPickItem = {
    label: id.name,
    detail: path,
    id,
  };
  switch (id.source) {
    case Source.INTERNAL:
      return locationQuickPickItem;
    case Source.SYNCHRONIZED: {
      if (!duplicated) return locationQuickPickItem;
      return {
        ...locationQuickPickItem,
        description: ZOWE_PROFILE_DESCRIPTION,
      };
    }
    default:
      throw new UnreachableCaseError(id.source);
  }
};

const showLocationsInQuickPick = async (
  locations: LocationQuickPickItem[]
): Promise<QuickPick<LocationQuickPickItem> | undefined> => {
  const quickPickOptions: QuickPickOptions = {
    title: 'Add an inventory location',
    placeholder:
      'Choose "Create new..." to define a new inventory location or select an existing one',
    ignoreFocusOut: true,
  };
  return createVscodeQuickPick(locations, quickPickOptions);
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
  logger.trace('Prompt for inventory location name.');
  return showInputBox({
    title: 'Enter a name for the new inventory location',
    prompt: 'Must not contain spaces',
    placeHolder: 'Inventory location name',
    validateInput: (inputValue) =>
      inputValue.length
        ? inputValue.includes(' ')
          ? 'Inventory location name must not contain spaces'
          : existingElementLocations.some((name) => name === inputValue)
          ? 'An inventory location with this name already exists. Please enter a different name.'
          : undefined
        : 'Inventory location name must not be empty.',
  });
};

const askForLocationValue = async (
  existingConfigurations: ReadonlyArray<Configuration>
): Promise<ElementSearchLocation | undefined> => {
  const configuration = await askForConfigurationName(existingConfigurations);
  if (operationCancelled(configuration) || valueNotProvided(configuration)) {
    logger.trace('No Endevor configuration was provided.');
    return undefined;
  }
  const endevorPath = await askForEndevorPath();
  if (operationCancelled(endevorPath) || valueNotProvided(endevorPath)) {
    logger.trace('No map path was provided.');
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
    configuration,
    environment: endevorPath.environment,
    system: endevorPath.system,
    subsystem: endevorPath.subsystem,
    stageNumber: endevorPath.stageNumber,
    type: endevorPath.type,
    ccid,
    comment,
  };
};

const toQuickPickItem = ({
  name,
  description,
}: {
  name: string;
  description?: string;
}): QuickPickItem => {
  return {
    label: name,
    detail: description,
  };
};

const askForConfigurationName = async (
  existingConfigurations: ReadonlyArray<Configuration>
): Promise<string | undefined> => {
  logger.trace('Prompt for Endevor configuration.');
  const choice = await showVscodeQuickPick(
    existingConfigurations.map(toQuickPickItem),
    {
      title: 'Select from the available Endevor configurations',
      placeholder: 'Start typing to filter...',
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
  logger.trace('Prompt for map path.');
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
    prompt: 'Enter the map path for the inventory location.',
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
    prompt: 'Enter the CCID for the actions.',
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
    prompt: 'Enter the comment for the actions.',
    placeHolder: '(Optional) Comment',
    validateInput: (value) => {
      if (value.length > commentMaxLength) {
        return `Comment can be up to ${commentMaxLength} characters only!`;
      }
      return undefined;
    },
  });
};

export const askForSearchLocationDeletion = async (
  searchLocationName: string
): Promise<boolean> => {
  logger.trace(
    `Prompt for inventory location '${searchLocationName}' deletion.`
  );
  const deleteOption = 'Delete';
  const dialogResult = await showModalWithOptions({
    message: `Do you want to delete the '${searchLocationName}' inventory location?`,
    detail: 'Warning: this action cannot be undone.',
    options: [deleteOption],
  });
  if (operationCancelled(dialogResult)) {
    logger.trace(
      `Deletion of the '${searchLocationName}' inventory location was cancelled.`
    );
    return false;
  }
  return true;
};

type ChosenDeletionOption = Readonly<{
  deleteForAllServices: boolean;
}>;

export const askToDeleteSearchLocationForAllServices = async (
  searchLocationName: string,
  selectedServiceName: string,
  serviceNames: ReadonlyArray<string>
): Promise<ChosenDeletionOption | OperationCancelled> => {
  logger.trace(
    `Prompt user for deletion of ${searchLocationName} from Endevor services: ${JSON.stringify(
      serviceNames
    )}.`
  );
  const deleteOption = 'Delete';
  const hideOption = 'Hide';
  const dialogResult = await showModalWithOptions({
    message: `Do you want to delete the '${searchLocationName}' inventory location for the following ${serviceNames.length} Endevor connections or to hide it for the selected '${selectedServiceName}'?`,
    detail: `${serviceNames.join(
      '\n'
    )}\n\nWarning: the Delete action cannot be undone.`,
    options: [hideOption, deleteOption],
  });
  if (dialogResult === deleteOption) {
    return {
      deleteForAllServices: true,
    };
  }
  if (dialogResult === hideOption) {
    return {
      deleteForAllServices: false,
    };
  }
  return undefined;
};

export const askForSearchLocationFilterByElementName =
  (searchLocationName: string, value?: string) =>
  async (
    elements?: ReadonlyArray<CachedElement>
  ): Promise<string | undefined> => {
    let filterValue = await askForElementNameFilter(searchLocationName, value);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (operationCancelled(filterValue)) {
        logger.trace('Operation cancelled.');
        return;
      }
      if (filterValue === '') filterValue = FILTER_VALUE_DEFAULT;
      if (!elements) return filterValue;
      const filteredElement = getFirstFoundFilteredElement(elements)({
        type: ElementFilterType.ELEMENT_NAMES_FILTER,
        value: filterValue.split(FILTER_DELIMITER),
      });
      if (filteredElement) return filterValue;
      logger.warn('No Element names match the specified filter.');
      const tryAgain = await askForTryAgainOrContinue();
      if (tryAgain) {
        filterValue = await askForElementNameFilter(
          searchLocationName,
          filterValue
        );
        continue;
      }
      return filterValue;
    }
  };

export const askForElementNameFilter = async (
  searchLocationName: string,
  value?: string
): Promise<string | undefined> => {
  logger.trace(
    `Prompt for filter by Element name pattern(s) for the inventory location ${searchLocationName}.`
  );
  return showInputBox({
    title: `Edit Element name filter for ${searchLocationName}`,
    prompt:
      'Enter a list of Element name pattern(s) to filter by. Use a comma to separate multiple values.',
    placeHolder: 'Pattern(s) with or without %, *: PATTERN1,PAT%ERN2,PAT*',
    value,
    validateInput: (value) => {
      const filters = buildFilter(value.split(FILTER_DELIMITER));
      if (isError(filters)) {
        const validationError = filters;
        return validationError.message;
      }
      return undefined;
    },
  });
};

export const askForSearchLocationFilterByElementCcid =
  (searchLocationName: string, value?: string) =>
  async (elements?: ReadonlyArray<CachedElement>) => {
    let filterValue = await askForElementLastActionCcidFilter(
      searchLocationName,
      value
    );
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (operationCancelled(filterValue)) {
        logger.trace('Operation cancelled.');
        return;
      }
      if (filterValue === '') filterValue = FILTER_VALUE_DEFAULT;
      if (!elements) return filterValue;
      const filteredElements = getFirstFoundFilteredElement(elements)({
        type: ElementFilterType.ELEMENT_CCIDS_FILTER,
        value: filterValue.split(FILTER_DELIMITER),
      });
      if (filteredElements) return filterValue;
      logger.warn('No Element last action CCID match the specified filter.');
      const tryAgain = await askForTryAgainOrContinue();
      if (tryAgain) {
        filterValue = await askForElementLastActionCcidFilter(
          searchLocationName,
          filterValue
        );
        continue;
      }
      return filterValue;
    }
  };

export const askForElementLastActionCcidFilter = async (
  searchLocationName: string,
  value?: string
): Promise<string | undefined> => {
  logger.trace(
    `Prompt for filter by Element last action CCID pattern(s) for the inventory location ${searchLocationName}.`
  );
  return showInputBox({
    title: `Edit Element last action CCID filter for ${searchLocationName}`,
    prompt:
      'Enter a list of Element last action CCID pattern(s) to filter by. Use a comma to separate multiple values.',
    placeHolder:
      'Pattern(s) with or without wildcards %, *: PATTERN1,PAT%ERN2,PAT*',
    value,
    validateInput: (value) => {
      const filters = buildFilter(value.split(FILTER_DELIMITER));
      if (isError(filters)) {
        const validationError = filters;
        return validationError.message;
      }
      return undefined;
    },
  });
};

export const askForTryAgainOrContinue = async (): Promise<boolean> => {
  logger.trace('Prompt user to try again or continue.');
  const tryAgainOption = 'Try again';
  const continueOption = 'Continue';
  const dialogResult = await toPromiseWithTimeout(NOTIFICATION_TIMEOUT)(
    showMessageWithOptions({
      message:
        'Would you want to correct the filter pattern(s) or to continue with the provided value?',
      options: [tryAgainOption, continueOption],
    })
  );
  if (isTimeoutError(dialogResult)) {
    logger.trace('Nothing was selected, try again.');
    return true;
  }
  if (dialogResult === tryAgainOption) {
    logger.trace('Try again was selected.');
    return true;
  }
  if (dialogResult === continueOption) {
    logger.trace('Continue with current filter was selected.');
    return false;
  }
  logger.trace('Dialog was closed, try again.');
  return true;
};

const buildFilter = (filters: string[]): void | Error => {
  for (let index = 0; index < filters.length; index++) {
    const filter = filters[index];
    if (filter !== undefined) {
      const validatedFilter = validateFilterValue(
        index,
        filter,
        filters.length
      );
      if (isError(validatedFilter)) {
        const error = validatedFilter;
        return error;
      }
    }
  }
};

const validateFilterValue = (
  index: number,
  value: string,
  numberOfFilters: number
): void | Error => {
  const validationPattern = '^[^/<>|:&?]{0,255}$';
  const maxLength = 256;
  const actualPatternNumber = index + 1;
  if ((value.length > 0 || numberOfFilters > 1) && value.trim() === '') {
    return new Error(
      `Pattern number ${actualPatternNumber} cannot be empty or contain only whitespace(s).`
    );
  }
  if (value.endsWith(' ') || value.startsWith(' ')) {
    return new Error(
      `Pattern ${value} cannot start or end with whitespace(s).`
    );
  }
  if (value.length > maxLength) {
    return new Error(
      `Pattern number ${actualPatternNumber} cannot be longer than 255 symbols.`
    );
  }
  if (!value.match(validationPattern)) {
    return new Error(`Pattern ${value} cannot contain forbidden symbols.`);
  }
  return;
};
