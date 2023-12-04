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
import { NOTIFICATION_TIMEOUT } from '../../constants';
import { logger } from '../../globals';
import { isTimeoutError, toPromiseWithTimeout } from '../utils';

type ChosenSignOutOption = Readonly<{
  signOutElements: boolean;
  automaticSignOut: boolean;
}>;

export const askToSignOutElements = async (
  elementNames: ReadonlyArray<string>
): Promise<ChosenSignOutOption> => {
  // TODO: Try adding more details for these elements.
  logger.trace(
    `Prompt user to signout the following elements: ${JSON.stringify(
      elementNames
    )}.`
  );
  const signOutElementsOption = `Signout`;
  const automaticSignOutOption = 'Turn on Automatic Signout';
  const cancelOption = 'Cancel';
  const dialogResult = await toPromiseWithTimeout(NOTIFICATION_TIMEOUT)(
    showMessageWithOptions({
      message: `Would you like to signout the following elements: ${elementNames.join(
        ', '
      )}?`,
      options: [signOutElementsOption, automaticSignOutOption, cancelOption],
    })
  );
  if (isTimeoutError(dialogResult)) {
    // TODO: Try adding more details for these elements.
    logger.trace(
      `Nothing was selected from the notification options for signout of elements: ${JSON.stringify(
        elementNames
      )}.`
    );
    return {
      automaticSignOut: false,
      signOutElements: false,
    };
  }
  if (dialogResult === signOutElementsOption) {
    return {
      automaticSignOut: false,
      signOutElements: true,
    };
  }
  if (dialogResult === automaticSignOutOption) {
    return {
      automaticSignOut: true,
      signOutElements: true,
    };
  }
  return {
    automaticSignOut: false,
    signOutElements: false,
  };
};

export const askToOverrideSignOutForElements = async (
  elementNames: ReadonlyArray<string>
): Promise<boolean> => {
  // TODO: Try adding more details for these elements.
  logger.trace(
    `Prompt user to override the signout for the following elements: ${JSON.stringify(
      elementNames
    )}.`
  );
  const overrideOption = 'Override Signout';
  const cancelOption = 'Cancel';
  const dialogResult = await toPromiseWithTimeout(NOTIFICATION_TIMEOUT)(
    showMessageWithOptions({
      message: `Would you like to override the signout for the following elements: ${elementNames.join(
        ', '
      )}?`,
      options: [overrideOption, cancelOption],
    })
  );
  if (isTimeoutError(dialogResult)) {
    // TODO: Try adding more details for these elements.
    logger.trace(
      `Nothing was selected from the notification options for signout override of elements: ${JSON.stringify(
        elementNames
      )}.`
    );
    return false;
  }
  if (dialogResult === overrideOption) {
    return true;
  }
  return false;
};
