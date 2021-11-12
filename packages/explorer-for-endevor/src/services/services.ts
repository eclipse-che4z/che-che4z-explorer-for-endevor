/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { CredentialType, Credential } from '@local/endevor/_doc/Credential';
import {
  createProfile,
  getDefaultBaseProfile,
  getProfilesByType,
  getServiceProfileByName,
} from '@local/profiles/profiles';
import {
  BaseProfile,
  EndevorServiceProfile,
  ProfileTypes,
} from '@local/profiles/_ext/Profile';
import { ENDEVOR_V2_BASE_PATH } from '../constants';
import { logger } from '../globals';
import { isDefined } from '../utils';
import {
  Service,
  ServiceLocation,
  ServiceProtocol,
} from '@local/endevor/_doc/Endevor';
import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import { isError } from '@local/profiles/utils';

export const createEndevorService = async (
  name: string,
  endevorService: Service
): Promise<void | Error> => {
  if (endevorService.credential.type === CredentialType.BASE) {
    const serviceProfile = {
      host: endevorService.location.hostname,
      port: endevorService.location.port,
      protocol: endevorService.location.protocol,
      basePath: endevorService.location.basePath,
      user: endevorService.credential.user,
      password: endevorService.credential.password,
      rejectUnauthorized: endevorService.rejectUnauthorized,
    };
    return createProfile(ProfileTypes.ENDEVOR)(logger)(name, serviceProfile);
  } else {
    return new Error(
      'Endevor profile with token credentials cannot be created'
    );
  }
};

export const getEndevorServiceNames = async (): Promise<string[] | Error> => {
  const endevorProfiles = await getProfilesByType(logger)(ProfileTypes.ENDEVOR);
  if (isError(endevorProfiles)) {
    const error = endevorProfiles;
    return error;
  }
  return endevorProfiles
    .map((profileResponse) => profileResponse.name)
    .filter(isDefined);
};

export const getEndevorServiceByName = async (
  name: string,
  resolveCredential: (
    credential: Credential | undefined
  ) => Promise<Credential | undefined>
): Promise<Service | undefined> => {
  const [serviceProfile, defaultBaseProfile] = await Promise.all([
    getServiceProfileByName(logger)(name),
    getDefaultBaseProfile(logger)(),
  ]);
  const location = getEndevorLocationFromProfiles(
    serviceProfile,
    defaultBaseProfile
  );
  if (!location) {
    return undefined;
  }
  const credentialFromProfile = getEndevorCredentialFromProfiles(
    serviceProfile,
    defaultBaseProfile
  );
  const credential = await resolveCredential(credentialFromProfile);
  if (!credential) {
    return undefined;
  }
  const rejectUnauthorized = getRejectUnauthorizedFromProfile(serviceProfile);
  return {
    credential,
    location,
    rejectUnauthorized,
  };
};

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

const getEndevorLocationFromProfiles = (
  serviceProfile: EndevorServiceProfile,
  defaultBaseProfile: BaseProfile
): ServiceLocation | undefined => {
  let protocol: ServiceProtocol;
  if (!serviceProfile.protocol) {
    const defaultProtocol = 'http';
    protocol = defaultProtocol;
    logger.trace(
      `There is no valid protocol in the Endevor profile, default value: ${defaultProtocol} will be used instead`
    );
  } else {
    protocol = serviceProfile.protocol;
  }
  const hostname = serviceProfile.host || defaultBaseProfile.host;
  if (!hostname) {
    logger.trace(
      `There is no hostname in the Endevor profile and default base profile, actual value: ${stringifyWithHiddenCredential(
        serviceProfile
      )}`
    );
    return undefined;
  }
  const port = serviceProfile.port || defaultBaseProfile.port;
  if (!port) {
    logger.trace(
      `There is no port in the Endevor profile and default base profile, actual value: ${stringifyWithHiddenCredential(
        serviceProfile
      )}`
    );
    return undefined;
  }
  let basePath: string;
  if (!serviceProfile.basePath) {
    const defaultBasePath = ENDEVOR_V2_BASE_PATH;
    logger.trace(
      `There is no base path in the Endevor profile, default value: ${defaultBasePath} will be used instead`
    );
    basePath = defaultBasePath;
  } else {
    basePath = serviceProfile.basePath;
  }
  return {
    protocol,
    hostname,
    port,
    basePath,
  };
};

const getRejectUnauthorizedFromProfile = (
  serviceProfile: EndevorServiceProfile
): boolean => {
  const defaultValue = true;
  if (serviceProfile.rejectUnauthorized === undefined) {
    logger.warn(
      `There is no reject unauthorized specified in the Endevor profile, default value: ${defaultValue} will be used instead`
    );
    return defaultValue;
  }
  return serviceProfile.rejectUnauthorized;
};
