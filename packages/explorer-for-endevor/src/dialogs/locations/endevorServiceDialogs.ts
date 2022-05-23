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

import { QuickPickItem, QuickPickOptions } from 'vscode';
import {
  showInputBox,
  showMessageWithOptions,
  showVscodeQuickPick,
} from '@local/vscode-wrapper/window';
import { logger, reporter } from '../../globals';
import {
  Service,
  ServiceApiVersion,
  ServiceBasePath,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { isSelfSignedCertificateError, toUrlParms } from '@local/endevor/utils';
import { isError, isTimeoutError, toPromiseWithTimeout } from '../../utils';
import { NOTIFICATION_TIMEOUT } from '../../constants';
import { SelfSignedCertificateError } from '@local/endevor/_doc/Error';
import {
  DialogServiceInfoCollectionCompletedStatus,
  ServiceConnectionTestCompletedStatus,
  TelemetryEvents,
} from '../../_doc/Telemetry';

type ChosenServiceName = string;
type CreatedService = {
  name: string;
  value: Service;
};
type OperationCancelled = undefined;
type DialogResult = ChosenServiceName | CreatedService | OperationCancelled;

const serviceUrlPlaceholder =
  'http(s)://hostname:port[/EndevorService/(api/v2,api/v1,rest)]';

export const dialogCancelled = (
  value: DialogResult
): value is OperationCancelled => {
  return value === undefined;
};

export const serviceChosen = (
  value: DialogResult
): value is ChosenServiceName => {
  return typeof value === 'string';
};

export const askForServiceOrCreateNew =
  (dialogRestrictions: {
    hiddenServices: ReadonlyArray<string>;
    allServices: ReadonlyArray<string>;
  }) =>
  async (
    testServiceLocation: (
      location: ServiceLocation,
      rejectUnauthorized: boolean
    ) => Promise<ServiceApiVersion | SelfSignedCertificateError | Error>
  ): Promise<DialogResult> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
    });
    const createNewServiceItem: QuickPickItem = {
      label: '+ Create a New Endevor Profile',
    };
    const choice = await showServicesInQuickPick([
      createNewServiceItem,
      ...dialogRestrictions.hiddenServices.map(toQuickPickItem),
    ]);
    if (operationCancelled(choice) || valueNotProvided(choice)) {
      logger.trace('Operation cancelled.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_COMPLETED,
        status: DialogServiceInfoCollectionCompletedStatus.CANCELLED,
      });
      return undefined;
    }
    if (choice.label === createNewServiceItem.label) {
      const serviceName = await askForServiceName(
        dialogRestrictions.allServices
      );
      if (operationCancelled(serviceName) || valueNotProvided(serviceName)) {
        logger.trace('No profile name was provided.');
        logger.trace('Operation cancelled.');
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_COMPLETED,
          status: DialogServiceInfoCollectionCompletedStatus.CANCELLED,
        });
        return undefined;
      }
      const serviceValue = await askForServiceValue(testServiceLocation);
      if (operationCancelled(serviceValue) || valueNotProvided(serviceValue)) {
        logger.trace('No profile value was provided.');
        logger.trace('Operation cancelled.');
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_COMPLETED,
          status: DialogServiceInfoCollectionCompletedStatus.CANCELLED,
        });
        return undefined;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_COMPLETED,
        status:
          DialogServiceInfoCollectionCompletedStatus.NEW_SERVICE_INFO_COLLECTED,
      });
      return {
        name: serviceName,
        value: serviceValue,
      };
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_COMPLETED,
      status:
        DialogServiceInfoCollectionCompletedStatus.EXISTING_SERVICE_NAME_CHOSEN,
    });
    return choice.label;
  };

const toQuickPickItem = (input: string): QuickPickItem => {
  return {
    label: input,
  };
};

const showServicesInQuickPick = async (
  services: QuickPickItem[]
): Promise<QuickPickItem | undefined> => {
  const quickPickOptions: QuickPickOptions = {
    placeHolder:
      'Choose "Create new..." to define a new profile or select an existing one',
    ignoreFocusOut: true,
  };
  return showVscodeQuickPick(services, quickPickOptions);
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

const toServiceLocation = (urlString: string): ServiceLocation | Error => {
  const { protocol, hostname, port, pathname } = toUrlParms(urlString);
  if (!protocol && !hostname) {
    return new Error(
      `Enter an Endevor URL in the format: ${serviceUrlPlaceholder}`
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
    protocol,
    hostname,
    port,
    basePath: pathname ? pathname : ServiceBasePath.V2,
  };
};

const askForServiceName = async (
  existingServices: ReadonlyArray<string>
): Promise<string | undefined> => {
  logger.trace('Prompt for profile name.');
  return showInputBox({
    prompt: 'Profile Name',
    placeHolder: 'Profile Name',
    validateInput: (inputValue) =>
      inputValue.length
        ? inputValue.includes(' ')
          ? 'Profile name must not contain spaces'
          : existingServices.some((serviceName) => serviceName === inputValue)
          ? 'A profile with this name already exists. Please enter a different name.'
          : undefined
        : 'Profile name must not be empty',
  });
};

export const askForServiceValue = async (
  testServiceLocation: (
    location: ServiceLocation,
    rejectUnauthorized: boolean
  ) => Promise<ServiceApiVersion | SelfSignedCertificateError | Error>
): Promise<Service | undefined> => {
  const serviceLocationResult = await askForServiceLocation(
    testServiceLocation
  );
  if (!serviceLocationResult) return;
  const user = await askForUsername();
  if (operationCancelled(user)) {
    logger.trace('No username was provided.');
    return;
  }
  const password = await askForPassword();
  if (operationCancelled(password)) {
    logger.trace('No password was provided.');
    return;
  }
  return {
    credential: {
      type: CredentialType.BASE,
      user,
      password,
    },
    location: serviceLocationResult.location,
    apiVersion: serviceLocationResult.apiVersion,
    rejectUnauthorized: serviceLocationResult.rejectUnauthorized,
  };
};

export type ServiceLocationResult = {
  location: ServiceLocation;
  apiVersion: ServiceApiVersion;
  rejectUnauthorized: boolean;
};
export const askForServiceLocation = async (
  testServiceLocation: (
    location: ServiceLocation,
    rejectUnauthorized: boolean
  ) => Promise<ServiceApiVersion | SelfSignedCertificateError | Error>
): Promise<ServiceLocationResult | undefined> => {
  let urlString;
  let rejectUnauthorized = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    urlString = await askForUrl(urlString);
    if (operationCancelled(urlString) || valueNotProvided(urlString)) {
      logger.trace('No URL was provided.');
      return;
    }
    const location = toServiceLocation(urlString);
    if (isError(location)) {
      const error = location;
      logger.error(error.message);
      return;
    }
    const apiVersion = await testServiceLocation(location, rejectUnauthorized);
    if (isSelfSignedCertificateError(apiVersion)) {
      const error = apiVersion;
      logger.error(
        'Unable to validate Endevor server certificate',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status:
          ServiceConnectionTestCompletedStatus.CERT_ISSUER_VALIDATION_ERROR,
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
        type: TelemetryEvents.SERVICE_CONNECTION_TEST_COMPLETED,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestCompletedStatus.CONTINUE_WITH_ERROR,
        apiVersion: ServiceApiVersion.UNKNOWN,
      });
      return {
        location,
        apiVersion: ServiceApiVersion.UNKNOWN,
        rejectUnauthorized,
      };
    }
    if (isError(apiVersion)) {
      const error = apiVersion;
      logger.error('Unable to connect to Endevor server', `${error.message}.`);
      const tryAgain = await askForTryAgainOrContinue();
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestCompletedStatus.GENERIC_ERROR,
        error,
      });
      if (tryAgain) continue;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_CONNECTION_TEST_COMPLETED,
        context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
        status: ServiceConnectionTestCompletedStatus.CONTINUE_WITH_ERROR,
        apiVersion: ServiceApiVersion.UNKNOWN,
      });
      return {
        location,
        apiVersion: ServiceApiVersion.UNKNOWN,
        rejectUnauthorized,
      };
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_CONNECTION_TEST_COMPLETED,
      context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED,
      status: ServiceConnectionTestCompletedStatus.SUCCESS,
      apiVersion,
    });
    return {
      location,
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
    prompt: `Enter an Endevor URL in the format: ${serviceUrlPlaceholder}`,
    placeHolder: serviceUrlPlaceholder,
    value,
    validateInput: (value) => {
      const serviceLocation = toServiceLocation(value);
      if (isError(serviceLocation)) {
        const error = serviceLocation;
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
        'Would you want to specify another Endevor URL and try again or to continue adding the profile with the current value?',
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
    logger.trace('Continue the profile creation was selected.');
    return false;
  }
  logger.trace('Dialog was closed, try again.');
  return true;
};

export const askForUsername = async (): Promise<string | undefined> => {
  logger.trace('Prompt for username.');
  return showInputBox({
    prompt: 'Enter the username for the connection.',
    placeHolder: '(Optional) Username',
  });
};

export const askForPassword = async (): Promise<string | undefined> => {
  logger.trace('Prompt for password.');
  return showInputBox({
    prompt: 'Enter the password for the connection.',
    password: true,
    placeHolder: '(Optional) Password',
  });
};
