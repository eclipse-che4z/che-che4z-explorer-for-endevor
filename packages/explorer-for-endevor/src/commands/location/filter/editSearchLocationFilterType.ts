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
import { logger, reporter } from '../../../globals';
import { Action } from '../../../store/_doc/Actions';
import {
  CachedElement,
  ElementCcidsFilter,
  ElementNamesFilter,
  ElementTypesFilter,
  EndevorCacheVersion,
  EndevorId,
} from '../../../store/_doc/v2/Store';
import { FilterNodeType, FilterValueNode } from '../../../tree/_doc/FilterTree';
import { LocationNode } from '../../../tree/_doc/ServiceLocationTree';
import { TelemetryEvents } from '../../../telemetry/_doc/Telemetry';
import { filterSearchLocationByElementCcidCommand } from './filterSearchLocationByElementCcid';
import { filterSearchLocationByElementNameCommand } from './filterSearchLocationByElementName';
import { filterSearchLocationByElementTypeCommand } from './filterSearchLocationByElementType';

export const editSearchLocationFilterTypeCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    configurations: {
      getElementNamesFilterValue: (
        serviceId: EndevorId
      ) => (searchLocationId: EndevorId) => ElementNamesFilter | undefined;
      getElementTypesFilterValue: (
        serviceId: EndevorId
      ) => (searchLocationId: EndevorId) => ElementTypesFilter | undefined;
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
    }
  ) =>
  async (node: FilterValueNode): Promise<void> => {
    const serviceName = node.serviceName;
    const serviceSource = node.serviceSource;
    const locationName = node.searchLocationName;
    const locationSource = node.searchLocationSource;
    logger.trace(
      `Clear filter for the ${locationSource} inventory location ${locationName} within the ${serviceSource} Endevor connection ${serviceName}.`
    );
    switch (node.filterType) {
      case FilterNodeType.CCIDS_FILTER: {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_CALL,
        });
        filterSearchLocationByElementCcidCommand(
          dispatch,
          configurations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        )({
          name: locationName,
          source: locationSource,
          serviceName,
          serviceSource,
        } as LocationNode);
        break;
      }
      case FilterNodeType.NAMES_FILTER: {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_CALL,
        });
        filterSearchLocationByElementNameCommand(
          dispatch,
          configurations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        )({
          name: locationName,
          source: locationSource,
          serviceName,
          serviceSource,
        } as LocationNode);
        break;
      }
      case FilterNodeType.TYPES_FILTER: {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_CALL,
        });
        filterSearchLocationByElementTypeCommand(
          dispatch,
          configurations
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        )({
          name: locationName,
          source: locationSource,
          serviceName,
          serviceSource,
        } as LocationNode);
        break;
      }
      default:
        throw new UnreachableCaseError(node.filterType);
    }
  };
