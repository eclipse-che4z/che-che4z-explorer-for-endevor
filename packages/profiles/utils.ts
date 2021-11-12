/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

export const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const replaceEmptyStringsIntoUndefined = <T>(value: T): T => {
  const cleanObject = Object.fromEntries(Object.entries(value));
  const keys = Object.keys(value);
  for (const prop of keys) {
    if (
      typeof cleanObject[prop] === 'string' &&
      isEmptyString(cleanObject[prop])
    ) {
      cleanObject[prop] = undefined;
    }
  }
  return JSON.parse(JSON.stringify(cleanObject));
};

export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};

export const isEmptyString = (value: string): boolean => {
  return value.length === 0 || !value.trim();
};

export const stringifyWithHiddenCredential = (value: unknown): string => {
  return JSON.stringify(value, (key, value) =>
    key === 'password' || key === 'token' || key === 'base64EncodedAuth'
      ? '*****'
      : value
  );
};
