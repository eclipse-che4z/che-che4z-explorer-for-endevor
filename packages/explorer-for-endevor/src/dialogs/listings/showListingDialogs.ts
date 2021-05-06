/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { logger } from '../../globals';

export const askToShowListing = async (): Promise<boolean> => {
  logger.trace('Prompt user to show element listing.');
  const showListingOption = 'Show listing';
  const cancelOption = 'Cancel';
  const dialogResult = await showMessageWithOptions({
    message: `Would you like to see the listing?`,
    options: [showListingOption, cancelOption],
  });
  const notificationWasClosed = dialogResult === undefined;
  if (notificationWasClosed || dialogResult === cancelOption) {
    return false;
  }
  if (dialogResult === showListingOption) {
    return true;
  }
  return false;
};
