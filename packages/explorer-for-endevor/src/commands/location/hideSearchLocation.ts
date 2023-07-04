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

import { logger, reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import { LocationNode } from '../../tree/_doc/ServiceLocationTree';
import { TelemetryEvents } from '../../_doc/telemetry/Telemetry';

export const hideSearchLocation =
  (dispatch: (action: Action) => Promise<void>) =>
  async ({
    name,
    source,
    serviceName,
    serviceSource,
  }: LocationNode): Promise<void> => {
    logger.trace(
      `Hide the ${source} Endevor inventory location ${name} for the ${serviceSource} Endevor service ${serviceName} called.`
    );
    dispatch({
      type: Actions.ENDEVOR_SEARCH_LOCATION_HIDDEN,
      serviceId: {
        name: serviceName,
        source: serviceSource,
      },
      searchLocationId: {
        name,
        source,
      },
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SEARCH_LOCATION_HIDDEN,
      source,
    });
  };
