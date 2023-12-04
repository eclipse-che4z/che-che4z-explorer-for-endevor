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

import { showModalWithOptions } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';

const operationCancelled = <T>(value: T | undefined): value is undefined => {
  return value == undefined;
};

export const askForGenerateAllElements = async (
  subsystemName: string
): Promise<boolean> => {
  logger.trace(
    `Prompt for the generate all elements function in subsystem '${subsystemName}'.`
  );
  const dialogResult = await showModalWithOptions({
    message: `Are you sure you want to generate all the elements in subsystem '${subsystemName}' ?`,
    detail: 'Warning: this action may take some time to complete.',
    options: ['Generate'],
  });
  if (operationCancelled(dialogResult)) {
    logger.trace(
      `Generate all elements in subsystem '${subsystemName}' was cancelled.`
    );
    return false;
  }
  return true;
};
