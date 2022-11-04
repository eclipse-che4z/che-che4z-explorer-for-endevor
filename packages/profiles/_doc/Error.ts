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

import { isError } from '../utils';
import { ProfileTypes } from '../_ext/Profile';

export class ProfileWithNameNotFoundError extends Error {
  constructor(profileName: string, profileType: ProfileTypes, cause?: Error) {
    super(
      `Profile with name ${profileName} of type ${profileType} was not found ${
        cause ? ` because of ${cause.message}` : ''
      }`
    );
    Object.setPrototypeOf(this, ProfileWithNameNotFoundError.prototype);
  }
}

export const isProfileWithNameNotFoundError = <T>(
  value: T | ProfileWithNameNotFoundError
): value is ProfileWithNameNotFoundError => {
  return value instanceof ProfileWithNameNotFoundError;
};

export class ProfileValidationError extends Error {
  constructor(profileName: string, profileType: ProfileTypes, cause: Error) {
    super(
      `Profile with name ${profileName} of type ${profileType} is not valid because of ${cause.message}`
    );
    Object.setPrototypeOf(this, ProfileValidationError.prototype);
  }
}

export const isProfileValidationError = <T>(
  value: T | ProfileValidationError
): value is ProfileValidationError => {
  return value instanceof ProfileValidationError;
};

export class ProfileStoreAPIError extends Error {
  constructor(cause: Error | string) {
    super(`Profile store API error: ${isError(cause) ? cause.message : cause}`);
    Object.setPrototypeOf(this, ProfileStoreAPIError.prototype);
  }
}

export const isProfileStoreAPIError = <T>(
  value: T | ProfileStoreAPIError
): value is ProfileStoreAPIError => {
  return value instanceof ProfileStoreAPIError;
};

export class ProfileStoreError extends Error {
  constructor(cause: Error | string) {
    super(
      `Profile store initialization error: ${
        isError(cause) ? cause.message : cause
      }`
    );
    Object.setPrototypeOf(this, ProfileStoreError.prototype);
  }
}

export const isProfileStoreError = <T>(
  value: T | ProfileStoreError
): value is ProfileStoreError => {
  return value instanceof ProfileStoreError;
};
