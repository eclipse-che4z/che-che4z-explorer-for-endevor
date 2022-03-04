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

import { logger, reporter } from '../globals';
import { removeService } from '../settings/settings';
import { ServiceNode } from '../_doc/ElementTree';
import { TelemetryEvents } from '../_doc/Telemetry';

export const hideService = async ({ name }: ServiceNode): Promise<void> => {
  logger.trace(`Remove Profile called for profile ${name}.`);
  try {
    await removeService(name);
    logger.trace(`Service profile ${name} was removed from settings.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_HIDED,
    });
  } catch (error) {
    logger.error(
      `Profile with the name ${name} was not removed from settings.`,
      `Service profile ${name} was not removed from settings because of error ${error}`
    );
  }
};
