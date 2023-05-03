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
  ConnectionLocationsStorage,
  Id,
  Source,
  ConnectionLocations,
  InventoryLocationNames,
} from './_doc/Storage';
import { isError } from '../../utils';
import { getLocations, LocationConfig } from '../../settings/_doc/Settings';
import { logger, reporter } from '../../globals';
import {
  TelemetryEvents,
  ProfileMigrationCompletedStatus,
} from '../../_doc/telemetry/v2/Telemetry';
import { toCompositeKey } from './utils';

const getSettingsConnectionLocations = (): ConnectionLocations | Error => {
  let settingsValues: ReadonlyArray<LocationConfig>;
  try {
    settingsValues = getLocations();
  } catch (error) {
    return error;
  }
  return settingsValues.reduce(
    (acc: ConnectionLocations, { service: serviceName, elementLocations }) => {
      const serviceId: Id = {
        name: serviceName,
        source: Source.SYNCHRONIZED,
      };
      acc[toCompositeKey(serviceId)] = {
        value: elementLocations.reduce(
          (acc: InventoryLocationNames, searchLocationName) => {
            const searchLocationId: Id = {
              name: searchLocationName,
              source: Source.SYNCHRONIZED,
            };
            acc[toCompositeKey(searchLocationId)] = {
              id: searchLocationId,
            };
            return acc;
          },
          {}
        ),
        id: serviceId,
      };
      return acc;
    },
    {}
  );
};

export const mergeConnectionLocations = (
  existingConnectionLocations: ConnectionLocations,
  connectionLocationsFromSettings: ConnectionLocations
): ConnectionLocations => {
  const mergedWithSettings = Object.entries(
    connectionLocationsFromSettings
  ).reduce(
    (
      acc: ConnectionLocations,
      [serviceKeyFromSettings, connectionLocationFromSettings]
    ) => {
      const existingConnectionLocation =
        existingConnectionLocations[serviceKeyFromSettings];
      if (existingConnectionLocation) {
        acc[serviceKeyFromSettings] = {
          ...existingConnectionLocation,
          value: {
            ...existingConnectionLocation.value,
            ...connectionLocationFromSettings.value,
          },
        };
        return acc;
      }
      acc[serviceKeyFromSettings] = connectionLocationFromSettings;
      return acc;
    },
    {}
  );
  return {
    ...existingConnectionLocations,
    ...mergedWithSettings,
  };
};

export const migrateConnectionLocationsFromSettings = async (
  getConnectionLocationsStorage: () => ConnectionLocationsStorage
): Promise<void | Error> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.PROFILES_MIGRATION_CALLED,
  });
  const existingConnectionLocations =
    await getConnectionLocationsStorage().get();
  if (isError(existingConnectionLocations)) {
    const error = existingConnectionLocations;
    logger.warn(
      'Profiles migration failed. Unable to read the connection locations from the extension storage.',
      `Profiles migration failed. Unable to read the connection locations from the extension storage because of ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.PROFILES_MIGRATION_CALLED,
      status: ProfileMigrationCompletedStatus.NO_PROFILES_MIGRATED,
      error,
    });
    return error;
  }
  const connectionLocationsFromSettings = getSettingsConnectionLocations();
  if (isError(connectionLocationsFromSettings)) {
    const error = connectionLocationsFromSettings;
    logger.warn(
      'Profiles migration failed. Unable to read the connection locations from the external storage.',
      `Profiles migration failed. Unable to read the connection locations from the external storage because of ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.PROFILES_MIGRATION_CALLED,
      status: ProfileMigrationCompletedStatus.NO_PROFILES_MIGRATED,
      error,
    });
    return error;
  }
  const updatedConnectionLocations = mergeConnectionLocations(
    existingConnectionLocations,
    connectionLocationsFromSettings
  );
  const storeResult = getConnectionLocationsStorage().store(
    updatedConnectionLocations
  );
  if (isError(storeResult)) {
    const error = storeResult;
    logger.warn(
      'Profiles migration failed. Unable to add the connection locations to the extension storage.',
      `Profiles migration failed. Unable to add the connection locations to the extension storage because of ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.PROFILES_MIGRATION_CALLED,
      status: ProfileMigrationCompletedStatus.NO_PROFILES_MIGRATED,
      error,
    });
    return error;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.PROFILES_MIGRATION_COMPLETED,
    status: ProfileMigrationCompletedStatus.NEW_PROFILES_MIGRATED,
  });
  return;
};
