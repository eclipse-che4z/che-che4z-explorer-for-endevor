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

export const ANY_VALUE = '*';

export const FINGERPRINT_MISMATCH_ERROR = 'C1G0410E';
export const FINGERPRINT_SIGNOUT_ERROR = 'C1G0167E';
export const NOT_SIGNOUT_ERROR = 'C1G0168E';
export const DUPLICATE_ELEMENT_ERROR = 'C1G0024E';

// it is an informational message according to:
// https://techdocs.broadcom.com/us/en/ca-mainframe-software/devops/ca-endevor-scm-messages/1-0/smgr-messages/smgr123c.html
export const CHANGE_REGRESSION_INFO = 'SMGR123C';

export const PROCESSOR_STEP_MAX_RC_EXCEEDED_ERROR = 'C1G0129E';
export const PROCESSOR_STEP_MAX_RC_EXCEEDED_SEVERE = 'C1G0129S';

// HTTP connection error codes group
export const OPENSSL_ERROR_CERT_SIGNATURE = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
export const OPENSSL_ERROR_CERT_ISSUER = 'UNABLE_TO_GET_ISSUER_CERT';
export const OPENSSL_ERROR_LOCAL_CERT_ISSUER =
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY';
export const OPENSSL_ERROR_SELF_SIGNED_CERT_IN_CHAIN =
  'SELF_SIGNED_CERT_IN_CHAIN';
export const OPENSSL_ERROR_DEPTH_ZERO_SELF_SIGNED_CERT =
  'DEPTH_ZERO_SELF_SIGNED_CERT';
