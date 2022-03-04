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

import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
import {
  createProfile,
  getLocationProfileByName,
  getProfilesByType,
} from '@local/profiles/profiles';
import { isDefined, isError } from '@local/profiles/utils';
import {
  EndevorLocationProfile,
  ProfileTypes,
} from '@local/profiles/_ext/Profile';
import { logger } from '../globals';
import { parseToType } from '@local/type-parser/parser';
import { ANY_VALUE } from '@local/endevor/const';

export const createEndevorElementLocation = (
  name: string,
  elementLocation: ElementSearchLocation
): Promise<void | Error> => {
  return createProfile(ProfileTypes.ENDEVOR_LOCATION)(logger)(
    name,
    elementLocation
  );
};

export const getElementLocationNames = async (): Promise<string[] | Error> => {
  const locationProfiles = await getProfilesByType(logger)(
    ProfileTypes.ENDEVOR_LOCATION
  );
  if (isError(locationProfiles)) {
    const error = locationProfiles;
    return error;
  }
  return locationProfiles
    .map(({ name, profile }) => {
      try {
        return {
          name,
          profile: parseToType(EndevorLocationProfile, profile),
        };
      } catch (e) {
        logger.trace(
          `Location profile validation error: ${
            e.message
          }, actual value: ${JSON.stringify(profile)}`
        );
        return undefined;
      }
    })
    .filter(isDefined)
    .filter(({ profile, name }) => {
      if (profileIsCorrect(profile)) return true;
      logger.trace(
        `Element location with name ${name} not specified correctly, actual value: ${JSON.stringify(
          profile
        )}`
      );
      return false;
    })
    .map(({ name }) => name)
    .filter(isDefined);
};

const profileIsCorrect = (value: EndevorLocationProfile): boolean => {
  return (
    isDefined(value.instance) &&
    value.instance !== ANY_VALUE &&
    isDefined(value.stageNumber) &&
    (value.stageNumber === '1' || value.stageNumber === '2') &&
    isDefined(value.environment) &&
    value.environment !== ANY_VALUE
  );
};

export const getElementLocationByName = async (
  name: string
): Promise<ElementSearchLocation | undefined> => {
  const locationProfile = await getLocationProfileByName(logger)(name);
  if (profileIsCorrect(locationProfile) && locationProfile.instance) {
    return {
      instance: locationProfile.instance,
      environment: locationProfile.environment,
      stageNumber: locationProfile.stageNumber,
      system: locationProfile.system,
      subsystem: locationProfile.subsystem,
      type: locationProfile.type,
      ccid: locationProfile.ccid,
      comment: locationProfile.comment,
    };
  }
  logger.trace(
    `Element location with name ${name} not specified correctly, actual value: ${JSON.stringify(
      locationProfile
    )}`
  );
  return undefined;
};
