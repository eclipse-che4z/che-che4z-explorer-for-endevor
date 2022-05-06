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

import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import {
  getDefaultBaseProfile,
  getServiceProfileByName,
} from '@local/profiles/profiles';
import {
  BaseProfile,
  EndevorServiceProfile,
} from '@local/profiles/_ext/Profile';
import { askForCredentialWithDefaultPasswordPolicy } from '../dialogs/credentials/endevorCredentialDialogs';
import { logger, reporter } from '../globals';
import { TelemetryEvents } from '../_doc/Telemetry';

const getEndevorCredentialFromProfiles = (
  serviceProfile: EndevorServiceProfile,
  baseProfile: BaseProfile
): Credential | undefined => {
  const user = serviceProfile.user || baseProfile.user;
  const password = serviceProfile.password || baseProfile.password;
  if (user && password) {
    return {
      type: CredentialType.BASE,
      user,
      password,
    };
  }
  const tokenType = baseProfile.tokenType;
  const tokenValue = baseProfile.tokenValue;
  if (tokenType && tokenValue) {
    logger.error('Tokens from default base profile are not supported');
    return undefined;
  }
  return undefined;
};

export const getCredentialsByServiceName = async (
  serviceName: string
): Promise<Credential | undefined> => {
  const [serviceProfile, defaultBaseProfile] = await Promise.all([
    getServiceProfileByName(logger)(serviceName),
    getDefaultBaseProfile(logger)(),
  ]);
  return getEndevorCredentialFromProfiles(serviceProfile, defaultBaseProfile);
};

export type GetCredentials = (name: string) => Promise<Credential | undefined>;
export const resolveCredentials =
  (credsGetter: ReadonlyArray<GetCredentials>) =>
  async (serviceName: string): Promise<Credential | undefined> => {
    for (const getCredentials of credsGetter) {
      const credentials = await getCredentials(serviceName);
      if (credentials) return credentials;
    }
    return undefined;
  };

export const defineCredentialsResolutionOrder = () => {
  return [
    async (serviceName: string) => {
      return getCredentialsByServiceName(serviceName);
    },
    async (_: string) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      const credential = await askForCredentialWithDefaultPasswordPolicy();
      if (credential) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
        });
      }
      return credential;
    },
  ];
};
