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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { FILTER_WILDCARD_ZERO_OR_MORE } from '../../constants';
import { logger, reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  CachedElement,
  ElementCcidsFilter,
  ElementFilterType,
  ElementNamesFilter,
  EndevorCacheVersion,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { FilterNodeType, FilterValueNode } from '../../tree/_doc/FilterTree';
import { TelemetryEvents } from '../../_doc/telemetry/v2/Telemetry';

export const clearSearchLocationFilterValueCommand =
  (
    configurations: {
      getElementNamesFilterValue: (
        serviceId: EndevorId
      ) => (searchLocationId: EndevorId) => ElementNamesFilter | undefined;
      getElementCcidsFilterValue: (
        serviceId: EndevorId
      ) => (searchLocationId: EndevorId) => ElementCcidsFilter | undefined;
      getAllElements: (serviceId: EndevorId) => (
        searchLocationId: EndevorId
      ) =>
        | Readonly<{
            cacheVersion: EndevorCacheVersion;
            elements: ReadonlyArray<CachedElement>;
          }>
        | undefined;
    },
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (node: FilterValueNode): Promise<void> => {
    const serviceName = node.serviceName;
    const serviceSource = node.serviceSource;
    const locationName = node.searchLocationName;
    const locationSource = node.searchLocationSource;
    logger.trace(
      `Clear filter value ${node.name} of ${node.filterType} for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    const serviceId = {
      name: serviceName,
      source: serviceSource,
    };
    const searchLocationId = {
      name: locationName,
      source: locationSource,
    };
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_CLEAR_SEARCH_LOCATION_FILTER_VALUE_CALLED,
    });
    switch (node.filterType) {
      case FilterNodeType.CCIDS_FILTER: {
        const existingCcidFilter =
          configurations.getElementCcidsFilterValue(serviceId)(
            searchLocationId
          );
        if (!existingCcidFilter) return;
        if (!existingCcidFilter.value.includes(node.name)) return;

        const updatedFilter = existingCcidFilter.value.filter(
          (value) => value != node.name
        );

        dispatch({
          type: Actions.ELEMENT_CCIDS_FILTER_UPDATED,
          serviceId,
          searchLocationId,
          updatedFilter: {
            type: ElementFilterType.ELEMENT_CCIDS_FILTER,
            value: updatedFilter.length
              ? updatedFilter
              : [FILTER_WILDCARD_ZERO_OR_MORE],
          },
        });
        break;
      }
      case FilterNodeType.NAMES_FILTER: {
        const existingNameFilter =
          configurations.getElementNamesFilterValue(serviceId)(
            searchLocationId
          );
        if (!existingNameFilter) return;
        if (!existingNameFilter.value.includes(node.name)) return;
        const updatedFilter = existingNameFilter.value.filter(
          (value) => value != node.name
        );
        dispatch({
          type: Actions.ELEMENT_NAMES_FILTER_UPDATED,
          serviceId,
          searchLocationId,
          updatedFilter: {
            type: ElementFilterType.ELEMENT_NAMES_FILTER,
            value: updatedFilter.length
              ? updatedFilter
              : [FILTER_WILDCARD_ZERO_OR_MORE],
          },
        });
        break;
      }
      default:
        throw new UnreachableCaseError(node.filterType);
    }
  };
