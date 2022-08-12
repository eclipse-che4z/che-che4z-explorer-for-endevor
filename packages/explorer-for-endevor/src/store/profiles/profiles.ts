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

import {
  EndevorLocationProfile,
  EndevorServiceProfile,
  ProfileNameResponse,
  ProfileNamesResponse,
  ProfileResponses,
  ProfileTypes,
} from './_ext/Profile';
import { parseToType } from '@local/type-parser/parser';
import {
  ProfileValidationError,
  ProfileWithNameNotFoundError,
  ProfileStoreAPIError,
  isProfileStoreAPIError,
  ProfileStoreError,
} from './_doc/Error';
import { isDefined } from '../../utils';
import { logger } from '../../globals';
import { ProfileStore } from './_doc/ProfileStore';
import { ZoweExplorerApi, ZoweVsCodeExtension } from '@zowe/zowe-explorer-api';
import { IProfileLoaded } from '@zowe/imperative';

export const profilesStoreFromZoweExplorer =
  (desiredProfileTypes: ReadonlyArray<ProfileTypes>) =>
  async (
    requiredApiVersion?: string
  ): Promise<ProfileStore | ProfileStoreError> => {
    try {
      const zoweExplorerApi: ZoweExplorerApi.IApiRegisterClient | undefined =
        ZoweVsCodeExtension.getZoweExplorerApi(requiredApiVersion);
      if (!zoweExplorerApi) {
        const errorDetails = requiredApiVersion
          ? ` of required version: ${requiredApiVersion} or above`
          : '';
        return new ProfileStoreError(`Missing Zowe Explorer${errorDetails}`);
      }
      const zoweExplorerExtenderApi:
        | ZoweExplorerApi.IApiExplorerExtender
        | undefined = zoweExplorerApi.getExplorerExtenderApi();
      if (!zoweExplorerExtenderApi) {
        return new ProfileStoreError(`Missing Zowe Explorer API`);
      }
      const cache = zoweExplorerExtenderApi.getProfilesCache();
      for (const profileType of desiredProfileTypes) {
        await zoweExplorerExtenderApi.initForZowe(profileType);
        cache.registerCustomProfilesType(profileType);
      }
      await zoweExplorerExtenderApi.reloadProfiles();
      return {
        getProfiles: async (profileType) => {
          let response: ReadonlyArray<IProfileLoaded> | undefined;
          try {
            response = cache.getProfiles(profileType);
          } catch (error) {
            return new ProfileStoreAPIError(error);
          }
          if (!response) {
            logger.trace(
              `Zowe Explorer API responded with no profiles of the type ${profileType}.`
            );
            return [];
          }
          try {
            return parseToType(ProfileResponses, response);
          } catch (error) {
            return new ProfileStoreAPIError(error);
          }
        },
      };
    } catch (e) {
      return new ProfileStoreError(e);
    }
  };

export const getServiceProfileNames = async (
  profileStore: ProfileStore
): Promise<ProfileNamesResponse | ProfileStoreAPIError> => {
  const response = await profileStore.getProfiles(ProfileTypes.ENDEVOR);
  if (isProfileStoreAPIError(response)) {
    const apiError = response;
    return apiError;
  }
  return response.map(({ name }) => name);
};

export const getServiceProfiles = async (
  profileStore: ProfileStore
): Promise<
  | ReadonlyArray<{
      name: ProfileNameResponse;
      profile: EndevorServiceProfile;
    }>
  | ProfileStoreAPIError
> => {
  const response = await profileStore.getProfiles(ProfileTypes.ENDEVOR);
  if (isProfileStoreAPIError(response)) {
    const apiError = response;
    return apiError;
  }
  return response
    .map((profile) => {
      try {
        return {
          name: profile.name,
          profile: parseToType(EndevorServiceProfile, profile.profile),
        };
      } catch (error) {
        logger.trace(`
          ${
            new ProfileValidationError(
              profile.name,
              ProfileTypes.ENDEVOR,
              error
            ).message
          }.`);
        return;
      }
    })
    .filter(isDefined);
};

export const getServiceProfileByName =
  (profileStore: ProfileStore) =>
  async (
    name: string
  ): Promise<
    | EndevorServiceProfile
    | ProfileWithNameNotFoundError
    | ProfileValidationError
    | ProfileStoreAPIError
  > => {
    const response = await profileStore.getProfiles(ProfileTypes.ENDEVOR);
    if (isProfileStoreAPIError(response)) {
      const apiError = response;
      return apiError;
    }
    const convertedProfileName = `${ProfileTypes.ENDEVOR}_${name}`;
    const serviceProfile = response.find(
      (profile) =>
        profile.name === name || profile.name === convertedProfileName
    );
    if (!serviceProfile) {
      return new ProfileWithNameNotFoundError(name, ProfileTypes.ENDEVOR);
    }
    try {
      const parsedProfileValue = parseToType(
        EndevorServiceProfile,
        serviceProfile.profile
      );
      return {
        protocol: parsedProfileValue.protocol,
        user: parsedProfileValue.user,
        password: parsedProfileValue.password,
        host: parsedProfileValue.host,
        port: parsedProfileValue.port,
        rejectUnauthorized: parsedProfileValue.rejectUnauthorized,
        basePath: parsedProfileValue.basePath,
      };
    } catch (error) {
      return new ProfileValidationError(
        serviceProfile.name,
        ProfileTypes.ENDEVOR,
        error
      );
    }
  };

export const getLocationProfiles = async (
  profileStore: ProfileStore
): Promise<
  | ReadonlyArray<{
      name: ProfileNameResponse;
      profile: EndevorLocationProfile;
    }>
  | ProfileStoreAPIError
> => {
  const response = await profileStore.getProfiles(
    ProfileTypes.ENDEVOR_LOCATION
  );
  if (isProfileStoreAPIError(response)) {
    const apiError = response;
    return apiError;
  }
  return response
    .map((profile) => {
      try {
        return {
          name: profile.name,
          profile: parseToType(EndevorLocationProfile, profile.profile),
        };
      } catch (error) {
        logger.trace(
          `${
            new ProfileValidationError(
              profile.name,
              ProfileTypes.ENDEVOR_LOCATION,
              error
            ).message
          }.`
        );
        return;
      }
    })
    .filter(isDefined);
};

export const getLocationProfileByName =
  (profileStore: ProfileStore) =>
  async (
    name: string
  ): Promise<
    | EndevorLocationProfile
    | ProfileWithNameNotFoundError
    | ProfileValidationError
    | ProfileStoreAPIError
  > => {
    const response = await profileStore.getProfiles(
      ProfileTypes.ENDEVOR_LOCATION
    );
    if (isProfileStoreAPIError(response)) {
      const apiError = response;
      return apiError;
    }
    const convertedProfileName = `${ProfileTypes.ENDEVOR_LOCATION}_${name}`;
    const locationProfile = response.find(
      (profile) =>
        profile.name === name || profile.name === convertedProfileName
    );
    if (!locationProfile) {
      return new ProfileWithNameNotFoundError(
        name,
        ProfileTypes.ENDEVOR_LOCATION
      );
    }
    try {
      const parsedProfileValue = parseToType(
        EndevorLocationProfile,
        locationProfile.profile
      );
      return {
        instance: parsedProfileValue.instance,
        environment: parsedProfileValue.environment,
        stageNumber: parsedProfileValue.stageNumber,
        system: parsedProfileValue.system,
        subsystem: parsedProfileValue.subsystem,
        type: parsedProfileValue.type,
        ccid: parsedProfileValue.ccid,
        comment: parsedProfileValue.comment,
      };
    } catch (error) {
      return new ProfileValidationError(
        locationProfile.name,
        ProfileTypes.ENDEVOR_LOCATION,
        error
      );
    }
  };
