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

export enum CredentialType {
  BASE = 'base-credential',
  TOKEN = 'token-credential',
}

// our own enum for token types not to expose imperative types
export enum CredentialTokenType {
  // SessConstants.TOKEN_TYPE_LTPA
  LTPA = 'LtpaToken2',
  // SessConstants.TOKEN_TYPE_JWT
  JWT = 'jwtToken',
  // SessConstants.TOKEN_TYPE_APIML
  APIML = 'apimlAuthenticationToken',
}

export interface BaseCredential {
  type: CredentialType.BASE;
  readonly user: string;
  readonly password: string;
}

export interface TokenCredential {
  type: CredentialType.TOKEN;
  readonly tokenType: CredentialTokenType;
  readonly tokenValue: string;
}

export type Credential = BaseCredential | TokenCredential;
