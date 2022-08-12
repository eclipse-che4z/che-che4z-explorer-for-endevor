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

export type GenericStorage<T> = {
  keys: () => ReadonlyArray<string> | Error;
  get: (key: string, defaultValue: T) => T | Error;
  store: (key: string, value: T) => Promise<void | Error>;
  delete: (key: string) => Promise<void | Error>;
};

export type SecureStorage<T> = {
  get: (key: string) => Promise<T | Error | undefined>;
  store: (key: string, value: T) => Promise<void | Error>;
  delete: (key: string) => Promise<void | Error>;
};
