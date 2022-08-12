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

import { Memento, SecretStorage } from 'vscode';
import { GenericStorage, SecureStorage } from './_doc/storage';

export type StateStorage = Memento & {
  setKeysForSync(keys: readonly string[]): void;
};

export const makeStorage = <T>(state: StateStorage): GenericStorage<T> => {
  return {
    keys: () => {
      let result;
      try {
        result = state.keys();
      } catch (error) {
        return new Error(
          `Unable to get keys from storage because of error: ${error.message}`
        );
      }
      return result;
    },
    get: (key, defaultValue) => {
      let result;
      try {
        result = state.get(key, defaultValue);
      } catch (error) {
        return new Error(
          `Unable to get the key ${key} from storage because of error: ${error.message}`
        );
      }
      return result;
    },
    store: async (key, value) => {
      let result;
      try {
        result = await state.update(key, value);
      } catch (error) {
        return new Error(
          `Unable to update the key ${key} in storage because of error: ${error.message}`
        );
      }
      return result;
    },
    delete: async (key) => {
      let result;
      try {
        result = await state.update(key, undefined);
      } catch (error) {
        return new Error(
          `Unable to delete the key ${key} in storage because of error: ${error.message}`
        );
      }
      return result;
    },
  };
};

export const makeSecureStorage = <T>(
  secrets: SecretStorage
): SecureStorage<T> => {
  return {
    get: async (key) => {
      let stringResult;
      try {
        stringResult = await secrets.get(key);
      } catch (error) {
        return new Error(
          `Unable to get the key ${key} from secure storage because of error: ${error.message}`
        );
      }
      if (!stringResult) return;
      let result: T;
      try {
        result = JSON.parse(stringResult);
      } catch (error) {
        return new Error(
          `Unable to parse secure storage value under the key ${key} because of: ${error.message}`
        );
      }
      return result;
    },
    store: async (key, value) => {
      let result;
      try {
        result = await secrets.store(key, JSON.stringify(value));
      } catch (error) {
        return new Error(
          `Unable to update the key ${key} in secure storage because of error: ${error.message}`
        );
      }
      return result;
    },
    delete: async (key) => {
      let result;
      try {
        result = await secrets.delete(key);
      } catch (error) {
        return new Error(
          `Unable to delete the key ${key} in secure storage because of error: ${error.message}`
        );
      }
      return result;
    },
  };
};
