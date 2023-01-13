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

import { reporter } from '../globals';
import { Action, Actions } from '../store/_doc/Actions';
import { ElementFilterType } from '../store/_doc/v2/Store';
import { LocationNode } from '../tree/_doc/ServiceLocationTree';
import { TelemetryEvents } from '../_doc/telemetry/v2/Telemetry';

export const toggleMapView =
  (dispatch: (action: Action) => Promise<void>) =>
  (showMap: boolean) =>
  async (locationNode: LocationNode): Promise<void> => {
    dispatch({
      type: Actions.ELEMENT_UP_THE_MAP_FILTER_UPDATED,
      serviceId: {
        name: locationNode.serviceName,
        source: locationNode.serviceSource,
      },
      searchLocationId: {
        name: locationNode.name,
        source: locationNode.source,
      },
      updatedFilter: {
        type: ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER,
        value: showMap,
      },
    });

    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_TOGGLE_MAP,
      source: locationNode.source,
      showMap,
    });
  };
