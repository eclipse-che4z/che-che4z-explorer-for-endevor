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

// our own enum for authentication types not to expose imperative types
export const enum AuthType {
  // SessConstants.AUTH_TYPE_NONE
  NONE = 'none',
  // SessConstants.AUTH_TYPE_BASIC
  BASIC = 'basic',
  // SessConstants.AUTH_TYPE_BEARER
  BEARER = 'bearer',
  // SessConstants.AUTH_TYPE_TOKEN
  COOKIE = 'token',
  // SessConstants.AUTH_TYPE_CERT_PEM
  CERT = 'cert-pem',
}
