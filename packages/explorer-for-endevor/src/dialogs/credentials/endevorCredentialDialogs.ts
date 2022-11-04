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

import { BaseCredential, CredentialType } from '@local/endevor/_doc/Credential';
import { PasswordLengthPolicy } from '../../_doc/Credential';
import { showInputBox } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';
import {
  EndevorCredential,
  EndevorCredentialStatus,
} from '../../store/_doc/v2/Store';

type CredentialValue = EndevorCredential;
type OperationCancelled = undefined;
type DialogResult = CredentialValue | OperationCancelled;

export const dialogCancelled = (
  dialogResult: DialogResult
): dialogResult is OperationCancelled => {
  return dialogResult === undefined;
};

export const askForCredential =
  (passwordLengthPolicy: PasswordLengthPolicy) =>
  (validationPolicy: {
    validateCredential: (value: BaseCredential) => Promise<boolean>;
    validationAttempts: number;
  }) =>
  async (prefilledValue?: {
    user?: string;
    password?: string;
  }): Promise<DialogResult> => {
    let lastCredential = prefilledValue;
    for (
      let attempt = validationPolicy.validationAttempts;
      attempt > 0;
      attempt--
    ) {
      const credential = await askForCredentialValue(passwordLengthPolicy)(
        lastCredential
      );
      if (!credential) {
        logger.trace('Operation cancelled.');
        return;
      }
      lastCredential = credential;
      const result = await validationPolicy.validateCredential(credential);
      if (result) {
        return {
          status: EndevorCredentialStatus.VALID,
          value: credential,
        };
      }
      logger.warn('Credential validation was not successful.');
      continue;
    }
    logger.error(
      `Valid credential has not been provided after ${validationPolicy.validationAttempts} attempts.`
    );
    if (lastCredential && lastCredential.user && lastCredential.password) {
      return {
        status: EndevorCredentialStatus.INVALID,
        value: {
          type: CredentialType.BASE,
          user: lastCredential.user,
          password: lastCredential.password,
        },
      };
    }
    return;
  };

const askForCredentialValue =
  (passwordLengthPolicy: PasswordLengthPolicy) =>
  async (prefilledValue?: {
    user?: string;
    password?: string;
  }): Promise<BaseCredential | OperationCancelled> => {
    const user = await askForUsername({
      prefilledValue: prefilledValue?.user,
      allowEmpty: false,
    });
    if (operationIsCancelled(user) || emptyValueProvided(user)) {
      logger.trace('No username was provided.');
      return undefined;
    }
    const password = await askForPassword({
      allowEmpty: false,
      passwordLengthPolicy,
      prefilledValue: prefilledValue?.password,
    });
    if (operationIsCancelled(password) || emptyValueProvided(password)) {
      logger.trace('No password was provided.');
      return undefined;
    }
    return {
      type: CredentialType.BASE,
      user,
      password,
    };
  };

export const defaultPasswordPolicy: PasswordLengthPolicy = {
  minLength: 6,
  maxLength: 100,
};
export const askForCredentialWithDefaultPasswordPolicy = askForCredential(
  defaultPasswordPolicy
);

export const askForCredentialWithoutValidation =
  askForCredentialWithDefaultPasswordPolicy({
    validateCredential: () => Promise.resolve(true),
    validationAttempts: 1,
  });

export type EmptyValue = null;
export const askForUsername = async (options: {
  allowEmpty: boolean;
  prefilledValue?: string;
}): Promise<string | EmptyValue | OperationCancelled> => {
  logger.trace('Prompt for username.');
  const result = await showInputBox({
    title: 'Enter a username for the connection',
    value: options.prefilledValue,
    placeHolder: options.allowEmpty ? '(Optional) Username' : 'Username',
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'Username must not be empty.';
      const maxInputLength = 8;
      const tooLongValueMessage = `Username must be up to ${maxInputLength} symbols.`;
      const actualInputLength = input.length;
      const space = ' ';
      const incorrectValueMessage = 'Username must not contains spaces.';
      if (!actualInputLength && options.allowEmpty) return validInput;
      return actualInputLength
        ? !input.includes(space)
          ? actualInputLength <= maxInputLength
            ? validInput
            : tooLongValueMessage
          : incorrectValueMessage
        : emptyInputMessage;
    },
  });
  if (operationIsCancelled(result)) return undefined;
  else if (!result.length) return null;
  return result;
};

export const askForPassword = async (options: {
  passwordLengthPolicy: PasswordLengthPolicy;
  allowEmpty: boolean;
  prefilledValue?: string;
}): Promise<string | EmptyValue | OperationCancelled> => {
  logger.trace('Prompt for password.');
  const result = await showInputBox({
    title: 'Enter a password for the connection',
    value: options.prefilledValue,
    password: true,
    placeHolder: options.allowEmpty ? '(Optional) Password' : 'Password',
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'Password must not be empty.';
      const lengthPolicyViolationMessage = `Password must be in range from ${options.passwordLengthPolicy.minLength} to ${options.passwordLengthPolicy.maxLength} symbols.`;
      const actualInputLength = input.length;
      const space = ' ';
      const incorrectValueMessage = 'Password must not contains spaces.';
      if (!actualInputLength && options.allowEmpty) return validInput;
      return actualInputLength
        ? !input.includes(space)
          ? actualInputLength >= options.passwordLengthPolicy.minLength &&
            actualInputLength <= options.passwordLengthPolicy.maxLength
            ? validInput
            : lengthPolicyViolationMessage
          : incorrectValueMessage
        : emptyInputMessage;
    },
  });
  if (operationIsCancelled(result)) return undefined;
  else if (!result.length) return null;
  return result;
};

const operationIsCancelled = <T>(
  value: T | undefined
): value is OperationCancelled => {
  return value === undefined;
};

export const emptyValueProvided = <T>(value: T | null): value is EmptyValue => {
  return value === null;
};
