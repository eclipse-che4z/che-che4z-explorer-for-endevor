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
  PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR,
  PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE,
  OPENSSL_ERROR_CERT_SIGNATURE,
  OPENSSL_ERROR_LOCAL_CERT_ISSUER,
  OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT,
  OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN,
  OPENSSL_ERROR_CERT_ISSUER,
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
  | ProcessorStepMaxRcExceededError
  | GeneralError {
  switch (true) {
    case endevorMessage.includes(FINGERPRINT_MISMATCH_ERROR):
      return new FingerprintMismatchError(
        errorMessage ||
          `Fingerprint provided does not match record in Endevor for element ${elementName}: ${endevorMessage}`
      );
    case endevorMessage.includes(FINGERPRINT_SIGNOUT_ERROR):
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
    case endevorMessage.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR):
    case endevorMessage.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE):
      return new ProcessorStepMaxRcExceededError(
        errorMessage ||
          `Processor step return code exceeds the max value for the element ${elementName}: ${endevorMessage}`
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

export class ProcessorStepMaxRcExceededError extends Error {}

type HttpErrorContext = {
  code: string;
  message: string;
};

export function getTypedErrorFromHttpError(
  { code, message }: HttpErrorContext,
  errorMessage?: string
): SelfSignedCertificateError | GeneralError {
  switch (true) {
    case code.includes(OPENSSL_ERROR_CERT_SIGNATURE):
    case code.includes(OPENSSL_ERROR_CERT_ISSUER):
    case code.includes(OPENSSL_ERROR_LOCAL_CERT_ISSUER):
    case code.includes(OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN):
    case code.includes(OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT):
      return new SelfSignedCertificateError(
        errorMessage || `A problem with server certificate: ${message}`
      );
    default:
      return new Error(
        errorMessage || `Failed to connect with a code ${code}: ${message}`
      );
  }
}

export class SelfSignedCertificateError extends Error {}
