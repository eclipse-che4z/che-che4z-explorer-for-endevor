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

import { BaseCredential, CredentialType } from '@local/endevor/_doc/Credential';
import { PasswordLengthPolicy } from '../../_doc/Credential';
import { showInputBox } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';

type CredentialValue = BaseCredential;
type OperationCancelled = undefined;
type DialogResult = CredentialValue | OperationCancelled;

export const dialogCancelled = (
  dialogResult: DialogResult
): dialogResult is OperationCancelled => {
  return dialogResult === undefined;
};

export const askForCredential =
  (passwordLengthPolicy: PasswordLengthPolicy) =>
  async (): Promise<DialogResult> => {
    const user = await askForUsername();
    if (operationIsCancelled(user)) {
      logger.trace('No username was provided.');
      logger.trace('Operation cancelled.');
      return undefined;
    }
    const password = await askForPassword(passwordLengthPolicy);
    if (operationIsCancelled(password)) {
      logger.trace('No password was provided.');
      logger.trace('Operation cancelled.');
      return undefined;
    }
    return {
      type: CredentialType.BASE,
      user,
      password,
    };
  };

export const askForCredentialWithDefaultPasswordPolicy = askForCredential({
  minLength: 6,
  maxLength: 8,
});

const askForUsername = async (): Promise<string | OperationCancelled> => {
  logger.trace('Prompt for username.');
  return await showInputBox({
    prompt: 'Enter the username for the connection.',
    placeHolder: 'Username',
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'Username must not be empty.';
      const maxInputLength = 8;
      const tooLongValueMessage = `Username must be up to ${maxInputLength} symbols.`;
      const actualInputLength = input.length;
      const space = ' ';
      const incorrectValueMessage = 'Username must not contains spaces.';

      return actualInputLength
        ? !input.includes(space)
          ? actualInputLength <= maxInputLength
            ? validInput
            : tooLongValueMessage
          : incorrectValueMessage
        : emptyInputMessage;
    },
  });
};

const askForPassword = async ({
  minLength,
  maxLength,
}: PasswordLengthPolicy): Promise<string | OperationCancelled> => {
  logger.trace('Prompt for password.');
  return showInputBox({
    prompt: 'Enter the password for the connection.',
    password: true,
    placeHolder: 'Password',
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'Password must not be empty.';
      const lengthPolicyViolationMessage = `Password must be in range from ${minLength} to ${maxLength} symbols.`;
      const actualInputLength = input.length;
      const space = ' ';
      const incorrectValueMessage = 'Password must not contains spaces.';

      return actualInputLength
        ? !input.includes(space)
          ? actualInputLength >= minLength && actualInputLength <= maxLength
            ? validInput
            : lengthPolicyViolationMessage
          : incorrectValueMessage
        : emptyInputMessage;
    },
  });
};

const operationIsCancelled = <T>(
  value: T | undefined
): value is OperationCancelled => {
  return value === undefined;
};
