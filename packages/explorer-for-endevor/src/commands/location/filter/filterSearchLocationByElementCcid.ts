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

import {
  FILTER_DELIMITER,
  FILTER_VALUE_DEFAULT,
  FILTER_WILDCARD_SINGLE,
  FILTER_WILDCARD_ZERO_OR_MORE,
} from '../../../constants';
import { askForSearchLocationFilterByElementCcid } from '../../../dialogs/locations/endevorSearchLocationDialogs';
import { logger, reporter } from '../../../globals';
import { Action, Actions } from '../../../store/_doc/Actions';
import {
  CachedElement,
  ElementCcidsFilter,
  ElementFilterType,
  EndevorCacheVersion,
  EndevorId,
} from '../../../store/_doc/v2/Store';
import { LocationNode } from '../../../tree/_doc/ServiceLocationTree';
import {
  TelemetryEvents,
  UpdateElementCcidFilterCommandCompletedStatus,
} from '../../../_doc/telemetry/Telemetry';

export const filterSearchLocationByElementCcidCommand =
  (
    configurations: {
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
  async ({
    name: locationName,
    source: locationSource,
    serviceName,
    serviceSource,
  }: LocationNode): Promise<void> => {
    logger.trace(
      `Set filtering by element ccid for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    const serviceId = {
      name: serviceName,
      source: serviceSource,
    };
    const searchLocationId = {
      name: locationName,
      source: locationSource,
    };
    const allElements =
      configurations.getAllElements(serviceId)(searchLocationId)?.elements;
    const existingFilter = configurations
      .getElementCcidsFilterValue(serviceId)(searchLocationId)
      ?.value.join(FILTER_DELIMITER);
    const filter = await askForSearchLocationFilterByElementCcid(
      locationName,
      existingFilter ? existingFilter : FILTER_VALUE_DEFAULT
    )(allElements);
    if (!filter) {
      logger.trace('No filter pattern provided.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED,
        status: UpdateElementCcidFilterCommandCompletedStatus.CANCELLED,
      });
      return;
    }
    if (filter === existingFilter) {
      logger.trace('Filter pattern unchanged.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED,
        status: UpdateElementCcidFilterCommandCompletedStatus.UNCHANGED,
        elementsFetched: !!allElements,
        patternsCount: existingFilter.split(FILTER_DELIMITER).length,
        wildcardUsed:
          existingFilter.includes(FILTER_WILDCARD_ZERO_OR_MORE) ||
          existingFilter.includes(FILTER_WILDCARD_SINGLE),
      });
      return;
    }
    if (filter === FILTER_VALUE_DEFAULT) {
      dispatch({
        type: Actions.ENDEVOR_SEARCH_LOCATION_FILTERS_CLEARED,
        serviceId,
        searchLocationId,
        filtersCleared: [ElementFilterType.ELEMENT_CCIDS_FILTER],
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED,
        status: UpdateElementCcidFilterCommandCompletedStatus.CLEARED,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED,
      status: UpdateElementCcidFilterCommandCompletedStatus.SUCCESS,
      elementsFetched: !!allElements,
      patternsCount: filter.split(FILTER_DELIMITER).length,
      wildcardUsed:
        filter.includes(FILTER_WILDCARD_ZERO_OR_MORE) ||
        filter.includes(FILTER_WILDCARD_SINGLE),
    });
    dispatch({
      type: Actions.ELEMENT_CCIDS_FILTER_UPDATED,
      serviceId,
      searchLocationId,
      updatedFilter: {
        type: ElementFilterType.ELEMENT_CCIDS_FILTER,
        value: filter.split(FILTER_DELIMITER),
      },
    });
  };
