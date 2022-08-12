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

import {
  ElementSearchLocation,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { Credential as EndevorCredential } from '@local/endevor/_doc/Credential';

export const STORAGE_VALUE_VERSION = '1';

export type ConnectionName = string;
export type InventoryLocationName = string;

// composite keys: source + name
export type ConnectionKey = string;
export type InventoryLocationKey = string;

export enum Source {
  INTERNAL = 'internal',
  SYNCHRONIZED = 'synchronized',
}

export const enum StorageType {
  CONNECTION_LOCATIONS = 'connectionLocations',
  CONNECTIONS = 'connections',
  INVENTORY_LOCATIONS = 'inventoryLocations',
  SETTINGS = 'settings',
}
export const enum SecureStorageType {
  CREDENTIALS = 'credentials',
}

export type Storage<Value> = {
  get: (defaultValue?: Value) => Promise<Value | Error>;
  store: (value: Value) => Promise<void | Error>;
  delete: () => Promise<void | Error>;
};

export interface Id {
  name: string;
  source: Source;
}

export type Connection = {
  id: Id;
  value: {
    location: ServiceLocation;
    rejectUnauthorized: boolean;
  };
};
export type Connections = {
  [key: ConnectionKey]: Connection;
};
export type ConnectionsStorage = Storage<Connections>;

export type InventoryLocation = {
  id: Id;
  value: ElementSearchLocation;
};
export type InventoryLocations = {
  [key: InventoryLocationKey]: InventoryLocation;
};
export type InventoryLocationsStorage = Storage<InventoryLocations>;

export type InventoryLocationNames = {
  [key: InventoryLocationKey]: {
    id: Id;
  };
};
export type ConnectionLocations = {
  [key: ConnectionKey]: {
    id: Id;
    value: InventoryLocationNames;
  };
};
export type ConnectionLocationsStorage = Storage<ConnectionLocations>;

export type Settings = {
  version: string;
};
export type SettingsStorage = Storage<Settings>;

export type Credential = {
  id: Id;
  value: EndevorCredential;
};
export type CredentialsStorage = {
  get: (id: Id) => Promise<Credential | Error | undefined>;
  store: (id: Id, value: Credential) => Promise<void | Error>;
  delete: (id: Id | ConnectionKey) => Promise<void | Error>;
};

export type StorageGetters = {
  getConnectionLocationsStorage: () => ConnectionLocationsStorage;
  getConnectionsStorage: () => ConnectionsStorage;
  getInventoryLocationsStorage: () => InventoryLocationsStorage;
  getCredentialsStorage: () => CredentialsStorage;
};
