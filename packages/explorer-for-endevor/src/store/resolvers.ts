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

import { Credential } from '@local/endevor/_doc/Credential';
import { askForCredentialWithDefaultPasswordPolicy } from '../dialogs/credentials/endevorCredentialDialogs';
import { logger, reporter } from '../globals';
import {
  ElementsFetchingStatus,
  EndevorMapBuildingStatus,
  TelemetryEvents as V1TelemetryEvents,
} from '../_doc/Telemetry';
import {
  getService as getServiceFromStore,
  getCredential as getCredentialFromStore,
  getSearchLocation as getSearchLocationFromStore,
  getApiVersion as getApiVersionFromStore,
  getEndevorCache,
} from './store';
import {
  CachedElement,
  EndevorCacheItem,
  EndevorId,
  State,
} from './_doc/v2/Store';
import { Action, Actions } from './_doc/Actions';
import {
  ElementSearchLocation,
  Service,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import {
  withCancellableNotificationProgress,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import {
  getAllEnvironmentStages,
  getAllSubSystems,
  getAllSystems,
  searchForElements,
  getApiVersion,
} from '../endevor';
import { isDefined, isError } from '../utils';
import { EndevorMap } from '../_doc/Endevor';
import {
  isSelfSignedCertificateError,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import { toEndevorMap, toEndevorMapWithWildcards } from '../tree/endevorMap';
import { toElementCompositeKey } from './utils';
import {
  ServiceConnectionTestStatus,
  TelemetryEvents as V2TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';

export type GetCredentials = (
  serviceId: EndevorId
) => Promise<Credential | undefined>;
export const resolveCredentials =
  (credentialsGetter: ReadonlyArray<GetCredentials>) =>
  async (serviceId: EndevorId): Promise<Credential | undefined> => {
    for (const getCredentials of credentialsGetter) {
      const credentials = await getCredentials(serviceId);
      if (credentials) return credentials;
    }
    return undefined;
  };

export const defineCredentialsResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetCredentials> => {
  return [
    async (serviceId) => {
      return getCredentialFromStore(getState)(serviceId)?.value;
    },
    async (serviceId) => {
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      const credential = await askForCredentialWithDefaultPasswordPolicy();
      if (credential) {
        reporter.sendTelemetryEvent({
          type: V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
        });
        dispatch({
          type: Actions.ENDEVOR_CREDENTIAL_ADDED,
          credential: {
            value: credential,
            id: serviceId,
          },
        });
      }
      return credential;
    },
  ];
};

type GetApiVersion = (
  serviceId: EndevorId
) => Promise<ServiceApiVersion | undefined>;
const resolveServiceApiVersion =
  (apiVersionGetter: ReadonlyArray<GetApiVersion>) =>
  async (serviceId: EndevorId): Promise<ServiceApiVersion | undefined> => {
    for (const getApiVersion of apiVersionGetter) {
      const apiVersion = await getApiVersion(serviceId);
      if (apiVersion) return apiVersion;
    }
    return;
  };

export const defineApiVersionResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetApiVersion> => {
  return [
    async (serviceId) => {
      return getApiVersionFromStore(getState)(serviceId);
    },
    async (serviceId) => {
      const connection = getServiceFromStore(getState)(serviceId);
      if (!connection) return;
      const apiVersion = await withCancellableNotificationProgress(
        'Fetching Endevor API version'
      )((progress) =>
        getApiVersion(progress)(connection.value.location)(
          connection.value.rejectUnauthorized
        )
      );
      if (!apiVersion) {
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.SERVICE_CONNECTION_TEST,
          context: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.CANCELLED,
        });
        return;
      }
      if (isSelfSignedCertificateError(apiVersion)) {
        const error = apiVersion;
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.ERROR,
          errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR,
          error,
        });
        logger.error(
          'Unable to fetch Endevor API version.',
          `${error.message}.`
        );
        return;
      }
      if (isError(apiVersion)) {
        const error = apiVersion;
        reporter.sendTelemetryEvent({
          type: V2TelemetryEvents.ERROR,
          errorContext: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
          status: ServiceConnectionTestStatus.GENERIC_ERROR,
          error,
        });
        logger.error(
          'Unable to fetch Endevor API version.',
          `${error.message}.`
        );
        return;
      }
      reporter.sendTelemetryEvent({
        type: V2TelemetryEvents.SERVICE_CONNECTION_TEST,
        context: V2TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED,
        status: ServiceConnectionTestStatus.SUCCESS,
        apiVersion,
      });
      dispatch({
        type: Actions.ENDEVOR_SERVICE_API_VERSION_ADDED,
        serviceId,
        apiVersion,
      });
      return apiVersion;
    },
  ];
};

export type GetService = (serviceId: EndevorId) => Promise<Service | undefined>;
export const resolveService =
  (serviceGetter: ReadonlyArray<GetService>) =>
  async (serviceId: EndevorId): Promise<Service | undefined> => {
    for (const getService of serviceGetter) {
      const service = await getService(serviceId);
      if (service) return service;
    }
    return undefined;
  };

export const defineServiceResolutionOrder = (
  getState: () => State,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetService> => {
  return [
    async (serviceId) => {
      const connection = getServiceFromStore(getState)(serviceId);
      if (!connection) return;
      const credential = await resolveCredentials(
        defineCredentialsResolutionOrder(getState, dispatch)
      )(serviceId);
      if (!credential) return;
      const apiVersion = await resolveServiceApiVersion(
        defineApiVersionResolutionOrder(getState, dispatch)
      )(serviceId);
      if (!apiVersion) return;
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.SERVICE_PROFILE_FETCHED,
        apiVersion,
      });
      return {
        ...connection.value,
        apiVersion,
        credential,
      };
    },
  ];
};

export type GetSearchLocation = (
  serviceId: EndevorId,
  searchLocationId: EndevorId
) => Promise<ElementSearchLocation | undefined>;
export const resolveSearchLocation =
  (searchLocationGetters: ReadonlyArray<GetSearchLocation>) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<ElementSearchLocation | undefined> => {
    for (const getSearchLocation of searchLocationGetters) {
      const searchLocation = await getSearchLocation(
        serviceId,
        searchLocationId
      );
      if (searchLocation) return searchLocation;
    }
    return undefined;
  };

export const defineSearchLocationResolutionOrder = (
  getState: () => State
): ReadonlyArray<GetSearchLocation> => {
  return [
    async (_, searchLocationId) => {
      return getSearchLocationFromStore(getState)(searchLocationId);
    },
  ];
};

export type GetEndevorCache = (
  serviceId: EndevorId,
  searchLocationId: EndevorId
) => Promise<EndevorCacheItem | undefined>;
export const resolveEndevorCache =
  (elementGetters: ReadonlyArray<GetEndevorCache>) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<EndevorCacheItem | undefined> => {
    for (const getCache of elementGetters) {
      const endevorCache = await getCache(serviceId, searchLocationId);
      if (endevorCache) return endevorCache;
    }
    return undefined;
  };

export const defineEndevorCacheResolver = (
  getState: () => State,
  getService: (serviceId: EndevorId) => Promise<Service | undefined>,
  getSearchLocation: (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<ElementSearchLocation | undefined>,
  dispatch: (action: Action) => Promise<void>
): ReadonlyArray<GetEndevorCache> => {
  return [
    async (serviceId, searchLocationId) => {
      return getEndevorCache(getState)(serviceId)(searchLocationId);
    },
    async (serviceId, searchLocationId) => {
      const endevorService = await getService(serviceId);
      if (!endevorService) {
        return;
      }
      const elementsSearchLocation = await getSearchLocation(serviceId)(
        searchLocationId
      );
      if (!elementsSearchLocation) {
        return;
      }
      const endevorCachedItem = await getCacheFromEndevor(
        endevorService,
        elementsSearchLocation
      )(serviceId, searchLocationId);
      if (!endevorCachedItem) {
        return;
      }
      await dispatch({
        type: Actions.ENDEVOR_CACHE_FETCHED,
        endevorCachedItem,
        serviceId,
        searchLocationId,
      });
      return endevorCachedItem;
    },
  ];
};

const getCacheFromEndevor =
  (endevorService: Service, elementsSearchLocation: ElementSearchLocation) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<EndevorCacheItem | undefined> => {
    const tasksNumber = 4;
    const [elements, environmentStages, systems, subsystems] =
      await withNotificationProgress(
        'Fetching Endevor elements and map structure'
      )((progress) => {
        return Promise.all([
          searchForElements(toSeveralTasksProgress(progress)(tasksNumber))(
            endevorService
          )(elementsSearchLocation),
          getAllEnvironmentStages(
            toSeveralTasksProgress(progress)(tasksNumber)
          )(endevorService)(elementsSearchLocation.configuration),
          getAllSystems(toSeveralTasksProgress(progress)(tasksNumber))(
            endevorService
          )(elementsSearchLocation.configuration),
          getAllSubSystems(toSeveralTasksProgress(progress)(tasksNumber))(
            endevorService
          )(elementsSearchLocation.configuration),
        ]);
      });
    if (isError(elements)) {
      const error = elements;
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.ERROR,
        errorContext: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
        status: ElementsFetchingStatus.GENERIC_ERROR,
        error,
      });
      logger.error(
        'Unable to fetch any valid element from Endevor.',
        `${error.message}.`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: V1TelemetryEvents.ELEMENTS_WERE_FETCHED,
      elementsAmount: elements.length,
    });
    if (isError(environmentStages)) {
      const error = environmentStages;
      logger.error(
        'Unable to fetch environments information from Endevor.',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.ERROR,
        errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
        status: EndevorMapBuildingStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    if (isError(systems)) {
      const error = systems;
      logger.error(
        'Unable to fetch systems information from Endevor.',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.ERROR,
        errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
        status: EndevorMapBuildingStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    if (isError(subsystems)) {
      const error = subsystems;
      logger.error(
        'Unable to fetch subsystems information from Endevor.',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: V1TelemetryEvents.ERROR,
        errorContext: V1TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
        status: EndevorMapBuildingStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const searchEnvironment = elementsSearchLocation.environment!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const searchStage = elementsSearchLocation.stageNumber!;
    let endevorMap: EndevorMap;
    if (
      !isDefined(elementsSearchLocation.subsystem) ||
      !isDefined(elementsSearchLocation.system)
    ) {
      endevorMap = toEndevorMapWithWildcards(environmentStages)(systems)(
        subsystems
      )({
        environment: searchEnvironment,
        stageNumber: searchStage,
      });
    } else {
      endevorMap = toEndevorMap(environmentStages)(systems)(subsystems)({
        environment: searchEnvironment,
        stageNumber: searchStage,
        system: elementsSearchLocation.system,
        subSystem: elementsSearchLocation.subsystem,
      });
    }
    const lastRefreshTimestamp = Date.now();
    const cachedItem: EndevorCacheItem = {
      endevorMap,
      elements: elements.reduce(
        (acc: { [id: string]: CachedElement }, element) => {
          const newElementId =
            toElementCompositeKey(serviceId)(searchLocationId)(element);
          acc[newElementId] = {
            element,
            lastRefreshTimestamp,
          };
          return acc;
        },
        {}
      ),
    };
    return cachedItem;
  };
