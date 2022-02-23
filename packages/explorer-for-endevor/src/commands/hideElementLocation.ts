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
import { removeElementLocation } from '../settings/settings';
import { LocationNode } from '../_doc/ElementTree';
import { TelemetryEvents } from '../_doc/Telemetry';

export const hideElementLocation = async ({
  name,
  serviceName,
}: LocationNode): Promise<void> => {
  logger.trace(
    `Remove Location Profile called for location ${name} and service ${serviceName}.`
  );
  try {
    await removeElementLocation(name, serviceName);
    logger.trace(`Location profile ${name} was removed from settings.`);
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SEARCH_LOCATION_HIDED,
    });
  } catch (error) {
    logger.error(
      `Location profile with the name ${name} was not removed from settings.`,
      `Location profile ${name} was not removed from settings because of error ${error}`
    );
  }
};
