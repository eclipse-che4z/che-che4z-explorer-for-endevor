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

import { TimeoutError } from './_doc/Error';

export const isTimeoutError = <T>(
  value: T | TimeoutError
): value is TimeoutError => {
  return value instanceof TimeoutError;
};

export const toPromiseWithTimeout =
  (timeout: number) =>
  async <T>(inputPromise: Promise<T>): Promise<T | TimeoutError> => {
    return Promise.race([
      inputPromise,
      new Promise<TimeoutError>((resolve) =>
        setTimeout(() => resolve(new TimeoutError()), timeout)
      ),
    ]);
  };

export const operationCancelled = <T>(
  value: T | undefined
): value is undefined => {
  return value === undefined;
};

export const valueNotProvided = <T>(
  value: T | undefined
): value is undefined => {
  if (typeof value === 'boolean') {
    return !value.toString();
  }
  return !value;
};
