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
  getEndevorLocationProfiles,
  getEndevorProfileByName,
  getEndevorProfiles,
} from '@local/profiles/profiles';
import { logger } from '../../globals';
import { isDefined, isError } from '../../utils';
import {
  ServiceBasePath,
  ServiceLocation,
  StageNumber,
} from '@local/endevor/_doc/Endevor';
import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import { isProfileWithNameNotFoundError } from '@local/profiles/_doc/Error';
import { ProfileStore } from '@local/profiles/_doc/ProfileStore';
import {
  EndevorLocationProfile,
  EndevorServiceProfile,
} from '@local/profiles/_ext/Profile';
import {
  Id,
  Source,
  Connections,
  Credential,
  InventoryLocations,
} from './_doc/Storage';
import {
  Credential as EndevorCredential,
  CredentialType,
} from '@local/endevor/_doc/Credential';
import { ANY_VALUE } from '@local/endevor/const';
import { toCompositeKey } from './utils';

export const parseServiceProfileForLocation = ({
  name: serviceName,
  profile: serviceProfile,
}: Readonly<{
  name: string;
  profile: EndevorServiceProfile;
}>): ServiceLocation | undefined => {
  if (!serviceProfile.host || !serviceProfile.port) {
    logger.error(
      `Endevor host value is missing for the service profile ${serviceName}, actual value is ${stringifyWithHiddenCredential(
        serviceProfile
      )}.`
    );
    return;
  }
  const defaultProtocol = 'https';
  if (!serviceProfile.protocol) {
    logger.warn(
      `Endevor protocol is missing for the service profile ${serviceName}, default value ${defaultProtocol} will be used instead.`
    );
  }
  const defaultBasePath = ServiceBasePath.V2;
  if (!serviceProfile.basePath) {
    logger.warn(
      `Endevor base path is missing for the service profile ${serviceName}, default value ${defaultBasePath} will be used instead.`
    );
  }
  return {
    hostname: serviceProfile.host,
    protocol: serviceProfile.protocol || defaultProtocol,
    basePath: serviceProfile.basePath || defaultBasePath,
    port: serviceProfile.port,
  };
};

const parseServiceProfileForRejectUnauthorized = ({
  name: serviceName,
  profile: serviceProfile,
}: Readonly<{ name: string; profile: EndevorServiceProfile }>): boolean => {
  const defaultValue = true;
  if (serviceProfile.rejectUnauthorized === undefined) {
    logger.warn(
      `RejectUnauthorized param is missing for the service profile ${serviceName}, default value ${defaultValue} will be used instead.`
    );
    return defaultValue;
  }
  return serviceProfile.rejectUnauthorized;
};

const parseServiceProfileForCredentials = ({
  name: serviceName,
  profile: serviceProfile,
}: Readonly<{
  name: string;
  profile: EndevorServiceProfile;
}>): EndevorCredential | undefined => {
  const user = serviceProfile.user;
  const password = serviceProfile.password;
  if (user && password) {
    return {
      type: CredentialType.BASE,
      user,
      password,
    };
  }
  logger.trace(
    `Service credentials is missing for the profile ${serviceName}, actual value is ${stringifyWithHiddenCredential(
      serviceProfile
    )}.`
  );
  return;
};

export const getConnections = async (
  profilesStore: ProfileStore
): Promise<Connections | Error> => {
  const serviceProfiles = await getEndevorProfiles(logger)(profilesStore);
  if (isError(serviceProfiles)) {
    const error = serviceProfiles;
    return error;
  }
  return serviceProfiles.reduce((acc: Connections, serviceProfile) => {
    const location = parseServiceProfileForLocation(serviceProfile);
    if (!location) return acc;
    const unsecureConnection = location.protocol === 'http';
    const rejectUnauthorized = unsecureConnection
      ? false
      : parseServiceProfileForRejectUnauthorized(serviceProfile);
    const id: Id = {
      name: serviceProfile.name,
      source: Source.SYNCHRONIZED,
    };
    acc[toCompositeKey(id)] = {
      value: {
        location,
        rejectUnauthorized,
      },
      id,
    };
    return acc;
  }, {});
};

export const getCredential =
  (profilesStore: ProfileStore) =>
  async (serviceName: string): Promise<Credential | Error | undefined> => {
    const serviceProfile = await getEndevorProfileByName(profilesStore)(
      serviceName
    );
    if (isProfileWithNameNotFoundError(serviceProfile)) {
      const error = serviceProfile;
      return error;
    }
    if (isError(serviceProfile)) {
      const error = serviceProfile;
      return error;
    }
    const credential = parseServiceProfileForCredentials({
      name: serviceName,
      profile: serviceProfile,
    });
    if (!credential) return;
    return {
      value: credential,
      id: {
        name: serviceName,
        source: Source.SYNCHRONIZED,
      },
    };
  };

const profileIsCorrect = (
  value: EndevorLocationProfile
): value is {
  instance: string;
  stageNumber: StageNumber;
  environment: string;
  system: string | undefined;
  subsystem: string | undefined;
  type: string | undefined;
  ccid: string | undefined;
  comment: string | undefined;
} => {
  return (
    isDefined(value.instance) &&
    value.instance !== ANY_VALUE &&
    isDefined(value.stageNumber) &&
    (value.stageNumber === '1' || value.stageNumber === '2') &&
    isDefined(value.environment) &&
    value.environment !== ANY_VALUE
  );
};

export const getInventoryLocations = async (
  profilesStore: ProfileStore
): Promise<InventoryLocations | Error> => {
  const locationProfiles = await getEndevorLocationProfiles(logger)(
    profilesStore
  );
  if (isError(locationProfiles)) {
    const error = locationProfiles;
    return error;
  }
  return locationProfiles
    .map(({ name, profile }) => {
      if (profileIsCorrect(profile)) return { name, profile };
      logger.trace(
        `Inventory location instance or environment or stage number is missing for the profile ${name}, actual value is ${stringifyWithHiddenCredential(
          profile
        )}.`
      );
      return undefined;
    })
    .filter(isDefined)
    .reduce((acc: InventoryLocations, { name, profile: locationProfile }) => {
      const id: Id = {
        name,
        source: Source.SYNCHRONIZED,
      };
      acc[toCompositeKey(id)] = {
        value: {
          configuration: locationProfile.instance,
          environment: locationProfile.environment.toUpperCase(),
          stageNumber: locationProfile.stageNumber,
          system: locationProfile.system
            ? locationProfile.system !== ANY_VALUE
              ? locationProfile.system.toUpperCase()
              : undefined
            : undefined,
          subsystem: locationProfile.subsystem
            ? locationProfile.subsystem !== ANY_VALUE
              ? locationProfile.subsystem.toUpperCase()
              : undefined
            : undefined,
          type: locationProfile.type
            ? locationProfile.type !== ANY_VALUE
              ? locationProfile.type.toUpperCase()
              : undefined
            : undefined,
          ccid: locationProfile.ccid,
          comment: locationProfile.comment,
        },
        id: {
          name,
          source: Source.SYNCHRONIZED,
        },
      };
      return acc;
    }, {});
};
