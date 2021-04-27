/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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

import { SessConstants } from '@zowe/imperative';
import * as t from 'io-ts';
import { ServiceProtocol, StageNumber } from '@local/endevor/_doc/Endevor';

export enum ProfileTypes {
  BASE = 'base',
  ENDEVOR = 'endevor',
  ENDEVOR_LOCATION = 'endevor-location',
}

export type Profile = t.TypeOf<typeof Profile>;

export type BaseProfile = t.TypeOf<typeof BaseProfile>;

export type EndevorServiceProfile = t.TypeOf<typeof EndevorServiceProfile>;
export type EndevorServiceProfiles = t.TypeOf<typeof EndevorServiceProfiles>;

export type EndevorLocationProfile = t.TypeOf<typeof EndevorLocationProfile>;
export type EndevorLocationProfiles = t.TypeOf<typeof EndevorLocationProfiles>;

class TokenType extends t.Type<SessConstants.TOKEN_TYPE_CHOICES> {
  constructor() {
    super(
      'Token',
      (value): value is SessConstants.TOKEN_TYPE_CHOICES =>
        value === SessConstants.TOKEN_TYPE_APIML ||
        value === SessConstants.TOKEN_TYPE_JWT ||
        value === SessConstants.TOKEN_TYPE_LTPA,
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
