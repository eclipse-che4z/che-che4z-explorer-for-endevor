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

import { QuickPick, QuickPickItem } from 'vscode';
import {
  showInputBox,
  showMessageWithOptions,
  createVscodeQuickPick,
  showModalWithOptions,
} from '@local/vscode-wrapper/window';
import { logger, reporter } from '../../globals';
import {
  ApiVersionResponse,
  ErrorResponseType,
  ServiceBasePath,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { isErrorEndevorResponse, toUrlParms } from '@local/endevor/utils';
import {
  formatWithNewLines,
  isDefined,
  isError,
  moveItemInFrontOfArray,
  toServiceUrl,
} from '../../utils';
import {
  NOTIFICATION_TIMEOUT,
  ZOWE_PROFILE_DESCRIPTION,
} from '../../constants';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/Telemetry';
import {
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorId,
  ExistingEndevorServiceDescriptions,
  InvalidEndevorServiceDescription,
  ValidEndevorServiceDescription,
} from '../../store/_doc/v2/Store';
import { Id, Source } from '../../store/storage/_doc/Storage';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { QuickPickOptions } from '@local/vscode-wrapper/_doc/window';
import {
  askForPassword,
  askForUsername,
  defaultPasswordPolicy,
  EmptyValue,
  emptyValueProvided,
} from '../credentials/endevorCredentialDialogs';
import {
  BaseCredential,
  Credential,
  CredentialType,
} from '@local/endevor/_doc/Credential';
import { isTimeoutError, toPromiseWithTimeout } from '../utils';

const enum DialogResultTypes {
  CREATED = 'CREATED',
  CHOSEN = 'CHOSEN',
}

type CreatedService = {
  type: DialogResultTypes.CREATED;
  id: {
    name: string;
    source: Source.INTERNAL;
  };
  value: Readonly<{
    connection: EndevorConnection;
    credential: Credential | undefined;
  }>;
};
type ChosenService = {
  type: DialogResultTypes.CHOSEN;
  id: EndevorId;
};
type OperationCancelled = undefined;
type ChooseDialogResult = ChosenService | OperationCancelled;
type DialogResult = CreatedService | ChosenService | OperationCancelled;

export const dialogCancelled = (
  value: DialogResult
): value is OperationCancelled => {
  return value === undefined;
};

export const serviceChosen = (value: DialogResult): value is ChosenService => {
  return value?.type === DialogResultTypes.CHOSEN;
};

export interface ServiceQuickPickItem extends QuickPickItem {
  id?: EndevorId;
}

const serviceUrlPlaceholder =
  'http[s]://hostname:port[/EndevorService/(api/v2,api/v1,rest)]';

export const askForServiceOrCreateNew =
  (dialogRestrictions: {
    servicesToChoose: ExistingEndevorServiceDescriptions;
    allExistingServices: ReadonlyArray<string>;
  }) =>
  async (
    testServiceLocation: (
      location: ServiceLocation,
      rejectUnauthorized: boolean
    ) => Promise<ApiVersionResponse | OperationCancelled>
  ): Promise<DialogResult> => {
    const createNewServiceItem: QuickPickItem = {
      label: '+ Create a new Endevor connection',
      alwaysShow: true,
    };
    const choice = await showServicesInQuickPick([
      createNewServiceItem,
      ...Object.values(dialogRestrictions.servicesToChoose).map((service) =>
        toServiceQuickPickItem(service)
      ),
    ]);
    if (
      operationCancelled(choice) ||
      valueNotProvided(choice) ||
      !isDefined(choice.activeItems[0])
    ) {
      logger.trace('Operation cancelled.');
      return undefined;
    }
    if (choice.activeItems[0].label === createNewServiceItem.label) {
      let serviceName;
      if (!isDefined(choice.value) || choice.value.length === 0) {
        serviceName = await askForServiceName(
          dialogRestrictions.allExistingServices
        );
      } else if (
        dialogRestrictions.allExistingServices.includes(choice.value)
      ) {
        logger.warn(
          `Endevor connection with the name ${choice.value} already exists, please, provide a new name.`
        );
        serviceName = await askForServiceName(
          dialogRestrictions.allExistingServices
        );
      } else {
        serviceName = choice.value;
      }
      if (operationCancelled(serviceName) || valueNotProvided(serviceName)) {
        logger.trace('No Endevor connection name was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      const serviceValue = await askForServiceValue(testServiceLocation);
      if (operationCancelled(serviceValue) || valueNotProvided(serviceValue)) {
        logger.trace('No Endevor connection value was provided.');
        logger.trace('Operation cancelled.');
        return undefined;
      }
      return {
        type: DialogResultTypes.CREATED,
        id: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        value: serviceValue,
      };
    }
    const service = choice.activeItems[0];
    if (!service || !service.id) return undefined;
    return {
      type: DialogResultTypes.CHOSEN,
      id: service.id,
    };
  };

export const askForService = async (
  servicesToChoose: ExistingEndevorServiceDescriptions,
  defaultServiceId?: Id,
  defaultServiceDesc?: string
): Promise<ChooseDialogResult> => {
  let defaultQuickPickItem;
  const serviceQuickPickItems = Object.values(servicesToChoose).map(
    (service) => {
      const isDefault = defaultServiceId === service.id;
      const quickPickItem = toServiceQuickPickItem(
        service,
        isDefault,
        isDefault ? defaultServiceDesc : undefined
      );
      if (isDefault) {
        defaultQuickPickItem = quickPickItem;
      }
      return quickPickItem;
    }
  );
  if (!serviceQuickPickItems.length) {
    logger.warn('No Endevor connections to select from.');
    return undefined;
  }
  moveItemInFrontOfArray(serviceQuickPickItems, defaultQuickPickItem);
  const quickPickOptions: QuickPickOptions = {
    title: 'Select from the available Endevor connections',
    placeholder: 'An Endevor connection name',
    ignoreFocusOut: true,
  };
  const choice = await createVscodeQuickPick(
    serviceQuickPickItems,
    quickPickOptions
  );
  if (
    operationCancelled(choice) ||
    valueNotProvided(choice) ||
    !isDefined(choice.activeItems[0])
  ) {
    logger.trace('Operation cancelled.');
    return undefined;
  }
  const service = choice.activeItems[0];
  if (!service || !service.id) return undefined;
  return {
    type: DialogResultTypes.CHOSEN,
    id: service.id,
  };
};

const toServiceQuickPickItem = (
  {
    id,
    duplicated,
    serviceLocation,
    credential,
  }: ValidEndevorServiceDescription | InvalidEndevorServiceDescription,
  isDefault?: boolean,
  description?: string
): ServiceQuickPickItem => {
  const serviceQuickPickItem: ServiceQuickPickItem = {
    label: id.name,
    detail: toServiceUrl(serviceLocation.location, credential),
    id,
    picked: !!isDefault,
    description,
  };

  switch (id.source) {
    case Source.INTERNAL:
      return serviceQuickPickItem;
    case Source.SYNCHRONIZED: {
      if (!duplicated) return serviceQuickPickItem;
      return {
        ...serviceQuickPickItem,
        description: ZOWE_PROFILE_DESCRIPTION,
      };
    }
    default:
      throw new UnreachableCaseError(id.source);
  }
};

const showServicesInQuickPick = async (
  services: ServiceQuickPickItem[]
): Promise<QuickPick<ServiceQuickPickItem> | undefined> => {
  const quickPickOptions: QuickPickOptions = {
    title: 'Add an Endevor connection',
    placeholder:
      'Choose "Create new..." to define a new Endevor connection or select an existing one',
    ignoreFocusOut: true,
  };
  return createVscodeQuickPick(services, quickPickOptions);
};

const operationCancelled = <T>(value: T | undefined): value is undefined => {
  return value === undefined;
};

const valueNotProvided = <T>(value: T | undefined): value is undefined => {
  if (typeof value === 'boolean') {
    return !value.toString();
  }
  return !value;
};

const parseServiceUrl = (
  urlString: string
):
  | ({ location: ServiceLocation } & Partial<{
      username: string;
      password: string;
    }>)
  | Error => {
  const { protocol, hostname, port, pathname, username, password } =
    toUrlParms(urlString);
  if (!protocol && !hostname) {
    return new Error(`Enter URL in the ${serviceUrlPlaceholder} format:`);
  }
  if (!protocol) {
    return new Error(`Protocol required`);
  }
  if (!hostname) {
    return new Error('Hostname required');
  }
  if (!port) {
    return new Error('Port required');
  }
  return {
    location: {
      protocol,
      hostname,
      port,
      basePath: pathname ? pathname : ServiceBasePath.V2,
    },
    username,
    password,
  };
};

const askForServiceName = async (
  existingServices: ReadonlyArray<string>
): Promise<string | undefined> => {
  logger.trace('Prompt for Endevor connection name.');
  return showInputBox({
    title: 'Enter a name for the new Endevor connection',
    prompt: 'Must not contain spaces',
    placeHolder: 'Endevor connection name',
    validateInput: (inputValue) =>
      inputValue.length
        ? inputValue.includes(' ')
          ? 'Endevor connection name must not contain spaces'
          : existingServices.some((serviceName) => serviceName === inputValue)
          ? 'An Endevor connection with this name already exists. Please enter a different name.'
          : undefined
        : 'Endevor connection name must not be empty',
  });
};

export const askForServiceValue = async (
  testServiceLocation: (
    location: ServiceLocation,
    rejectUnauthorized: boolean
  ) => Promise<ApiVersionResponse | OperationCancelled>,
  prefilledUrl?: string,
  prefilledCredential?: {
    user?: string;
    password?: string;
  }
): Promise<CreatedService['value'] | undefined> => {
  const serviceDetailsResult = await askForConnectionDetails(
    testServiceLocation,
    async () => !(await askForTryAgainOrContinue()),
    prefilledUrl
  );
  if (!serviceDetailsResult) return;
  const credential = prefilledCredential
    ? prefilledCredential
    : serviceDetailsResult.credential;
  if (!credential.user || !credential.password) {
    const credentialResult = await askForCredentialValue(defaultPasswordPolicy)(
      {
        user: credential.user,
        password: credential.password,
      }
    );
    if (emptyValueProvided(credentialResult)) {
      return {
        ...serviceDetailsResult,
        credential: undefined,
      };
    }
    if (operationCancelled(credentialResult)) {
      return;
    }
    return {
      ...serviceDetailsResult,
      credential: credentialResult,
    };
  }
  return {
    ...serviceDetailsResult,
    credential: {
      type: CredentialType.BASE,
      user: credential.user,
      password: credential.password,
    },
  };
};

export type ServiceDetailsResult = Readonly<{
  connection: EndevorConnection;
  credential: Partial<{
    user: string;
    password: string;
  }>;
}>;

export const askForConnectionDetails = async (
  testServiceLocation: (
    location: ServiceLocation,
    rejectUnauthorized: boolean
  ) => Promise<ApiVersionResponse | OperationCancelled>,
  continueWithError: () => Promise<boolean>,
  prefilledUrl?: string
): Promise<ServiceDetailsResult | undefined> => {
  let urlString = prefilledUrl;
  let rejectUnauthorized = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    urlString = await askForUrl(urlString);
    if (operationCancelled(urlString) || valueNotProvided(urlString)) {
      logger.trace('No URL was provided.');
      return;
    }
    const parsedService = parseServiceUrl(urlString);
    if (isError(parsedService)) {
      const error = parsedService;
      logger.error(error.message);
      return;
    }
    const apiVersionResponse = await testServiceLocation(
      parsedService.location,
      rejectUnauthorized
    );
    if (operationCancelled(apiVersionResponse)) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CANCELLED,
      });
      const tryAgain = !(await continueWithError());
      if (tryAgain) continue;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CONTINUE_WITH_CANCEL,
      });
      return {
        connection: {
          status: EndevorConnectionStatus.UNKNOWN,
          value: {
            rejectUnauthorized,
            ...parsedService,
          },
        },
        credential: {
          ...parsedService,
        },
      };
    }
    if (isErrorEndevorResponse(apiVersionResponse)) {
      const errorResponse = apiVersionResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to fetch Endevor Web Services API version because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.CERT_VALIDATION_ERROR: {
          logger.error(
            'Unable to validate Endevor Web Services certificate',
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
            status: ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR,
            error,
          });
          rejectUnauthorized = await askForRejectUnauthorizedConnections();
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.REJECT_UNAUTHORIZED_PROVIDED,
            context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
            rejectUnauthorized,
          });
          // immediately start again if the value was changed: true -> false
          if (!rejectUnauthorized) continue;
          const tryAgain = !(await continueWithError());
          if (tryAgain) continue;
          break;
        }
        case ErrorResponseType.CONNECTION_ERROR:
        case ErrorResponseType.GENERIC_ERROR: {
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          const tryAgain = !(await continueWithError());
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
            status: ServiceConnectionTestStatus.GENERIC_ERROR,
            error,
          });
          if (tryAgain) continue;
          break;
        }
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CONTINUE_WITH_ERROR,
      });
      return {
        connection: {
          status: EndevorConnectionStatus.INVALID,
          value: {
            rejectUnauthorized,
            ...parsedService,
          },
        },
        credential: {
          ...parsedService,
        },
      };
    }
    // TODO report warnings
    const apiVersion = apiVersionResponse.result;
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_CONNECTION_TEST,
      context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
      status: ServiceConnectionTestStatus.SUCCESS,
      apiVersion,
    });
    return {
      connection: {
        status: EndevorConnectionStatus.VALID,
        value: {
          rejectUnauthorized,
          ...parsedService,
          apiVersion,
        },
      },
      credential: {
        ...parsedService,
      },
    };
  }
};

export const askForUrl = async (
  value?: string
): Promise<string | undefined> => {
  logger.trace('Prompt for URL.');
  return showInputBox({
    title: `Enter the Endevor Web Services URL`,
    prompt: `Specify the details of your Endevor Web Services. Connection protocol and hostname are required.`,
    placeHolder: serviceUrlPlaceholder,
    value,
    validateInput: (value) => {
      const parsedService = parseServiceUrl(value);
      if (isError(parsedService)) {
        const error = parsedService;
        return error.message;
      }
      return;
    },
  });
};

export const askForRejectUnauthorizedConnections =
  async (): Promise<boolean> => {
    logger.trace('Prompt for reject unauthorized option.');
    const yesOption = 'Yes';
    const noOption = 'No';
    const dialogResult = await toPromiseWithTimeout(NOTIFICATION_TIMEOUT)(
      showMessageWithOptions({
        message:
          'Would you want to disable server certificate verification and try again?',
        options: [yesOption, noOption],
      })
    );
    if (isTimeoutError(dialogResult)) {
      logger.trace(
        'Nothing was selected, continue with rejecting unauthorized connections.'
      );
      return true;
    }
    if (dialogResult === yesOption) {
      logger.trace('Accept unauthorized connections was selected.');
      return false;
    }
    if (dialogResult === noOption) {
      logger.trace('Reject unauthorized connections was selected.');
      return true;
    }
    logger.trace(
      'Dialog was closed, continue with rejecting unauthorized connections.'
    );
    return true;
  };

export const askForTryAgainOrContinue = async (): Promise<boolean> => {
  logger.trace('Prompt user to try again or continue.');
  const tryAgainOption = 'Try again';
  const continueOption = 'Continue';
  const dialogResult = await toPromiseWithTimeout(NOTIFICATION_TIMEOUT)(
    showMessageWithOptions({
      message:
        'Would you want to specify another Endevor Web Services URL and try again or to continue with the provided value?',
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
    logger.trace('Continue the Endevor connection creation was selected.');
    return false;
  }
  logger.trace('Dialog was closed, try again.');
  return true;
};

type PasswordLengthPolicy = Readonly<{
  maxLength: number;
  minLength: number;
}>;

const askForCredentialValue =
  (passwordLengthPolicy: PasswordLengthPolicy) =>
  async (
    prefilledValue?: {
      user?: string;
      password?: string;
    },
    prompt?: string
  ): Promise<BaseCredential | OperationCancelled | EmptyValue> => {
    const user = await askForUsername({
      allowEmpty: true,
      prefilledValue: prefilledValue?.user,
    });
    if (emptyValueProvided(user)) {
      logger.trace('No username was provided.');
      return null;
    }
    if (operationCancelled(user)) {
      logger.trace('Username prompt was cancelled.');
      return undefined;
    }
    const password = await askForPassword({
      allowEmpty: false,
      passwordLengthPolicy,
      prefilledValue: prefilledValue?.password,
      prompt,
    });
    if (operationCancelled(password) || emptyValueProvided(password)) {
      logger.trace('No password was provided.');
      return undefined;
    }
    return {
      type: CredentialType.BASE,
      user,
      password,
    };
  };

export const askForServiceDeletion = async (
  serviceName: string
): Promise<boolean> => {
  logger.trace(`Prompt for Endevor connection '${serviceName}' deletion.`);
  const dialogResult = await showModalWithOptions({
    message: `Do you want to delete the '${serviceName}' Endevor connection?`,
    detail: 'Warning: this action cannot be undone.',
    options: ['Delete'],
  });
  if (operationCancelled(dialogResult)) {
    logger.trace(
      `Deletion of the '${serviceName}' Endevor connection was cancelled.`
    );
    return false;
  }
  return true;
};
