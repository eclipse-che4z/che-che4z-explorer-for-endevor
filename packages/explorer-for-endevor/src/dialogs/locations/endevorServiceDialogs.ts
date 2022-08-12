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

import { QuickPick, QuickPickItem, QuickPickOptions } from 'vscode';
import {
  showInputBox,
  showMessageWithOptions,
  createVscodeQuickPick,
  showModalWithOptions,
} from '@local/vscode-wrapper/window';
import { logger, reporter } from '../../globals';
import {
  Service,
  ServiceApiVersion,
  ServiceBasePath,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import { isSelfSignedCertificateError, toUrlParms } from '@local/endevor/utils';
import {
  isDefined,
  isEmpty,
  isError,
  isTimeoutError,
  toPromiseWithTimeout,
} from '../../utils';
import {
  NOTIFICATION_TIMEOUT,
  ZOWE_PROFILE_DESCRIPTION,
} from '../../constants';
import { SelfSignedCertificateError } from '@local/endevor/_doc/Error';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import {
  EndevorId,
  ValidEndevorServiceDescription,
  ValidEndevorServiceDescriptions,
} from '../../store/_doc/v2/Store';
import { Source } from '../../store/storage/_doc/Storage';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
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
  value: {
    location: Service['location'];
    rejectUnauthorized: Service['rejectUnauthorized'];
    apiVersion: Service['apiVersion'];
  } & Partial<{
    credential: Credential;
  }>;
};
type ChosenService = {
  type: DialogResultTypes.CHOSEN;
  id: EndevorId;
};
type OperationCancelled = undefined;
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
    servicesToChoose: ValidEndevorServiceDescriptions;
    allExistingServices: ReadonlyArray<string>;
  }) =>
  async (
    testServiceLocation: (
      location: ServiceLocation,
      rejectUnauthorized: boolean
    ) => Promise<
      | ServiceApiVersion
      | SelfSignedCertificateError
      | Error
      | OperationCancelled
    >
  ): Promise<DialogResult> => {
    const createNewServiceItem: QuickPickItem = {
      label: '+ Create a new Endevor connection',
      alwaysShow: true,
    };
    const choice = await showServicesInQuickPick([
      createNewServiceItem,
      ...Object.values(dialogRestrictions.servicesToChoose).map(
        toServiceQuickPickItem
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

const toServiceQuickPickItem = ({
  id,
  url,
  duplicated,
}: ValidEndevorServiceDescription): QuickPickItem => {
  const serviceQuickPickItem: ServiceQuickPickItem = {
    label: id.name,
    detail: url,
    id,
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
    placeHolder:
      'Choose "Create new..." to define a new Endevor connection or select an existing one',
    ignoreFocusOut: true,
  };
  return createVscodeQuickPick(
    services,
    quickPickOptions.placeHolder,
    quickPickOptions.ignoreFocusOut
  );
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
    return new Error(
      `Enter an Endevor Web Services URL in the format: ${serviceUrlPlaceholder}`
    );
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
    prompt: 'Endevor connection Name',
    placeHolder: 'Endevor connection Name',
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
  ) => Promise<
    ServiceApiVersion | SelfSignedCertificateError | Error | OperationCancelled
  >
): Promise<CreatedService['value'] | undefined> => {
  const serviceDetailsResult = await askForServiceDetails(testServiceLocation);
  if (!serviceDetailsResult) return;
  if (!serviceDetailsResult.username || !serviceDetailsResult.password) {
    serviceDetailsResult.username = await askForUsername(
      serviceDetailsResult.username
    );
    if (
      operationCancelled(serviceDetailsResult.username) ||
      isEmpty(serviceDetailsResult.username)
    ) {
      logger.trace('No username was provided.');
      return {
        location: serviceDetailsResult.location,
        apiVersion: serviceDetailsResult.apiVersion,
        rejectUnauthorized: serviceDetailsResult.rejectUnauthorized,
      };
    }
    serviceDetailsResult.password = await askForPassword(
      serviceDetailsResult.password
    );
    if (
      operationCancelled(serviceDetailsResult.password) ||
      isEmpty(serviceDetailsResult.password)
    ) {
      logger.trace('No password was provided.');
      return {
        location: serviceDetailsResult.location,
        apiVersion: serviceDetailsResult.apiVersion,
        rejectUnauthorized: serviceDetailsResult.rejectUnauthorized,
      };
    }
  }
  return {
    credential: {
      type: CredentialType.BASE,
      user: serviceDetailsResult.username,
      password: serviceDetailsResult.password,
    },
    location: serviceDetailsResult.location,
    apiVersion: serviceDetailsResult.apiVersion,
    rejectUnauthorized: serviceDetailsResult.rejectUnauthorized,
  };
};

export type ServiceDetailsResult = {
  location: ServiceLocation;
  rejectUnauthorized: boolean;
} & Partial<{
  apiVersion: ServiceApiVersion;
  username: string;
  password: string;
}>;

export const askForServiceDetails = async (
  testServiceLocation: (
    location: ServiceLocation,
    rejectUnauthorized: boolean
  ) => Promise<
    ServiceApiVersion | SelfSignedCertificateError | Error | OperationCancelled
  >
): Promise<ServiceDetailsResult | undefined> => {
  let urlString;
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
    const apiVersion = await testServiceLocation(
      parsedService.location,
      rejectUnauthorized
    );
    if (isSelfSignedCertificateError(apiVersion)) {
      const error = apiVersion;
      logger.error(
        'Unable to validate Endevor server certificate',
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
      const tryAgain = await askForTryAgainOrContinue();
      if (tryAgain) continue;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CONTINUE_WITH_ERROR,
      });
      return {
        ...parsedService,
        rejectUnauthorized,
      };
    }
    if (operationCancelled(apiVersion)) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CANCELLED,
      });
      const tryAgain = await askForTryAgainOrContinue();
      if (tryAgain) continue;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CONTINUE_WITH_CANCEL,
      });
      return {
        ...parsedService,
        rejectUnauthorized,
      };
    }
    if (isError(apiVersion)) {
      const error = apiVersion;
      logger.error(
        'Unable to connect to Endevor Web Services.',
        `${error.message}.`
      );
      const tryAgain = await askForTryAgainOrContinue();
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.GENERIC_ERROR,
        error,
      });
      if (tryAgain) continue;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestStatus.CONTINUE_WITH_ERROR,
      });
      return {
        ...parsedService,
        rejectUnauthorized,
      };
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_CONNECTION_TEST,
      context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
      status: ServiceConnectionTestStatus.SUCCESS,
      apiVersion,
    });
    return {
      ...parsedService,
      apiVersion,
      rejectUnauthorized,
    };
  }
};

export const askForUrl = async (
  value?: string
): Promise<string | undefined> => {
  logger.trace('Prompt for URL.');
  return showInputBox({
    prompt: `Enter an Endevor Web Services URL in the format: ${serviceUrlPlaceholder}`,
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
        'Would you want to specify another Endevor Web Services URL and try again or to continue adding the connection with the current value?',
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

export const askForUsername = async (
  value?: string
): Promise<string | undefined> => {
  logger.trace('Prompt for username.');
  return showInputBox({
    prompt: 'Enter the username for the connection.',
    placeHolder: '(Optional) Username',
    value,
  });
};

export const askForPassword = async (
  value?: string
): Promise<string | undefined> => {
  logger.trace('Prompt for password.');
  return showInputBox({
    prompt: 'Enter the password for the connection.',
    password: true,
    placeHolder: '(Optional) Password',
    value,
  });
};

export const askForServiceDeletion = async (
  serviceName: string
): Promise<boolean> => {
  logger.trace(`Prompt for Endevor connection '${serviceName}' deletion.`);
  const dialogResult = await showModalWithOptions({
    message: `Are you sure you want to delete Endevor connection '${serviceName}'? Warning: this action cannot be undone.`,
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
