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

import { ANY_VALUE } from '@local/endevor/const';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { toEndevorStageNumber } from '@local/endevor/utils';
import { ElementMapPath, SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import { DEFAULT_TREE_IN_PLACE_SEARCH_MODE } from '../constants';
import { isDefined } from '../utils';
import { ElementSearchLocation, SubsystemMapPathId } from '../_doc/Endevor';
import { toCompositeKey as toStorageCompositeKey } from './storage/utils';
import { ConnectionLocations, Id, Source } from './storage/_doc/Storage';
import {
  CachedElement,
  ElementCcidsFilter,
  ElementFilter,
  ElementFilterType,
  ElementNamesFilter,
  ElementsUpTheMapFilter,
  ElementTypesFilter,
  EndevorConnectionStatus,
  EndevorCredentialStatus,
  EndevorId,
  EndevorSearchLocation,
  EndevorSearchLocationStatus,
  EndevorService,
  EndevorServices,
  EndevorServiceStatus,
  ExistingEndevorServiceDescription,
  InvalidEndevorSearchLocationDescription,
  NonExistingServiceDescription,
  ServiceLocationFilters,
  State,
  ValidEndevorSearchLocationDescription,
} from './_doc/v2/Store';

export const toServiceLocationCompositeKey =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): string => {
    return `${toStorageCompositeKey(serviceId)}/${toStorageCompositeKey(
      searchLocationId
    )}`;
  };

export const toElementCompositeKey =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: ElementMapPath): string => {
    return `${toServiceLocationCompositeKey(serviceId)(searchLocationId)}/${
      element.environment
    }/${element.stageNumber}/${element.system}/${element.subSystem}/${
      element.type
    }/${element.id}`;
  };

export const normalizeSearchLocation = (
  searchLocation: ElementSearchLocation
): ElementSearchLocation => {
  return {
    configuration: searchLocation.configuration,
    environment: searchLocation.environment?.toUpperCase(),
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system
      ? searchLocation.system !== ANY_VALUE
        ? searchLocation.system.toUpperCase()
        : undefined
      : undefined,
    subsystem: searchLocation.subsystem
      ? searchLocation.subsystem !== ANY_VALUE
        ? searchLocation.subsystem.toUpperCase()
        : undefined
      : undefined,
    type: searchLocation.type
      ? searchLocation.type !== ANY_VALUE
        ? searchLocation.type.toUpperCase()
        : undefined
      : undefined,
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  };
};

export const toSubsystemMapPathId = ({
  environment,
  stageNumber,
  system,
  subSystem,
}: SubSystemMapPath): SubsystemMapPathId => {
  return `${environment}/${stageNumber}/${system}/${subSystem}`;
};

export const fromSubsystemMapPathId = (
  subsystemMapPathId: SubsystemMapPathId
): SubSystemMapPath | undefined => {
  const [environment, stageNumber, system, subSystem] =
    subsystemMapPathId.split('/');
  if (!environment || !stageNumber || !system || !subSystem) {
    return;
  }
  const stageNumberValue = toEndevorStageNumber(stageNumber);
  if (!stageNumberValue) return;
  return {
    environment,
    system,
    subSystem,
    stageNumber: stageNumberValue,
  };
};

export const isElementsNameFilter = (
  filter: ElementFilter
): filter is ElementNamesFilter => {
  return filter.type === ElementFilterType.ELEMENT_NAMES_FILTER;
};

export const isElementsTypeFilter = (
  filter: ElementFilter
): filter is ElementTypesFilter => {
  return filter.type === ElementFilterType.ELEMENT_TYPES_FILTER;
};

export const isElementsCcidFilter = (
  filter: ElementFilter
): filter is ElementCcidsFilter => {
  return filter.type === ElementFilterType.ELEMENT_CCIDS_FILTER;
};

export const isElementsUpTheMapFilter = (
  filter: ElementFilter
): filter is ElementsUpTheMapFilter => {
  return filter.type === ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER;
};

const getFilterOrderIndex = (filterType: ElementFilterType): number => {
  switch (filterType) {
    case ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER:
      return 0;
    case ElementFilterType.ELEMENT_NAMES_FILTER:
      return 1;
    case ElementFilterType.ELEMENT_TYPES_FILTER:
      return 2;
    case ElementFilterType.ELEMENT_CCIDS_FILTER:
      return 3;
    default:
      throw new UnreachableCaseError(filterType);
  }
};

export const byFilterOrder = (a: ElementFilter, b: ElementFilter): number =>
  getFilterOrderIndex(a.type) - getFilterOrderIndex(b.type);

const prepareFilterPattern = (items: ReadonlyArray<string>): RegExp => {
  const validationPattern = items
    .map((item) =>
      item
        // make mainframers happy
        .replace(/%/g, '.')
        // replace * to proper regex symbol
        .replace(/\*/g, '.*')
        // escape the rest (probably) of regex reserved symbols
        .replace(/[+?^${}()[\]\\]/g, '\\$&')
    )
    .map((item) => ['^', item, '$'].join(''))
    .join('|');

  return new RegExp(validationPattern, 'i');
};

const filterElement =
  (filter: ElementFilter) => (cachedElement: CachedElement) => {
    let match;
    switch (filter.type) {
      case ElementFilterType.ELEMENT_NAMES_FILTER:
        match = prepareFilterPattern(filter.value).exec(
          cachedElement.element.name
        );
        break;
      case ElementFilterType.ELEMENT_TYPES_FILTER:
        match = prepareFilterPattern(filter.value).exec(
          cachedElement.element.type
        );
        break;
      case ElementFilterType.ELEMENT_CCIDS_FILTER:
        match = prepareFilterPattern(filter.value).exec(
          cachedElement.element.lastActionCcid || ''
        );
        break;
      case ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER:
        // ignore up the map filter on this level
        return cachedElement;
      default:
        throw new UnreachableCaseError(filter);
    }
    return match ? cachedElement : undefined;
  };

export const getAllFilteredElements =
  (cachedElements: ReadonlyArray<CachedElement>) =>
  (filter: ElementFilter): ReadonlyArray<CachedElement> => {
    return cachedElements.map(filterElement(filter)).filter(isDefined);
  };

export const getFirstFoundFilteredElement =
  (cachedElements: ReadonlyArray<CachedElement>) =>
  (filter: ElementFilter): CachedElement | undefined => {
    return cachedElements.find(filterElement(filter));
  };

export const isDuplicatedService =
  (services: EndevorServices, serviceLocations: ConnectionLocations) =>
  (endevorId: EndevorId): boolean => {
    return (
      Object.values(Source)
        .filter((source) => source !== endevorId.source)
        // workaround for ridiculous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            services[toStorageCompositeKey({ name: endevorId.name, source })] ||
            serviceLocations[
              toStorageCompositeKey({ name: endevorId.name, source })
            ]
          );
        }).length >= 1
    );
  };

export const toExistingServiceDescription =
  (state: () => State) =>
  (
    serviceKey: string,
    {
      id: serviceId,
      value: persistentServiceLocationValue,
      credential: persistentCredential,
    }: EndevorService
  ): ExistingEndevorServiceDescription => {
    const sessionDetails = state().sessions[serviceKey];
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    const serviceDescription: ExistingEndevorServiceDescription = {
      id: serviceId,
      status: EndevorServiceStatus.VALID,
      duplicated,
      // always try to use the session overrides first
      serviceLocation: sessionDetails?.connection
        ? sessionDetails.connection.value
        : persistentServiceLocationValue,
      credential: sessionDetails?.credential
        ? sessionDetails.credential.value
        : persistentCredential?.value,
    };
    // if the session does not have the override, status is always unknown
    if (!sessionDetails?.connection) {
      return {
        ...serviceDescription,
        status: EndevorServiceStatus.UNKNOWN_CONNECTION,
      };
    }
    // otherwise calculate the status
    switch (sessionDetails.connection.status) {
      case EndevorConnectionStatus.UNKNOWN:
        return {
          ...serviceDescription,
          status: EndevorServiceStatus.UNKNOWN_CONNECTION,
        };
      case EndevorConnectionStatus.INVALID:
        return {
          ...serviceDescription,
          status: EndevorServiceStatus.INVALID_CONNECTION,
        };
      case EndevorConnectionStatus.VALID:
        break;
      default:
        throw new UnreachableCaseError(sessionDetails.connection);
    }
    // if the session does not have the override, status is always unknown
    if (!sessionDetails.credential) {
      return {
        ...serviceDescription,
        status: EndevorServiceStatus.UNKNOWN_CREDENTIAL,
      };
    }
    // otherwise calculate the status
    switch (sessionDetails.credential.status) {
      case EndevorCredentialStatus.UNKNOWN:
        return {
          ...serviceDescription,
          status: EndevorServiceStatus.UNKNOWN_CREDENTIAL,
        };
      case EndevorCredentialStatus.INVALID:
        return {
          ...serviceDescription,
          status: EndevorServiceStatus.INVALID_CREDENTIAL,
        };
      case EndevorCredentialStatus.VALID:
        break;
      default:
        throw new UnreachableCaseError(sessionDetails.credential);
    }
    return serviceDescription;
  };

export const toNonExistingServiceDescription =
  (state: () => State) =>
  (serviceId: Id): NonExistingServiceDescription => {
    const duplicated = isDuplicatedService(
      state().services,
      state().serviceLocations
    )(serviceId);
    return {
      id: serviceId,
      status: EndevorServiceStatus.NON_EXISTING,
      duplicated,
    };
  };

export const toValidLocationDescription =
  (state: () => State) =>
  (endevorSearchLocation: EndevorSearchLocation) =>
  (
    availableFilters: ServiceLocationFilters | undefined
  ): ValidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== endevorSearchLocation.id.source)
        // workaround for ridiculous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().searchLocations[
              toStorageCompositeKey({
                name: endevorSearchLocation.id.name,
                source,
              })
            ] ||
            Object.values(state().serviceLocations)
              .flatMap((value) => Object.keys(value.value))
              .find(
                (value) =>
                  toStorageCompositeKey({
                    name: endevorSearchLocation.id.name,
                    source,
                  }) === value
              )
          );
        }).length >= 1;
    if (availableFilters) {
      const firstFoundSearchFilter =
        availableFilters[ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER];
      if (
        firstFoundSearchFilter &&
        isElementsUpTheMapFilter(firstFoundSearchFilter)
      ) {
        return {
          id: endevorSearchLocation.id,
          duplicated,
          status: EndevorSearchLocationStatus.VALID,
          searchForFirstFoundElements: firstFoundSearchFilter.value,
          location: endevorSearchLocation.value,
        };
      }
    }
    return {
      id: endevorSearchLocation.id,
      duplicated,
      status: EndevorSearchLocationStatus.VALID,
      searchForFirstFoundElements: DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
      location: endevorSearchLocation.value,
    };
  };

export const toInvalidLocationDescription =
  (state: () => State) =>
  (locationId: Id): InvalidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== locationId.source)
        // workaround for ridiculous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().searchLocations[
              toStorageCompositeKey({ name: locationId.name, source })
            ] ||
            Object.values(state().serviceLocations)
              .flatMap((value) => Object.keys(value.value))
              .find(
                (value) =>
                  toStorageCompositeKey({
                    name: locationId.name,
                    source,
                  }) === value
              )
          );
        }).length >= 1;
    return {
      id: locationId,
      status: EndevorSearchLocationStatus.INVALID,
      duplicated,
    };
  };
