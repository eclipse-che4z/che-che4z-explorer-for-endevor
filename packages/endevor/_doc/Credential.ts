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

export const enum CredentialType {
  BASE = 'base-credential',
  TOKEN_BEARER = 'token-bearer-credential',
  TOKEN_COOKIE = 'token-cookie-credential',
  // another authentication possibilities for the future
  // BASE64 = 'base64-credential',
  // CERT = 'certificate-credential',
}

export type BaseCredential = Readonly<{
  type: CredentialType.BASE;
  user: string;
  password: string;
}>;

type TokenValidityParams = Readonly<{
  tokenCreatedMs: number;
  tokenValidForMs: number;
}>;

export type BearerTokenCredential = Readonly<{
  type: CredentialType.TOKEN_BEARER;
  tokenType: CredentialTokenType;
  tokenValue: string;
}> &
  Partial<TokenValidityParams>;

// our own enum for token types not to expose imperative types
export const enum CredentialTokenType {
  // SessConstants.TOKEN_TYPE_LTPA
  LTPA = 'LtpaToken2',
  // SessConstants.TOKEN_TYPE_JWT
  JWT = 'jwtToken',
  // SessConstants.TOKEN_TYPE_APIML
  APIML = 'apimlAuthenticationToken',
}

export type CookieTokenCredential = Readonly<{
  type: CredentialType.TOKEN_COOKIE;
  tokenType: CredentialTokenType;
  tokenValue: string;
}> &
  Partial<TokenValidityParams>;

export type TokenCredential = BearerTokenCredential | CookieTokenCredential;

export type Credential = BaseCredential | TokenCredential;
