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
  FILTER_WILDCARD_SINGLE,
  FILTER_WILDCARD_ZERO_OR_MORE,
} from '../../../constants';
import { askForSearchLocationFilterByElementType } from '../../../dialogs/locations/endevorSearchLocationDialogs';
import { logger, reporter } from '../../../globals';
import { Action, Actions } from '../../../store/_doc/Actions';
import {
  CachedElement,
  ElementFilterType,
  ElementTypesFilter,
  EndevorCacheVersion,
  EndevorId,
} from '../../../store/_doc/v2/Store';
import { LocationNode } from '../../../tree/_doc/ServiceLocationTree';
import {
  TelemetryEvents,
  UpdateElementTypeFilterCommandCompletedStatus,
} from '../../../_doc/telemetry/v2/Telemetry';

export const filterSearchLocationByElementTypeCommand =
  (
    configurations: {
      getElementTypesFilterValue: (
        serviceId: EndevorId
      ) => (searchLocationId: EndevorId) => ElementTypesFilter | undefined;
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
      `Set filtering by element type for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_CALLED,
    });
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
      .getElementTypesFilterValue(serviceId)(searchLocationId)
      ?.value.join(FILTER_DELIMITER);
    const filter = await askForSearchLocationFilterByElementType(
      locationName,
      existingFilter
    )(allElements);
    if (!filter) {
      logger.trace('No filter pattern provided.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED,
        status: UpdateElementTypeFilterCommandCompletedStatus.CANCELLED,
      });
      return;
    }
    if (filter === existingFilter) {
      logger.trace('Filter pattern unchanged.');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED,
        status: UpdateElementTypeFilterCommandCompletedStatus.UNCHANGED,
        elementsFetched: !!allElements,
        patternsCount: existingFilter.split(FILTER_DELIMITER).length,
        wildcardUsed:
          existingFilter.includes(FILTER_WILDCARD_ZERO_OR_MORE) ||
          existingFilter.includes(FILTER_WILDCARD_SINGLE),
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED,
      status: UpdateElementTypeFilterCommandCompletedStatus.SUCCESS,
      elementsFetched: !!allElements,
      patternsCount: filter.split(FILTER_DELIMITER).length,
      wildcardUsed:
        filter.includes(FILTER_WILDCARD_ZERO_OR_MORE) ||
        filter.includes(FILTER_WILDCARD_SINGLE),
    });
    dispatch({
      type: Actions.ELEMENT_TYPES_FILTER_UPDATED,
      serviceId,
      searchLocationId,
      updatedFilter: {
        type: ElementFilterType.ELEMENT_TYPES_FILTER,
        value: filter.split(FILTER_DELIMITER),
      },
    });
  };
