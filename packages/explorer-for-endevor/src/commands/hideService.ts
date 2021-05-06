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

import { logger } from '../globals';
import { removeService } from '../settings/settings';
import { ServiceNode } from '../_doc/ElementTree';

export const hideService = async ({ name }: ServiceNode): Promise<void> => {
  logger.trace(`Remove Profile called for: ${name}`);
  try {
    await removeService(name);
    logger.trace(`Service profile: ${name} was removed from settings`);
  } catch (error) {
    logger.error(
      `Profile with name: ${name} was not removed from settings`,
      `Service profile: ${name} was not removed from settings because of: ${error}`
    );
  }
};
