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
  DUPLICATE_ELEMENT_ERROR,
  FINGERPRINT_MISMATCH_ERROR,
  FINGERPRINT_SIGNOUT_ERROR,
  NOT_SIGNOUT_ERROR,
  CHANGE_REGRESSION_INFO,
} from '../const';

type EndevorErrorContext = {
  elementName: string;
  endevorMessage: string;
};

type GeneralError = Error;

export function getTypedErrorFromEndevorError(
  { elementName, endevorMessage }: EndevorErrorContext,
  errorMessage?: string
):
  | FingerprintMismatchError
  | SignoutError
  | DuplicateElementError
  | ChangeRegressionError
  | GeneralError {
  switch (true) {
    case endevorMessage.includes(FINGERPRINT_MISMATCH_ERROR):
      return new FingerprintMismatchError(
        errorMessage ||
          `Fingerprint provided does not match record in Endevor for element ${elementName}: ${endevorMessage}`
      );
    case endevorMessage.includes(FINGERPRINT_SIGNOUT_ERROR):
      return new SignoutError(
        errorMessage ||
          `Unable to signout element ${elementName}: ${endevorMessage}`
      );
    case endevorMessage.includes(NOT_SIGNOUT_ERROR):
      return new SignoutError(
        errorMessage ||
          `Unable to signout element ${elementName}: ${endevorMessage}`
      );
    case endevorMessage.includes(DUPLICATE_ELEMENT_ERROR):
      return new DuplicateElementError(
        errorMessage ||
          `An element with the name ${elementName} already exist: ${endevorMessage}`
      );
    case endevorMessage.includes(CHANGE_REGRESSION_INFO):
      return new ChangeRegressionError(
        errorMessage ||
          `Regression on prior level of element ${elementName}: ${endevorMessage}`
      );
    default:
      return new Error(
        errorMessage ||
          `Endevor error for element ${elementName}: ${endevorMessage}`
      );
  }
}

export class FingerprintMismatchError extends Error {}

export class SignoutError extends Error {}

export class DuplicateElementError extends Error {}

export class ChangeRegressionError extends Error {}
