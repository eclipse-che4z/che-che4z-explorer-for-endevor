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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { logger } from '../../../globals';
import { Action, Actions } from '../../../store/_doc/Actions';
import { ElementFilterType } from '../../../store/_doc/v2/Store';
import { FilterNode, FilterNodeType } from '../../../tree/_doc/FilterTree';

export const clearSearchLocationFilterTypeCommand =
  (dispatch: (action: Action) => Promise<void>) =>
  async (node: FilterNode): Promise<void> => {
    const serviceName = node.serviceName;
    const serviceSource = node.serviceSource;
    const locationName = node.searchLocationName;
    const locationSource = node.searchLocationSource;
    logger.trace(
      `Clear filter ${node.filterType} for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    let filtersCleared: ElementFilterType[];
    switch (node.filterType) {
      case FilterNodeType.CCIDS_FILTER:
        filtersCleared = [ElementFilterType.ELEMENT_CCIDS_FILTER];
        break;
      case FilterNodeType.NAMES_FILTER:
        filtersCleared = [ElementFilterType.ELEMENT_NAMES_FILTER];
        break;
      case FilterNodeType.TYPES_FILTER:
        filtersCleared = [ElementFilterType.ELEMENT_TYPES_FILTER];
        break;
      default:
        throw new UnreachableCaseError(node.filterType);
    }
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
      filtersCleared,
    });
  };
