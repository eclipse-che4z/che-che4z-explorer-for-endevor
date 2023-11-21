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

import { reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import { ElementToggleFilters } from '../../store/_doc/v2/Store';
import { LocationNode } from '../../tree/_doc/ServiceLocationTree';
import { TelemetryEvents } from '../../telemetry/_doc/Telemetry';

export const toggleFilterValue =
  (dispatch: (action: Action) => Promise<void>) =>
  (filter: ElementToggleFilters) =>
  async (locationNode: LocationNode): Promise<void> => {
    dispatch({
      type: Actions.ELEMENT_TOGGLE_FILTER_UPDATED,
      serviceId: {
        name: locationNode.serviceName,
        source: locationNode.serviceSource,
      },
      searchLocationId: {
        name: locationNode.name,
        source: locationNode.source,
      },
      updatedFilter: filter,
    });

    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_TOGGLE_FILTER,
      source: locationNode.source,
      filter,
    });
  };
