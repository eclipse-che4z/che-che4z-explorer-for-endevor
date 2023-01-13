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

import * as t from 'io-ts';

export enum ProfileTypes {
  BASE = 'base',
  ENDEVOR = 'endevor',
  ENDEVOR_LOCATION = 'endevor-location',
  BRIDGE_FOR_GIT = 'ebg',
}

export type ServiceProtocol = 'http' | 'https';

export type ProfileTokenType =
  | 'LtpaToken2'
  | 'jwtToken'
  | 'apimlAuthenticationToken';

export type StageNumber = '1' | '2';

export type Profile = t.TypeOf<typeof Profile>;

export type BaseProfile = t.TypeOf<typeof BaseProfile>;

export type EndevorServiceProfile = t.TypeOf<typeof EndevorServiceProfile>;
export type EndevorServiceProfiles = t.TypeOf<typeof EndevorServiceProfiles>;

export type EndevorLocationProfiles = t.TypeOf<typeof EndevorLocationProfiles>;
export type ProfileResponse = t.TypeOf<typeof ProfileResponse>;
export type ProfileResponses = t.TypeOf<typeof ProfileResponses>;
export type ProfileNameResponse = t.TypeOf<typeof ProfileNameResponse>;
export type ProfileNamesResponse = t.TypeOf<typeof ProfileNamesResponse>;

export const ProfileResponse = t.type({
  name: t.string,
  profile: t.unknown,
});
export const ProfileResponses = t.array(ProfileResponse);
export const ProfileNameResponse = t.string;
export const ProfileNamesResponse = t.array(t.string);

export type EndevorLocationProfile = t.TypeOf<typeof EndevorLocationProfile>;
export type BfgProfile = t.TypeOf<typeof BfgProfile>;

export const BfgProfile = t.partial({
  host: t.string,
  port: t.number,
  user: t.string,
  token: t.string,
  rejectUnauthorized: t.boolean,
});

class TokenType extends t.Type<ProfileTokenType> {
  constructor() {
    super(
      'TokenType',
      (value): value is ProfileTokenType =>
        value === 'LtpaToken2' ||
        value === 'jwtToken' ||
        value === 'apimlAuthenticationToken',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

export const BaseProfile = t.partial({
  host: t.string,
  port: t.number,
  user: t.string,
  password: t.string,
  tokenValue: t.string,
  tokenType: new TokenType(),
});

class EndevorServiceProtocolType extends t.Type<ServiceProtocol> {
  constructor() {
    super(
      'ServiceProtocol',
      (value): value is ServiceProtocol =>
        value === 'http' || value === 'https',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

export const EndevorServiceProfile = t.partial({
  user: t.string,
  password: t.string,
  protocol: new EndevorServiceProtocolType(),
  host: t.string,
  port: t.number,
  basePath: t.string,
  rejectUnauthorized: t.boolean,
});
export const EndevorServiceProfiles = t.array(EndevorServiceProfile);
class EndevorStageNumberType extends t.Type<StageNumber> {
  constructor() {
    super(
      'StageNumber',
      (value): value is StageNumber => value === '1' || value === '2',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

export const EndevorLocationProfile = t.partial({
  instance: t.string,
  environment: t.string,
  stageNumber: new EndevorStageNumberType(),
  system: t.string,
  subsystem: t.string,
  type: t.string,
  ccid: t.string,
  comment: t.string,
});
export const EndevorLocationProfiles = t.array(EndevorLocationProfile);

export const Profile = t.union([EndevorServiceProfile, EndevorLocationProfile]);
