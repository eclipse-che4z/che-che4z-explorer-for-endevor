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

import {
  DUPLICATE_ELEMENT_ERROR,
  FINGERPRINT_MISMATCH_ERROR,
  FINGERPRINT_SIGNOUT_ERROR,
  NOT_SIGNOUT_ERROR,
  CHANGE_REGRESSION_INFO,
} from '../const';

type GeneralError = Error;

export function getTypedErrorFromEndevorError(
  elementName: string,
  endevorMessage: string
): FingerprintMismatchError | SignoutError | GeneralError {
  switch (true) {
    case endevorMessage.includes(FINGERPRINT_MISMATCH_ERROR):
      return new FingerprintMismatchError(elementName, endevorMessage);
    case endevorMessage.includes(FINGERPRINT_SIGNOUT_ERROR):
      return new SignoutError(elementName, endevorMessage);
    case endevorMessage.includes(NOT_SIGNOUT_ERROR):
      return new SignoutError(elementName, endevorMessage);
    case endevorMessage.includes(DUPLICATE_ELEMENT_ERROR):
      return new DuplicateElementError(elementName, endevorMessage);
    case endevorMessage.includes(CHANGE_REGRESSION_INFO):
      return new ChangeRegressionError(elementName, endevorMessage);
    default:
      return new Error(
        `Endevor error for element ${elementName}: ${endevorMessage}`
      );
  }
}

export class FingerprintMismatchError extends Error {
  constructor(elementName: string, endevorMessage: string) {
    super(
      `Fingerprint provided does not match record in Endevor for element ${elementName}: ${endevorMessage}`
    );
  }
}

export class SignoutError extends Error {
  constructor(elementName: string, endevorMessage: string) {
    super(`Unable to signout element ${elementName}: ${endevorMessage}`);
  }
}

export class DuplicateElementError extends Error {
  constructor(elementName: string, endevorMessage: string) {
    super(
      `An element with the name ${elementName} already exist: ${endevorMessage}`
    );
  }
}

export class ChangeRegressionError extends Error {
  constructor(elementName: string, endevorMessage: string) {
    super(
      `Regression on prior level of element ${elementName}: ${endevorMessage}`
    );
  }
}
