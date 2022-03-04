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

import { ChangeControlValue } from '@local/endevor/_doc/Endevor';
import { showInputBox } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';

type OperationCancelled = undefined;
export type DialogResult = ChangeControlValue | OperationCancelled;

export const dialogCancelled = (
  dialogResult: DialogResult
): dialogResult is OperationCancelled => {
  return dialogResult === undefined;
};

export const askForChangeControlValue = async (defaultValue: {
  ccid?: string;
  comment?: string;
}): Promise<DialogResult> => {
  logger.trace('Prompt for Change Control value.');
  const ccid = await askForCCID(defaultValue.ccid);
  if (operationIsCancelled(ccid)) {
    logger.trace('No CCID was provided.');
    logger.trace('Operation cancelled.');
    return undefined;
  }
  const comment = await askForComment(defaultValue.comment);
  if (operationIsCancelled(comment)) {
    logger.trace('No comment was provided.');
    logger.trace('Operation cancelled.');
    return undefined;
  }
  return {
    ccid,
    comment,
  };
};

const askForCCID = async (
  defaultCcid?: string
): Promise<string | OperationCancelled> => {
  logger.trace('Prompt for CCID.');
  return await showInputBox({
    prompt: 'Enter a CCID for the action.',
    value: defaultCcid,
    placeHolder: 'CCID',
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'CCID must not be empty.';
      const maxInputLength = 12;
      const tooLongValueMessage = `CCID must be up to ${maxInputLength} symbols.`;
      const actualInputLength = input.length;
      const space = ' ';
      const incorrectValueMessage = 'CCID must not contains spaces.';

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

const askForComment = async (
  defaultComment?: string
): Promise<string | OperationCancelled> => {
  logger.trace('Prompt for comment.');
  return await showInputBox({
    prompt: 'Enter a comment for the action.',
    placeHolder: 'Comment',
    value: defaultComment,
    validateInput: (input) => {
      const validInput = undefined;
      const emptyInputMessage = 'Comment must not be empty.';
      const maxInputLength = 40;
      const tooLongValueMessage = `Comment must be up to ${maxInputLength} symbols.`;
      const actualInputLength = input.length;

      return actualInputLength
        ? actualInputLength <= maxInputLength
          ? validInput
          : tooLongValueMessage
        : emptyInputMessage;
    },
  });
};

const operationIsCancelled = <T>(
  value: T | undefined
): value is OperationCancelled => {
  return value === undefined;
};
