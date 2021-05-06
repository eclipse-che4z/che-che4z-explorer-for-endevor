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

import { CliProfileManager, IProfileLoaded } from '@zowe/imperative';
import {
  BaseProfile,
  EndevorLocationProfile,
  EndevorServiceProfile,
  Profile,
  ProfileTypes,
} from './_ext/Profile';

import {
  stringifyWithHiddenCredential,
  replaceEmptyStringsIntoUndefined,
  isError,
} from './utils';
import { parseToType } from '@local/type-parser/parser';
import { getProfilesDir } from './globals';
import { Logger } from '@local/extension/_doc/Logger';

const getProfileManagerFromDir = (logger: Logger) => (
  profileRootDirectory: string
) => (profileType: ProfileTypes | string): CliProfileManager | Error => {
  logger.trace(`Profiles will be read from: ${profileRootDirectory}`);
  try {
    const profileManager = new CliProfileManager({
      profileRootDirectory,
      type: profileType,
    });
    logger.trace(`Profile Manager created - ${profileType.toUpperCase()}`);
    return profileManager;
  } catch (error) {
    logger.trace(
      `Failed to create profile manager because of: ${error.message} with stack: ${error.stack}`
    );
    return new Error(
      `Failed to create Profile Manager - ${profileType.toUpperCase()}`
    );
  }
};
const getProfileManager = (logger: Logger) =>
  getProfileManagerFromDir(logger)(getProfilesDir(logger));

const emptyBaseProfile: BaseProfile = {};

export const getDefaultBaseProfile = (
  logger: Logger
) => async (): Promise<BaseProfile> => {
  const profileManager = getProfileManager(logger)(ProfileTypes.BASE);
  if (isError(profileManager)) {
    const error = profileManager;
    logger.trace(error.message);
    return emptyBaseProfile;
  }
  let baseProfile;
  try {
    baseProfile = (await profileManager.load({ loadDefault: true })).profile;
  } catch (error) {
    logger.trace(`There is no default base profile`);
    return emptyBaseProfile;
  }
  try {
    return parseToType(BaseProfile, baseProfile);
  } catch (error) {
    logger.trace(
      `Default base profile validation error: ${error}, actual value: ${stringifyWithHiddenCredential(
        baseProfile
      )}`
    );
    return emptyBaseProfile;
  }
};

interface createProfile {
  (type: ProfileTypes.ENDEVOR): (
    logger: Logger
  ) => (name: string, profile: EndevorServiceProfile) => Promise<void | Error>;
  (type: ProfileTypes.ENDEVOR_LOCATION): (
    logger: Logger
  ) => (name: string, profile: EndevorLocationProfile) => Promise<void | Error>;
}
export const createProfile: createProfile = (type: ProfileTypes) => (
  logger: Logger
) => async (name: string, profile: Profile): Promise<void | Error> => {
  const profileManager = getProfileManager(logger)(type);
  if (isError(profileManager)) {
    const error = profileManager;
    return error;
  }
  try {
    await profileManager.save({
      name,
      profile: replaceEmptyStringsIntoUndefined(profile),
      type,
    });
    logger.trace(`Profile with name: ${name} and type: ${type} was created`);
  } catch (error) {
    logger.error(
      `Something went wrong with profile: ${name} creation`,
      `Profile manager response for saving profile ${name} is: ${error}`
    );
    return;
  }
};

const emptyServiceProfile: EndevorServiceProfile = {};

export const getServiceProfileByName = (logger: Logger) => async (
  name: string
): Promise<EndevorServiceProfile> => {
  const profileManager = getProfileManager(logger)(ProfileTypes.ENDEVOR);
  if (isError(profileManager)) {
    const error = profileManager;
    logger.error(error.message);
    return emptyServiceProfile;
  }
  let serviceProfile;
  try {
    serviceProfile = (await profileManager.load({ name })).profile;
  } catch (error) {
    logger.error(
      `There is no such endevor profile with name: ${name}`,
      `Profile manager response for fetching endevor profile with name: ${name} is: ${error}`
    );
    return emptyServiceProfile;
  }
  try {
    return parseToType(EndevorServiceProfile, serviceProfile);
  } catch (error) {
    logger.error(
      `Endevor profile with name: ${name} is invalid and cannot be used`,
      `Endevor profile validation error: ${error}, actual value: ${stringifyWithHiddenCredential(
        serviceProfile
      )}`
    );
    return emptyServiceProfile;
  }
};

export const getProfilesByType = (logger: Logger) => async (
  type: ProfileTypes | string
): Promise<IProfileLoaded[] | Error> => {
  const profileManager = getProfileManager(logger)(type);
  if (isError(profileManager)) {
    const error = profileManager;
    return error;
  }
  try {
    return profileManager.loadAll({
      typeOnly: true,
    });
  } catch (error) {
    logger.trace(
      `Profile manager response for fetching profiles with type: ${type} is: ${error}`
    );
    return new Error(
      `Something went wrong with profiles with type: ${type} fetching`
    );
  }
};

const emptyLocationProfile: EndevorLocationProfile = {};

export const getLocationProfileByName = (logger: Logger) => async (
  name: string
): Promise<EndevorLocationProfile> => {
  const profileManager = getProfileManager(logger)(
    ProfileTypes.ENDEVOR_LOCATION
  );
  if (isError(profileManager)) {
    const error = profileManager;
    logger.error(error.message);
    return emptyLocationProfile;
  }
  let locationProfile;
  try {
    locationProfile = (await profileManager.load({ name })).profile;
  } catch (error) {
    logger.error(
      `There is no such profile with name: ${name}`,
      `Profile manager response for fetching location profile with name: ${name} is: ${error}`
    );
    return emptyLocationProfile;
  }
  try {
    return parseToType(EndevorLocationProfile, locationProfile);
  } catch (error) {
    logger.error(
      `Location profile with name: ${name} is invalid and cannot be used`,
      `Location profile validation error: ${error}, actual value: ${stringifyWithHiddenCredential(
        locationProfile
      )}`
    );
    return emptyLocationProfile;
  }
};
