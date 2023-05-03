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

import { showMessageWithOptions } from '@local/vscode-wrapper/window';
import { MessageLevel } from '@local/vscode-wrapper/_doc/window';
import { logger } from '../../globals';
import { isTimeoutError } from '../utils';

export const enum dialogOptions {
  SHOW_EXECUTION_REPORT = 'Show Execution Report',
  PRINT_LISTING = 'Print Listing',
  CANCEL = 'Cancel',
}

export type ChosenPrintOption = Readonly<{
  printExecutionReport: boolean;
  printListing: boolean;
}>;

export const askForListingOrExecutionReport = async (
  message: string,
  level: MessageLevel = MessageLevel.INFO
): Promise<ChosenPrintOption> => {
  logger.trace('Prompt user for showing element listing or execution report.');
  const dialogResult = await showMessageWithOptions(
    {
      message,
      options: [
        dialogOptions.PRINT_LISTING,
        dialogOptions.SHOW_EXECUTION_REPORT,
        dialogOptions.CANCEL,
      ],
    },
    level
  );
  if (isTimeoutError(dialogResult)) {
    return {
      printExecutionReport: false,
      printListing: false,
    };
  }
  if (dialogResult === dialogOptions.SHOW_EXECUTION_REPORT) {
    return {
      printExecutionReport: true,
      printListing: false,
    };
  }
  if (dialogResult === dialogOptions.PRINT_LISTING) {
    return {
      printExecutionReport: false,
      printListing: true,
    };
  }
  return {
    printExecutionReport: false,
    printListing: false,
  };
};

export const askForListing = async (
  message: string,
  level: MessageLevel = MessageLevel.INFO
): Promise<ChosenPrintOption> => {
  logger.trace('Prompt user for showing element listing.');
  const dialogResult = await showMessageWithOptions(
    {
      message,
      options: [dialogOptions.PRINT_LISTING, dialogOptions.CANCEL],
    },
    level
  );
  if (isTimeoutError(dialogResult)) {
    return {
      printExecutionReport: false,
      printListing: false,
    };
  }
  if (dialogResult === dialogOptions.PRINT_LISTING) {
    return {
      printExecutionReport: false,
      printListing: true,
    };
  }
  return {
    printExecutionReport: false,
    printListing: false,
  };
};

export const askForExecutionReport = async (
  message: string,
  level: MessageLevel = MessageLevel.INFO
): Promise<ChosenPrintOption> => {
  logger.trace('Prompt user for showing execution report.');
  const dialogResult = await showMessageWithOptions(
    {
      message,
      options: [dialogOptions.SHOW_EXECUTION_REPORT, dialogOptions.CANCEL],
    },
    level
  );
  if (isTimeoutError(dialogResult)) {
    return {
      printExecutionReport: false,
      printListing: false,
    };
  }
  if (dialogResult === dialogOptions.SHOW_EXECUTION_REPORT) {
    return {
      printExecutionReport: true,
      printListing: false,
    };
  }
  return {
    printExecutionReport: false,
    printListing: false,
  };
};
