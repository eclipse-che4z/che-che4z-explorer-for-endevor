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

import { CredentialType } from '@local/endevor/_doc/Credential';
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
import { logger, reporter } from '../globals';
import { isDefined } from '../utils';
import {
  Service,
  ServiceApiVersion,
  ServiceBasePath,
  ServiceLocation,
  ServiceProtocol,
} from '@local/endevor/_doc/Endevor';
import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import { isError } from '@local/profiles/utils';
import { State } from '../_doc/Store';
import { Action, Actions } from '../_doc/Actions';
import {
  defineCredentialsResolutionOrder,
  resolveCredentials,
} from '../credentials/credentials';
import { getService as getServiceFromStore } from '../store/store';
import { getApiVersion } from '../endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { TelemetryEvents } from '../_doc/Telemetry';

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

export const getServiceLocationByServiceName = async (
  name: string
): Promise<ServiceLocation | undefined> => {
  const [serviceProfile, defaultBaseProfile] = await Promise.all([
    getServiceProfileByName(logger)(name),
    getDefaultBaseProfile(logger)(),
  ]);
  return getEndevorLocationFromProfiles(serviceProfile, defaultBaseProfile);
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
    const defaultBasePath = ServiceBasePath.V2;
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

const getEndevorApiVersion = async (
  serviceLocation: ServiceLocation,
  rejectUnauthorized: boolean
): Promise<ServiceApiVersion | undefined> => {
  const serviceApiVersion = await withNotificationProgress(
    'Fetching Endevor API version'
  )((progress) => getApiVersion(progress)(serviceLocation)(rejectUnauthorized));
  if (isError(serviceApiVersion)) {
    const error = serviceApiVersion;
    logger.error('Unable to fetch Endevor API version', `${error.message}.`);
    return;
  }
  return serviceApiVersion;
};

export const getRejectUnauthorizedByServiceName = async (
  name: string
): Promise<boolean> => {
  const [serviceProfile] = await Promise.all([
    getServiceProfileByName(logger)(name),
    // TODO: add support for the base profiles reading
    // getDefaultBaseProfile(logger)(),
  ]);
  const defaultValue = true;
  if (serviceProfile.rejectUnauthorized === undefined) {
    logger.warn(
      `There is no reject unauthorized specified in the Endevor profile, default value: ${defaultValue} will be used instead`
    );
    return defaultValue;
  }
  return serviceProfile.rejectUnauthorized;
};

export type GetService = (name: string) => Promise<Service | undefined>;
export const resolveService =
  (serviceGetter: ReadonlyArray<GetService>) =>
  async (serviceName: string): Promise<Service | undefined> => {
    for (const getService of serviceGetter) {
      const service = await getService(serviceName);
      if (service) return service;
    }
    return undefined;
  };

export const defineServiceResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetService> => {
  return [
    async (name: string) => {
      return getServiceFromStore(getState())(name);
    },
    async (name: string) => {
      const location = await getServiceLocationByServiceName(name);
      if (!location) return;
      const rejectUnauthorized = await getRejectUnauthorizedByServiceName(name);
      const apiVersion = await getEndevorApiVersion(
        location,
        rejectUnauthorized
      );
      if (!apiVersion) return;
      const credential = await resolveCredentials(
        defineCredentialsResolutionOrder()
      )(name);
      if (!credential) return;
      const service: Service = {
        location,
        credential,
        rejectUnauthorized,
        apiVersion,
      };
      await dispatch({
        type: Actions.ENDEVOR_SERVICE_CHANGED,
        serviceName: name,
        service,
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.SERVICE_PROFILE_FETCHED,
        apiVersion,
      });
      return service;
    },
  ];
};
