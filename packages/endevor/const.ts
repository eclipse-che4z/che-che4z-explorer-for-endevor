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

export const ANY_VALUE = '*';

export const MS_IN_MIN = 60000;
export const TEN_SEC_IN_MS = 10000;

export const FINGERPRINT_MISMATCH_ERROR = 'C1G0410E';
export const FINGERPRINT_SIGNOUT_ERROR = 'C1G0167E';
export const NOT_SIGNOUT_ERROR = 'C1G0168E';
export const DUPLICATE_ELEMENT_ERROR = 'C1G0024E';

export const PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR = 'C1G0129E';
export const PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE = 'C1G0129S';

export const NO_COMPONENT_INFO_ERROR = 'C1C0004E';

export const WRONG_CREDENTIALS_SEVERE = 'API0034S';

// HTTP connection error codes group
export const OPENSSL_ERROR_CERT_SIGNATURE = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
export const OPENSSL_ERROR_CERT_ISSUER = 'UNABLE_TO_GET_ISSUER_CERT';
export const OPENSSL_ERROR_LOCAL_CERT_ISSUER =
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY';
export const OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN =
  'SELF_SIGNED_CERT_IN_CHAIN';
export const OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT =
  'DEPTH_ZERO_SELF_SIGNED_CERT';

// HTTP status codes
export const HTTP_STATUS_UNAUTHORIZED = 401;
