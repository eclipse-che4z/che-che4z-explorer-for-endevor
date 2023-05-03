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
import {
  makeSecureStorage,
  makeStorage,
  StateStorage,
} from '@local/vscode-wrapper/storage';
import { SecretStorage } from 'vscode';
import { UNKNOWN_VERSION } from '../../constants';
import { logger } from '../../globals';
import { isError, isString } from '../../utils';
import { ProfileStore } from '@local//profiles/_doc/ProfileStore';
import {
  getConnections as getConnectionsFromProfiles,
  getCredential as getCredentialFromProfile,
  getInventoryLocations as getInventoryLocationsFromProfiles,
} from './profiles';
import { toCompositeKey } from './utils';
import {
  ConnectionLocationsStorage,
  ConnectionsStorage,
  CredentialsStorage,
  InventoryLocationsStorage,
  SecureStorageType,
  Source,
  StorageType,
  STORAGE_VALUE_VERSION,
  SettingsStorage,
  Settings,
  Connections,
  InventoryLocations,
  ConnectionLocations,
  Credential,
} from './_doc/Storage';

export const createConnectionLocationsStorage = (
  state: StateStorage
): ConnectionLocationsStorage => {
  const storageId = StorageType.CONNECTION_LOCATIONS;
  const genericStorage = makeStorage<{
    value: ConnectionLocations;
    version: string;
  }>(state);
  return {
    get: async (defaultValue?) => {
      const versionedConnectionLocations = genericStorage.get(storageId, {
        value: defaultValue ? defaultValue : {},
        version: STORAGE_VALUE_VERSION,
      });
      if (isError(versionedConnectionLocations)) {
        const error = versionedConnectionLocations;
        return error;
      }
      return versionedConnectionLocations.value;
    },
    store: async (value) => {
      logger.trace(
        `Update storage called for "${storageId}" with value: ${JSON.stringify(
          value,
          null,
          2
        )}`
      );
      return genericStorage.store(storageId, {
        value,
        version: STORAGE_VALUE_VERSION,
      });
    },
    delete: () => genericStorage.delete(storageId),
  };
};

export const createConnectionsStorage =
  (state: StateStorage) =>
  async (profilesStore?: ProfileStore): Promise<ConnectionsStorage> => {
    const storageId = StorageType.CONNECTIONS;
    const genericStorage = makeStorage<{
      value: Connections;
      version: string;
    }>(state);
    return {
      get: async (defaultValue?) => {
        const defaultConnections = defaultValue ? defaultValue : {};
        const versionedConnections = genericStorage.get(storageId, {
          value: defaultConnections,
          version: STORAGE_VALUE_VERSION,
        });
        let internalConnections: Connections | undefined;
        if (isError(versionedConnections)) {
          const error = versionedConnections;
          logger.error(
            `Unable to read from persistent storage "${storageId}".`,
            `Unable to read from persistent storage "${storageId}" because of error: ${error.message}.`
          );
        } else {
          internalConnections = versionedConnections.value;
        }
        let syncedConnections: Connections | Error = profilesStore
          ? await getConnectionsFromProfiles(profilesStore)
          : {};
        if (isError(syncedConnections)) {
          const error = syncedConnections;
          logger.error(
            `Unable to read Endevor profiles from Zowe.`,
            `Unable to read Endevor profiles from Zowe because of error: ${error.message}.`
          );
          syncedConnections = {};
        }
        const mergedConnections: Connections = {
          ...internalConnections,
          ...syncedConnections,
        };
        return Object.keys(mergedConnections).length
          ? mergedConnections
          : defaultConnections;
      },
      store: (value) => {
        logger.trace(
          `Update storage called for "${storageId}" with value: ${JSON.stringify(
            value,
            null,
            2
          )}.`
        );
        return genericStorage.store(storageId, {
          value: Object.entries(value).reduce(
            (acc: Connections, [connectionKey, connection]) => {
              if (connection.id.source !== Source.INTERNAL) return acc;
              acc[connectionKey] = connection;
              return acc;
            },
            {}
          ),
          version: STORAGE_VALUE_VERSION,
        });
      },
      delete: () => genericStorage.delete(storageId),
    };
  };

export const createInventoryLocationsStorage =
  (state: StateStorage) =>
  async (profilesStore?: ProfileStore): Promise<InventoryLocationsStorage> => {
    const storageId = StorageType.INVENTORY_LOCATIONS;
    const genericStorage = makeStorage<{
      value: InventoryLocations;
      version: string;
    }>(state);
    return {
      get: async (defaultValue?) => {
        const defaultInventoryLocations = defaultValue ? defaultValue : {};
        const versionedInventoryLocations = genericStorage.get(storageId, {
          value: defaultInventoryLocations,
          version: STORAGE_VALUE_VERSION,
        });
        let internalInventoryLocations: InventoryLocations | undefined;
        if (isError(versionedInventoryLocations)) {
          const error = versionedInventoryLocations;
          logger.error(
            `Unable to read from persistent storage "${storageId}".`,
            `Unable to read from persistent storage "${storageId}" because of error: ${error.message}.`
          );
        } else {
          internalInventoryLocations = versionedInventoryLocations.value;
        }
        let syncedInventoryLocations: InventoryLocations | Error = profilesStore
          ? await getInventoryLocationsFromProfiles(profilesStore)
          : {};
        if (isError(syncedInventoryLocations)) {
          const error = syncedInventoryLocations;
          logger.error(
            `Unable to read Endevor location profiles from Zowe.`,
            `Unable to read Endevor location profiles from Zowe because of error: ${error.message}.`
          );
          syncedInventoryLocations = {};
        }
        const mergedInventoryLocations: InventoryLocations = {
          ...internalInventoryLocations,
          ...syncedInventoryLocations,
        };
        return Object.keys(mergedInventoryLocations).length
          ? mergedInventoryLocations
          : defaultInventoryLocations;
      },
      store: (value) => {
        logger.trace(
          `Update storage called for "${storageId}" with value: ${JSON.stringify(
            value,
            null,
            2
          )}`
        );
        return genericStorage.store(storageId, {
          value: Object.entries(value).reduce(
            (
              acc: InventoryLocations,
              [inventoryLocationKey, inventoryLocation]
            ) => {
              if (inventoryLocation.id.source !== Source.INTERNAL) return acc;
              acc[inventoryLocationKey] = inventoryLocation;
              return acc;
            },
            {}
          ),
          version: STORAGE_VALUE_VERSION,
        });
      },
      delete: () => genericStorage.delete(storageId),
    };
  };

export const createCredentialsStorage =
  (secrets: SecretStorage) =>
  async (profilesStore?: ProfileStore): Promise<CredentialsStorage> => {
    const storageId = SecureStorageType.CREDENTIALS;
    const secureStorage = makeSecureStorage<{
      value: Credential;
      version: string;
    }>(secrets);
    return {
      get: async (id) => {
        switch (id.source) {
          case Source.SYNCHRONIZED:
            return profilesStore
              ? getCredentialFromProfile(profilesStore)(id.name)
              : undefined;
          case Source.INTERNAL: {
            const versionedCredential = await secureStorage.get(
              `${storageId}.${toCompositeKey(id)}`
            );
            if (isError(versionedCredential)) return versionedCredential;
            if (!versionedCredential) return;
            return versionedCredential.value;
          }
          default:
            throw new UnreachableCaseError(id.source);
        }
      },
      store: async (id, value) => {
        switch (id.source) {
          case Source.SYNCHRONIZED: {
            return;
          }
          case Source.INTERNAL: {
            return secureStorage.store(`${storageId}.${toCompositeKey(id)}`, {
              value,
              version: STORAGE_VALUE_VERSION,
            });
          }
          default:
            throw new UnreachableCaseError(id.source);
        }
      },
      delete: async (id) => {
        let key: string;
        if (isString(id)) {
          key = id;
          switch (true) {
            case key.startsWith(Source.SYNCHRONIZED):
              return;
            case key.startsWith(Source.INTERNAL): {
              return secureStorage.delete(`${storageId}.${key}`);
            }
            default:
              throw new Error(`Incorrect key for ${storageId}: ${key}`);
          }
        }
        key = toCompositeKey(id);
        switch (id.source) {
          case Source.SYNCHRONIZED: {
            return;
          }
          case Source.INTERNAL: {
            return secureStorage.delete(`${storageId}.${key}`);
          }
          default:
            throw new UnreachableCaseError(id.source);
        }
      },
    };
  };

export const createSettingsStorage = (state: StateStorage): SettingsStorage => {
  const storageId = StorageType.SETTINGS;
  const genericStorage = makeStorage<{
    value: Settings;
    version: string;
  }>(state);
  return {
    get: async (defaultValue?) => {
      const versionedSettings = genericStorage.get(storageId, {
        value: defaultValue ? defaultValue : { version: UNKNOWN_VERSION },
        version: STORAGE_VALUE_VERSION,
      });
      if (isError(versionedSettings)) {
        const error = versionedSettings;
        return error;
      }
      return versionedSettings.value;
    },
    store: (value: Settings) => {
      logger.trace(
        `Update storage called for "${storageId}" with value: ${JSON.stringify(
          value,
          null,
          2
        )}`
      );
      return genericStorage.store(storageId, {
        value,
        version: STORAGE_VALUE_VERSION,
      });
    },
    delete: () => genericStorage.delete(storageId),
  };
};
