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
import {
  ElementMapPath,
  ElementType,
  ElementTypeMapPath,
  EnvironmentStage,
  EnvironmentStageMapPath,
  SubSystem,
  SubSystemMapPath,
  System,
  SystemMapPath,
} from '@local/endevor/_doc/Endevor';
import {
  DEFAULT_SHOW_EMPTY_TYPES_MODE,
  DEFAULT_TREE_IN_PLACE_SEARCH_MODE,
} from '../constants';
import { isDefined } from '../utils';
import {
  ElementSearchLocation,
  EndevorAuthorizedService,
  EnvironmentStageMapPathId,
  SearchLocation,
  SubsystemMapPathId,
  SystemMapPathId,
  TypeMapPathId,
} from '../api/_doc/Endevor';
import { toCompositeKey as toStorageCompositeKey } from './storage/utils';
import {
  ConnectionLocations,
  Credential,
  Source,
} from './storage/_doc/Storage';
import {
  CachedElement,
  CachedEnvironmentStage,
  CachedEnvironmentStages,
  CachedSystem,
  ElementCcidsFilter,
  ElementFilter,
  ElementFilterType,
  ElementNamesFilter,
  ElementsUpTheMapFilter,
  ElementTypesFilter,
  EmptyTypesFilter,
  EndevorConfiguration,
  EndevorConnection,
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
  ValidEndevorCredential,
  ValidEndevorSearchLocationDescription,
} from './_doc/v2/Store';

export const getConnectionConfiguration =
  ({
    getConnectionDetails,
    getEndevorConfiguration,
    getCredential,
    getSearchLocation,
  }: {
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<EndevorConnection | undefined>;
    getEndevorConfiguration: (
      serviceId?: EndevorId,
      searchLocationId?: EndevorId
    ) => Promise<EndevorConfiguration | undefined>;
    getCredential: (
      connection: EndevorConnection,
      configuration: EndevorConfiguration
    ) => (
      credentialId: EndevorId
    ) => Promise<ValidEndevorCredential | undefined>;
    getSearchLocation: (
      searchLocationId: EndevorId
    ) => Promise<SearchLocation | undefined>;
  }) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<
    | {
        service: EndevorAuthorizedService;
        searchLocation: SearchLocation;
      }
    | undefined
  > => {
    const connectionDetails = await getConnectionDetails(serviceId);
    if (!connectionDetails) return;
    const configuration = await getEndevorConfiguration(
      serviceId,
      searchLocationId
    );
    if (!configuration) return;
    const credential = await getCredential(
      connectionDetails,
      configuration
    )(serviceId);
    if (!credential) return;
    const searchLocation = await getSearchLocation(searchLocationId);
    if (!searchLocation) return;
    return {
      service: {
        location: connectionDetails.value.location,
        rejectUnauthorized: connectionDetails.value.rejectUnauthorized,
        credential: credential.value,
        configuration,
      },
      searchLocation,
    };
  };

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
    environment: searchLocation.environment.toUpperCase(),
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

export const toEnvironmentStageMapPathId = ({
  environment,
  stageNumber,
}: EnvironmentStageMapPath): EnvironmentStageMapPathId => {
  return `${environment}/${stageNumber}`;
};

export const toSystemMapPathId = ({
  environment,
  stageNumber,
  system,
}: SystemMapPath): SystemMapPathId => {
  return `${environment}/${stageNumber}/${system}`;
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

export const toTypeMapPathId = ({
  environment,
  stageNumber,
  system,
  type,
}: ElementTypeMapPath): TypeMapPathId => {
  return `${environment}/${stageNumber}/${system}/${type}`;
};

export const fromTypeMapPathId = (
  typeMapPathId: TypeMapPathId
): ElementTypeMapPath | undefined => {
  const [environment, stageNumber, system, type] = typeMapPathId.split('/');
  if (!environment || !stageNumber || !system || !type) {
    return;
  }
  const stageNumberValue = toEndevorStageNumber(stageNumber);
  if (!stageNumberValue) return;
  return {
    environment,
    system,
    type,
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

export const isEmptyTypesFilter = (
  filter: ElementFilter
): filter is EmptyTypesFilter => {
  return filter.type === ElementFilterType.EMPTY_TYPES_FILTER;
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
    case ElementFilterType.EMPTY_TYPES_FILTER:
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
      case ElementFilterType.EMPTY_TYPES_FILTER:
        // ignore up the map filter and empty types filter on this level
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

export const typeMatchesFilter =
  (type: ElementType) =>
  (filter: ElementFilter): boolean => {
    return (
      filter.type === ElementFilterType.ELEMENT_TYPES_FILTER &&
      !!prepareFilterPattern(filter.value).exec(type.type)
    );
  };

export const getAllFilteredTypes =
  (cachedTypes: ReadonlyArray<ElementType>) =>
  (filter: ElementTypesFilter): ReadonlyArray<ElementType> => {
    return cachedTypes.filter((type) => typeMatchesFilter(type)(filter));
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
      value: persistentServiceValue,
      credential: persistentCredential,
    }: EndevorService &
      Partial<{
        credential: Credential;
      }>
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
      service: sessionDetails?.connection
        ? sessionDetails.connection.value
        : persistentServiceValue,
      // TODO ideally, to provide Endevor PassTicket too here, if available
      // TODO so far, there is not enough info for that (configuration info is missing in the service details)
      credential: sessionDetails?.credential?.value
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
  (serviceId: EndevorId): NonExistingServiceDescription => {
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
    let searchForFirstFoundElements = DEFAULT_TREE_IN_PLACE_SEARCH_MODE;
    let showEmptyTypes = DEFAULT_SHOW_EMPTY_TYPES_MODE;
    if (availableFilters) {
      const firstFoundSearchFilter =
        availableFilters[ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER];
      const showEmptyTypesFilter =
        availableFilters[ElementFilterType.EMPTY_TYPES_FILTER];
      searchForFirstFoundElements = !!firstFoundSearchFilter?.value;
      showEmptyTypes = !!showEmptyTypesFilter?.value;
    }
    return {
      id: endevorSearchLocation.id,
      duplicated,
      status: EndevorSearchLocationStatus.VALID,
      searchForFirstFoundElements,
      showEmptyTypes,
      location: endevorSearchLocation.value,
    };
  };

export const toInvalidLocationDescription =
  (state: () => State) =>
  (searchLocationId: EndevorId): InvalidEndevorSearchLocationDescription => {
    const duplicated =
      Object.values(Source)
        .filter((source) => source !== searchLocationId.source)
        // workaround for ridiculous typescript limitation
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        .map((source) => source as Source)
        .filter((source) => {
          return (
            state().searchLocations[
              toStorageCompositeKey({ name: searchLocationId.name, source })
            ] ||
            Object.values(state().serviceLocations)
              .flatMap((value) => Object.keys(value.value))
              .find(
                (value) =>
                  toStorageCompositeKey({
                    name: searchLocationId.name,
                    source,
                  }) === value
              )
          );
        }).length >= 1;
    return {
      id: searchLocationId,
      status: EndevorSearchLocationStatus.INVALID,
      duplicated,
    };
  };

export const createEndevorInventory = (
  allEnvironmentStages: ReadonlyArray<EnvironmentStage>,
  allSystems: ReadonlyArray<System>,
  allSubsystems: ReadonlyArray<SubSystem>,
  allTypes: ReadonlyArray<ElementType>
): CachedEnvironmentStages => {
  return allEnvironmentStages.reduce(
    (accEnvStages: { [id: string]: CachedEnvironmentStage }, envStage) => {
      const envStageId = toEnvironmentStageMapPathId(envStage);
      const systems = allSystems
        .filter(
          (system) =>
            system.environment === envStage.environment &&
            system.stageNumber === envStage.stageNumber
        )
        .reduce((accSystems: { [id: string]: CachedSystem }, system) => {
          const systemId = `${envStageId}/${system.system}`;
          const subsystems = allSubsystems
            .filter(
              (subsystem) =>
                subsystem.environment === system.environment &&
                subsystem.stageNumber === system.stageNumber &&
                subsystem.system === system.system
            )
            .reduce((accSubsystems: { [id: string]: SubSystem }, subsystem) => {
              accSubsystems[`${systemId}/${subsystem.subSystem}`] = subsystem;
              return accSubsystems;
            }, {});
          const types = allTypes
            .filter(
              (type) =>
                type.environment === system.environment &&
                type.stageNumber === system.stageNumber &&
                type.system === system.system
            )
            .reduce((accTypes: { [id: string]: ElementType }, type) => {
              accTypes[`${systemId}/${type.type}`] = type;
              return accTypes;
            }, {});
          accSystems[systemId] = {
            system,
            subsystems,
            types,
          };
          return accSystems;
        }, {});
      accEnvStages[envStageId] = {
        environmentStage: envStage,
        systems,
      };
      return accEnvStages;
    },
    {}
  );
};
