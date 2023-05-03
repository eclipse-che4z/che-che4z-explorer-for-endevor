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

import {
  DUPLICATE_ELEMENT_ERROR,
  FINGERPRINT_MISMATCH_ERROR,
  FINGERPRINT_SIGNOUT_ERROR,
  HTTP_STATUS_UNAUTHORIZED,
  NOT_SIGNOUT_ERROR,
  NO_COMPONENT_INFO_ERROR,
  OPENSSL_ERROR_CERT_ISSUER,
  OPENSSL_ERROR_CERT_SIGNATURE,
  OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT,
  OPENSSL_ERROR_LOCAL_CERT_ISSUER,
  OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN,
  PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR,
  PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE,
  WRONG_CREDENTIALS_SEVERE,
} from './const';
import { ErrorResponseType } from './_doc/Endevor';

const getConnectionErrorType = (
  code: string
):
  | ErrorResponseType.CERT_VALIDATION_ERROR
  | ErrorResponseType.CONNECTION_ERROR => {
  const cleanedCode = code.trim();
  switch (cleanedCode) {
    case OPENSSL_ERROR_CERT_SIGNATURE:
    case OPENSSL_ERROR_CERT_ISSUER:
    case OPENSSL_ERROR_LOCAL_CERT_ISSUER:
    case OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN:
    case OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT:
      return ErrorResponseType.CERT_VALIDATION_ERROR;
    default:
      return ErrorResponseType.CONNECTION_ERROR;
  }
};

export const getEndevorClientErrorResponseType = (error: {
  details?: {
    causeErrors?: {
      code: string;
    };
    httpStatus?: number;
  };
}):
  | ErrorResponseType.CERT_VALIDATION_ERROR
  | ErrorResponseType.CONNECTION_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  // then, check if there are some connection errors
  if (error.details?.causeErrors?.code) {
    return getConnectionErrorType(error.details.causeErrors.code);
  }
  return ErrorResponseType.GENERIC_ERROR;
};

export const getAuthorizedEndevorClientErrorResponseType = (error: {
  details?: {
    causeErrors?: {
      code: string;
    };
    httpStatus?: number;
  };
}):
  | ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
  | ErrorResponseType.CERT_VALIDATION_ERROR
  | ErrorResponseType.CONNECTION_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  // first, check if there is an unauthorized response error
  if (error.details?.httpStatus === HTTP_STATUS_UNAUTHORIZED) {
    return ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR;
  }
  return getEndevorClientErrorResponseType(error);
};

export const getGenericAuthorizedEndevorErrorResponseType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(WRONG_CREDENTIALS_SEVERE):
      return ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR;
    default:
      return ErrorResponseType.GENERIC_ERROR;
  }
};

export const getGenerateErrorType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR
  | ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
  | ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR):
    case errorMessagesString.includes(PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE):
      return ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR;
    case errorMessagesString.includes(FINGERPRINT_SIGNOUT_ERROR):
    case errorMessagesString.includes(NOT_SIGNOUT_ERROR):
      return ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR;
    default:
      return getGenericAuthorizedEndevorErrorResponseType(messages);
  }
};

export const getRetrieveElementWithSignOutElementErrorType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
  | ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(FINGERPRINT_SIGNOUT_ERROR):
    case errorMessagesString.includes(NOT_SIGNOUT_ERROR):
      return ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR;
    default:
      return getGenericAuthorizedEndevorErrorResponseType(messages);
  }
};

export const getUpdateElementErrorType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR
  | ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
  | ErrorResponseType.GENERIC_ERROR
  | ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(FINGERPRINT_SIGNOUT_ERROR):
    case errorMessagesString.includes(NOT_SIGNOUT_ERROR):
      return ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR;
    case errorMessagesString.includes(WRONG_CREDENTIALS_SEVERE):
      return ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR;
    case errorMessagesString.includes(FINGERPRINT_MISMATCH_ERROR):
      return ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR;
    default:
      return getGenericAuthorizedEndevorErrorResponseType(messages);
  }
};

export const getAddElementErrorType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.DUPLICATE_ELEMENT_ENDEVOR_ERROR
  | ErrorResponseType.CONNECTION_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(DUPLICATE_ELEMENT_ERROR):
      return ErrorResponseType.DUPLICATE_ELEMENT_ENDEVOR_ERROR;

    default:
      return ErrorResponseType.GENERIC_ERROR;
  }
};

export const getPrintElementErrorType = (
  messages: ReadonlyArray<string>
):
  | ErrorResponseType.NO_COMPONENT_INFO_ENDEVOR_ERROR
  | ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
  | ErrorResponseType.GENERIC_ERROR => {
  const errorMessagesString = messages.join(' ');
  switch (true) {
    case errorMessagesString.includes(NO_COMPONENT_INFO_ERROR):
      return ErrorResponseType.NO_COMPONENT_INFO_ENDEVOR_ERROR;
    default:
      return getGenericAuthorizedEndevorErrorResponseType(messages);
  }
};
