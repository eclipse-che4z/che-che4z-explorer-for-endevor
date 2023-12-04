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

import { ZOWE_PROFILE_DESCRIPTION } from '../../constants';
import {
  askForSearchLocationDeletion,
  askToDeleteSearchLocationForAllServices,
} from '../../dialogs/locations/endevorSearchLocationDialogs';
import { reporter } from '../../globals';
import { Source } from '../../store/storage/_doc/Storage';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  EndevorId,
  EndevorServiceDescriptions,
} from '../../store/_doc/v2/Store';
import { LocationNode } from '../../tree/_doc/ServiceLocationTree';
import {
  CommandDeleteSearchLocationCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { hideSearchLocation } from './hideSearchLocation';
import { createEndevorLogger } from '../../logger';

export const deleteSearchLocation =
  (
    dispatch: (action: Action) => Promise<void>,
    getServiceDescriptionsBySearchLocationId: (
      searchLocationId: EndevorId
    ) => Promise<EndevorServiceDescriptions>
  ) =>
  async (node: LocationNode): Promise<void> => {
    const searchLocationId: EndevorId = {
      name: node.name,
      source: node.source,
    };
    const serviceName = node.serviceName;
    const serviceSource = node.serviceSource;
    const logger = createEndevorLogger({
      serviceId: { name: serviceName, source: serviceSource },
      searchLocationId,
    });
    logger.traceWithDetails(
      `Delete the Endevor inventory location from the Endevor service was called.`
    );
    const usedByServices = Object.values(
      await getServiceDescriptionsBySearchLocationId(searchLocationId)
    );
    if (
      usedByServices.length === 1 &&
      usedByServices[0]?.id.name === serviceName &&
      usedByServices[0]?.id.source === serviceSource
    ) {
      if (await askForSearchLocationDeletion(searchLocationId.name)) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED,
          status: CommandDeleteSearchLocationCompletedStatus.SUCCESS,
          inUseByServicesAmount: usedByServices.length,
          source: searchLocationId.source,
        });
        dispatch({
          type: Actions.ENDEVOR_SEARCH_LOCATION_DELETED,
          searchLocationId,
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED,
        status: CommandDeleteSearchLocationCompletedStatus.CANCELLED,
      });
      return;
    }
    const selectedService = usedByServices.find(
      (service) => service.id.name === serviceName
    );
    const deletionOptions = await askToDeleteSearchLocationForAllServices(
      searchLocationId.name,
      selectedService?.duplicated &&
        selectedService?.id.source === Source.SYNCHRONIZED
        ? `${serviceName} [${ZOWE_PROFILE_DESCRIPTION}]`
        : serviceName,
      usedByServices.map((service) =>
        service.duplicated && service.id.source === Source.SYNCHRONIZED
          ? `${service.id.name} [${ZOWE_PROFILE_DESCRIPTION}]`
          : service.id.name
      )
    );
    if (!deletionOptions) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED,
        status: CommandDeleteSearchLocationCompletedStatus.CANCELLED,
      });
      return;
    }
    if (deletionOptions.deleteForAllServices) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED,
        status: CommandDeleteSearchLocationCompletedStatus.SUCCESS,
        inUseByServicesAmount: usedByServices.length,
        source: searchLocationId.source,
      });
      dispatch({
        type: Actions.ENDEVOR_SEARCH_LOCATION_DELETED,
        searchLocationId,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED,
      status: CommandDeleteSearchLocationCompletedStatus.HIDED,
      inUseByServicesAmount: usedByServices.length,
      source: searchLocationId.source,
    });
    hideSearchLocation(dispatch)(node);
  };
