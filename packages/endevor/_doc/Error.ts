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
  WRONG_CREDENTIALS_SEVERE,
  NO_COMPONENT_INFO_ERROR,
} from '../const';
import { UnreachableCaseError } from '../typeHelpers';

export const enum ErrorContextTypes {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  API_ERROR = 'API_ERROR',
  INCORRECT_RESPONSE_ERROR = 'INCORRECT_RESPONSE_ERROR',
  ENDEVOR_RETURN_CODE_AND_MESSAGES = 'ENDEVOR_RETURN_CODE_AND_MESSAGES',
}

type ErrorContext =
  | Readonly<{
      type: ErrorContextTypes.CONNECTION_ERROR;
      code: string;
      message: string;
    }>
  | Readonly<{
      type:
        | ErrorContextTypes.API_ERROR
        | ErrorContextTypes.INCORRECT_RESPONSE_ERROR;
      error: Error;
      returnCode?: number;
    }>
  | Readonly<{
      type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES;
      returnCode: number;
      messages: ReadonlyArray<string>;
    }>;

type GeneralError = Error;

export class FingerprintMismatchError extends Error {}

export class SignoutError extends Error {}

export class DuplicateElementError extends Error {}

export class ChangeRegressionError extends Error {}

export class ProcessorStepMaxRcExceededError extends Error {}

export class NoComponentInfoError extends Error {}

export class WrongCredentialsError extends Error {}

export class ConnectionError extends Error {}

export class SelfSignedCertificateError extends ConnectionError {}

export const makeError =
  (errorMessage: string) =>
  (
    errorContext?: ErrorContext
  ):
    | FingerprintMismatchError
    | SignoutError
    | DuplicateElementError
    | ChangeRegressionError
    | ProcessorStepMaxRcExceededError
    | NoComponentInfoError
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | GeneralError => {
    const cleanedMessage = errorMessage.trim();
    if (!errorContext) return new Error(cleanedMessage);
    const errorContextType = errorContext.type;
    switch (errorContextType) {
      case ErrorContextTypes.CONNECTION_ERROR:
        return getTypedErrorFromHttpCode(
          `${cleanedMessage} because of HTTP response code ${errorContext.code} with reason:\n${errorContext.message}`
        );
      case ErrorContextTypes.API_ERROR:
        return new Error(
          `${cleanedMessage} because of error:${[
            '',
            errorContext.error.message.trim(),
          ].join('\n')}`
        );
      case ErrorContextTypes.INCORRECT_RESPONSE_ERROR: {
        if (errorContext.returnCode) {
          return new Error(
            `${cleanedMessage} because of incorrect response error:\n${errorContext.error}\nwith response code ${errorContext.returnCode}`
          );
        }
        return new Error(
          `${cleanedMessage} because of incorrect response error:\n${errorContext.error}`
        );
      }
      case ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES:
        return getTypedErrorFromEndevorCode(
          `${cleanedMessage} because of response code ${
            errorContext.returnCode
          } with reason:${[
            '',
            ...errorContext.messages.map((message) => message.trim()),
          ].join('\n')}`
        );
      default:
        throw new UnreachableCaseError(errorContextType);
    }
  };

export const getTypedErrorFromEndevorCode = (
  errorMessage: string
):
  | FingerprintMismatchError
  | SignoutError
  | DuplicateElementError
  | ChangeRegressionError
  | ProcessorStepMaxRcExceededError
  | NoComponentInfoError
  | WrongCredentialsError
  | GeneralError => {
  switch (true) {
    case errorMessage.includes(FINGERPRINT_MISMATCH_ERROR):
      return new FingerprintMismatchError(errorMessage);
    case errorMessage.includes(FINGERPRINT_SIGNOUT_ERROR):
    case errorMessage.includes(NOT_SIGNOUT_ERROR):
      return new SignoutError(errorMessage);
    case errorMessage.includes(DUPLICATE_ELEMENT_ERROR):
      return new DuplicateElementError(errorMessage);
    case errorMessage.includes(CHANGE_REGRESSION_INFO):
      return new ChangeRegressionError(errorMessage);
    case errorMessage.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR):
    case errorMessage.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE):
      return new ProcessorStepMaxRcExceededError(errorMessage);
    case errorMessage.includes(NO_COMPONENT_INFO_ERROR):
      return new NoComponentInfoError(errorMessage);
    case errorMessage.includes(WRONG_CREDENTIALS_SEVERE):
      return new WrongCredentialsError(errorMessage);
    default:
      return new Error(errorMessage);
  }
};

export function getTypedErrorFromHttpCode(
  errorMessage: string
): SelfSignedCertificateError | ConnectionError {
  switch (true) {
    case errorMessage.includes(OPENSSL_ERROR_CERT_SIGNATURE):
    case errorMessage.includes(OPENSSL_ERROR_CERT_ISSUER):
    case errorMessage.includes(OPENSSL_ERROR_LOCAL_CERT_ISSUER):
    case errorMessage.includes(OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN):
    case errorMessage.includes(OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT):
      return new SelfSignedCertificateError(errorMessage);
    default:
      return new ConnectionError(errorMessage);
  }
}

type EndevorErrorContext = {
  elementName: string;
  endevorMessage: string;
};

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
