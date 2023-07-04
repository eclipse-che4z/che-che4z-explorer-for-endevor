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

import { logger } from '../../../globals';
import { Action, Actions } from '../../../store/_doc/Actions';
import { ElementFilterType } from '../../../store/_doc/v2/Store';
import { FilteredNode } from '../../../tree/_doc/FilterTree';
import { LocationNode } from '../../../tree/_doc/ServiceLocationTree';

export const clearSearchLocationFiltersCommand =
  (dispatch: (action: Action) => Promise<void>) =>
  async (node: LocationNode | FilteredNode): Promise<void> => {
    const serviceName = node.serviceName;
    const serviceSource = node.serviceSource;
    const locationName =
      node.type === 'FILTERED' ? node.searchLocationName : node.name;
    const locationSource =
      node.type === 'FILTERED' ? node.searchLocationSource : node.source;
    logger.trace(
      `Clear filters for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    dispatch({
      type: Actions.ENDEVOR_SEARCH_LOCATION_FILTERS_CLEARED,
      serviceId: {
        name: serviceName,
        source: serviceSource,
      },
      searchLocationId: {
        name: locationName,
        source: locationSource,
      },
      filtersCleared: [
        ElementFilterType.ELEMENT_NAMES_FILTER,
        ElementFilterType.ELEMENT_TYPES_FILTER,
        ElementFilterType.ELEMENT_CCIDS_FILTER,
      ],
    });
  };
