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

import { CommandId } from '../commands/id';
import { EmptyMapNode } from './_doc/ElementTree';
import {
  AddNewSearchLocationNode,
  ServiceNodes,
  NonExistingServiceNode,
  InvalidLocationNode,
  ValidLocationNode,
  ValidServiceNode,
  InvalidConnectionServiceNode,
  InvalidCredentialsServiceNode,
} from './_doc/ServiceLocationTree';
import {
  ElementFilter,
  ElementFilterType,
  EndevorId,
  EndevorSearchLocationDescription,
  EndevorSearchLocationDescriptions,
  EndevorSearchLocationStatus,
  EndevorServiceDescription,
  EndevorServiceLocations,
  EndevorServiceStatus,
  InvalidEndevorServiceDescription,
  NonExistingServiceDescription,
  ValidEndevorSearchLocationDescription,
  ValidEndevorServiceDescription,
} from '../store/_doc/v2/Store';
import { Source } from '../store/storage/_doc/Storage';
import { toCompositeKey } from '../store/storage/utils';
import { toServiceLocationCompositeKey } from '../store/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { byNameOrder, isDefined } from '../utils';
import {
  FilterNode,
  FilterValueNode,
  FilteredNode,
  FilterNodeType,
} from './_doc/FilterTree';
import { FILTER_DELIMITER, FILTER_WILDCARD_ZERO_OR_MORE } from '../constants';
import { toSearchLocationTooltip, toServiceTooltip } from './utils';

export const addNewSearchLocationButton = (
  serviceNode: ValidServiceNode
): AddNewSearchLocationNode => {
  return {
    type: 'BUTTON_ADD_SEARCH_LOCATION',
    label: 'Add a New Inventory Location',
    command: {
      title: 'Add a New Inventory Location',
      command: CommandId.ADD_NEW_SEARCH_LOCATION,
      argument: serviceNode,
    },
  };
};

export const toServiceNodes = (
  serviceLocations: EndevorServiceLocations
): ServiceNodes => {
  return Object.values(serviceLocations).map((serviceLocation) => {
    switch (serviceLocation.status) {
      case EndevorServiceStatus.VALID:
      case EndevorServiceStatus.UNKNOWN_CONNECTION:
      case EndevorServiceStatus.UNKNOWN_CREDENTIAL:
        return toValidServiceNode(serviceLocation)(serviceLocation.value);
      case EndevorServiceStatus.NON_EXISTING:
        return toNonExistingServiceNode(serviceLocation)(serviceLocation.value);
      case EndevorServiceStatus.INVALID_CREDENTIAL:
        if (!Object.entries(serviceLocation.value).length) {
          return toEmptyServiceNode(serviceLocation);
        }
        return toWrongCredentialsServiceNode(serviceLocation)(
          serviceLocation.value
        );
      case EndevorServiceStatus.INVALID_CONNECTION:
        if (!Object.entries(serviceLocation.value).length) {
          return toEmptyServiceNode(serviceLocation);
        }
        return toInvalidConnectionServiceNode(serviceLocation)(
          serviceLocation.value
        );
      default:
        throw new UnreachableCaseError(serviceLocation);
    }
  });
};

const toValidServiceNode =
  (serviceDescription: ValidEndevorServiceDescription) =>
  (
    locationDescriptions: EndevorSearchLocationDescriptions
  ): ValidServiceNode => {
    const serviceNodeParams: Omit<ValidServiceNode, 'type'> = {
      id: toCompositeKey(serviceDescription.id),
      name: serviceDescription.id.name,
      source: serviceDescription.id.source,
      duplicated: serviceDescription.duplicated,
      isDefault: serviceDescription.isDefault,
      tooltip: toServiceTooltip({
        serviceId: serviceDescription.id,
        service: serviceDescription.service,
        credential: serviceDescription.credential,
        isDefault: serviceDescription.isDefault,
      }),
      children: Object.values(locationDescriptions)
        .map((location) => {
          switch (location.status) {
            case EndevorSearchLocationStatus.VALID:
              return toSearchLocationNode(serviceDescription)(location);
            case EndevorSearchLocationStatus.INVALID:
              return toInvalidSearchLocationNode(serviceDescription)(location);
          }
        })
        .sort(byNameOrder),
    };
    switch (serviceDescription.id.source) {
      case Source.INTERNAL:
        return {
          ...serviceNodeParams,
          type: 'SERVICE',
        };
      case Source.SYNCHRONIZED:
        return {
          ...serviceNodeParams,
          type: 'SERVICE_PROFILE',
        };
      default:
        throw new UnreachableCaseError(serviceDescription.id.source);
    }
  };
const toEmptyServiceNode = (
  serviceDescription:
    | ValidEndevorServiceDescription
    | InvalidEndevorServiceDescription
): ValidServiceNode => {
  const serviceNodeParams: Omit<ValidServiceNode, 'type'> = {
    id: toCompositeKey(serviceDescription.id),
    name: serviceDescription.id.name,
    source: serviceDescription.id.source,
    duplicated: serviceDescription.duplicated,
    isDefault: serviceDescription.isDefault,
    tooltip: toServiceTooltip({
      serviceId: serviceDescription.id,
      service: serviceDescription.service,
      credential: serviceDescription.credential,
      isDefault: serviceDescription.isDefault,
    }),
    children: [],
  };
  switch (serviceDescription.id.source) {
    case Source.INTERNAL:
      return {
        ...serviceNodeParams,
        type: 'SERVICE',
      };
    case Source.SYNCHRONIZED:
      return {
        ...serviceNodeParams,
        type: 'SERVICE_PROFILE',
      };
    default:
      throw new UnreachableCaseError(serviceDescription.id.source);
  }
};
const toInvalidConnectionServiceNode =
  (serviceDescription: InvalidEndevorServiceDescription) =>
  (
    locationDescriptions: EndevorSearchLocationDescriptions
  ): InvalidConnectionServiceNode => {
    const serviceNodeParams: Omit<InvalidConnectionServiceNode, 'type'> = {
      id: toCompositeKey(serviceDescription.id),
      name: serviceDescription.id.name,
      source: serviceDescription.id.source,
      duplicated: serviceDescription.duplicated,
      isDefault: serviceDescription.isDefault,
      tooltip: toServiceTooltip(
        {
          serviceId: serviceDescription.id,
          service: serviceDescription.service,
          credential: serviceDescription.credential,
          isDefault: serviceDescription.isDefault,
        },
        'Unable to validate this Endevor connection. Edit the configuration or hide the connection.'
      ),
      children: Object.entries(locationDescriptions)
        .map(([, location]) =>
          toInvalidSearchLocationNode(serviceDescription)(location)
        )
        .sort(byNameOrder),
    };
    switch (serviceDescription.id.source) {
      case Source.INTERNAL:
        return {
          ...serviceNodeParams,
          type: 'SERVICE/INVALID_CONNECTION',
        };
      case Source.SYNCHRONIZED:
        return {
          ...serviceNodeParams,
          type: 'SERVICE_PROFILE/INVALID_CONNECTION',
        };
      default:
        throw new UnreachableCaseError(serviceDescription.id.source);
    }
  };
const toNonExistingServiceNode =
  (
    serviceDescription:
      | InvalidEndevorServiceDescription
      | NonExistingServiceDescription
  ) =>
  (
    locationDescriptions: EndevorSearchLocationDescriptions
  ): NonExistingServiceNode => {
    const serviceNodeParams: Omit<NonExistingServiceNode, 'type'> = {
      id: toCompositeKey(serviceDescription.id),
      name: serviceDescription.id.name,
      source: serviceDescription.id.source,
      duplicated: serviceDescription.duplicated,
      tooltip: toServiceTooltip(
        {
          serviceId: serviceDescription.id,
        },
        'Unable to locate this Endevor connection. Review the configuration or delete the connection.'
      ),
      children: Object.entries(locationDescriptions)
        .map(([, location]) =>
          toInvalidSearchLocationNode(serviceDescription)(location)
        )
        .sort(byNameOrder),
    };
    switch (serviceDescription.id.source) {
      case Source.INTERNAL:
        return {
          ...serviceNodeParams,
          type: 'SERVICE/NON_EXISTING',
        };
      case Source.SYNCHRONIZED:
        return {
          ...serviceNodeParams,
          type: 'SERVICE_PROFILE/NON_EXISTING',
        };
      default:
        throw new UnreachableCaseError(serviceDescription.id.source);
    }
  };

const toWrongCredentialsServiceNode =
  (serviceDescription: InvalidEndevorServiceDescription) =>
  (
    locationDescriptions: EndevorSearchLocationDescriptions
  ): InvalidCredentialsServiceNode => {
    const serviceNodeParams: Omit<InvalidCredentialsServiceNode, 'type'> = {
      id: toCompositeKey(serviceDescription.id),
      name: serviceDescription.id.name,
      source: serviceDescription.id.source,
      duplicated: serviceDescription.duplicated,
      isDefault: serviceDescription.isDefault,
      tooltip: toServiceTooltip(
        {
          serviceId: serviceDescription.id,
          service: serviceDescription.service,
          credential: serviceDescription.credential,
          isDefault: serviceDescription.isDefault,
        },
        'Unable to validate credentials for this Endevor connection.'
      ),
      children: Object.entries(locationDescriptions)
        .map(([, location]) =>
          toInvalidSearchLocationNode(serviceDescription)(location)
        )
        .sort(byNameOrder),
    };
    switch (serviceDescription.id.source) {
      case Source.INTERNAL:
        return {
          ...serviceNodeParams,
          type: 'SERVICE/INVALID_CREDENTIALS',
        };
      case Source.SYNCHRONIZED:
        return {
          ...serviceNodeParams,
          type: 'SERVICE_PROFILE/INVALID_CREDENTIALS',
        };
      default:
        throw new UnreachableCaseError(serviceDescription.id.source);
    }
  };

const toSearchLocationNode =
  (serviceDescription: EndevorServiceDescription) =>
  (
    locationDescription: ValidEndevorSearchLocationDescription
  ): ValidLocationNode => {
    const locationNodeParams: Omit<ValidLocationNode, 'type'> = {
      id: toServiceLocationCompositeKey(serviceDescription.id)(
        locationDescription.id
      ),
      name: locationDescription.id.name,
      source: locationDescription.id.source,
      serviceName: serviceDescription.id.name,
      serviceSource: serviceDescription.id.source,
      duplicated: locationDescription.duplicated,
      withEmptyTypes: locationDescription.showEmptyTypes,
      isDefault: locationDescription.isDefault,
      tooltip: toSearchLocationTooltip({
        locationId: locationDescription.id,
        location: locationDescription.location,
        isDefault: locationDescription.isDefault,
      }),
    };
    switch (locationDescription.id.source) {
      case Source.INTERNAL:
        return locationDescription.searchForFirstFoundElements
          ? {
              ...locationNodeParams,
              type: 'LOCATION/WITH_MAP',
            }
          : {
              ...locationNodeParams,
              type: 'LOCATION',
            };
      case Source.SYNCHRONIZED:
        return locationDescription.searchForFirstFoundElements
          ? {
              ...locationNodeParams,
              type: 'LOCATION_PROFILE/WITH_MAP',
            }
          : {
              ...locationNodeParams,
              type: 'LOCATION_PROFILE',
            };
      default:
        throw new UnreachableCaseError(locationDescription.id.source);
    }
  };

const toInvalidSearchLocationNode =
  (serviceDescription: EndevorServiceDescription) =>
  (
    locationDescription: EndevorSearchLocationDescription
  ): InvalidLocationNode => {
    const locationNodeParams = {
      id: toServiceLocationCompositeKey(serviceDescription.id)(
        locationDescription.id
      ),
      name: locationDescription.id.name,
      source: locationDescription.id.source,
      duplicated: locationDescription.duplicated,
      serviceName: serviceDescription.id.name,
      serviceSource: serviceDescription.id.source,
      isDefault: locationDescription.isDefault,
    };
    if (locationDescription.status === EndevorSearchLocationStatus.INVALID) {
      return {
        ...locationNodeParams,
        type:
          locationDescription.id.source === Source.INTERNAL
            ? 'LOCATION/NON_EXISTING'
            : 'LOCATION_PROFILE/NON_EXISTING',
        tooltip: toSearchLocationTooltip(
          {
            locationId: locationDescription.id,
          },
          'Unable to locate this Endevor inventory location. Review the configuration or delete the inventory location.'
        ),
      };
    }
    switch (serviceDescription.status) {
      case EndevorServiceStatus.VALID:
      case EndevorServiceStatus.UNKNOWN_CONNECTION:
      case EndevorServiceStatus.UNKNOWN_CREDENTIAL:
        return {
          ...locationNodeParams,
          type:
            locationDescription.id.source === Source.INTERNAL
              ? 'LOCATION/NON_EXISTING'
              : 'LOCATION_PROFILE/NON_EXISTING',
          tooltip: toSearchLocationTooltip(
            {
              locationId: locationDescription.id,
            },
            'Unable to locate this Endevor inventory location. Review the configuration or delete the inventory location.'
          ),
        };
      case EndevorServiceStatus.NON_EXISTING:
        return {
          ...locationNodeParams,
          type:
            locationDescription.id.source === Source.INTERNAL
              ? 'LOCATION/NON_EXISTING'
              : 'LOCATION_PROFILE/NON_EXISTING',
          tooltip: toSearchLocationTooltip(
            {
              locationId: locationDescription.id,
              location: locationDescription.location,
            },
            'Unable to use this inventory location because the corresponding Endevor connection is not found. Review the configuration.'
          ),
        };
      case EndevorServiceStatus.INVALID_CREDENTIAL:
        return {
          ...locationNodeParams,
          type:
            locationDescription.id.source === Source.INTERNAL
              ? 'LOCATION/INVALID_CREDENTIALS'
              : 'LOCATION_PROFILE/INVALID_CREDENTIALS',
          tooltip: toSearchLocationTooltip(
            {
              locationId: locationDescription.id,
              location: locationDescription.location,
            },
            `Incorrect credentials provided for ${serviceDescription.id.name}. Click on the inventory location to enter new credentials.`
          ),
          command: {
            command: CommandId.EDIT_CREDENTIALS,
            title: 'Prompt for Credentials',
            arguments: [locationNodeParams],
          },
        };
      case EndevorServiceStatus.INVALID_CONNECTION:
        return {
          ...locationNodeParams,
          type:
            locationDescription.id.source === Source.INTERNAL
              ? 'LOCATION/INVALID_CONNECTION'
              : 'LOCATION_PROFILE/INVALID_CONNECTION',
          tooltip: toSearchLocationTooltip(
            {
              locationId: locationDescription.id,
              location: locationDescription.location,
            },
            `Incorrect connection details provided for ${serviceDescription.id.name}. Click on the inventory location to enter new details.`
          ),
          command: {
            command: CommandId.EDIT_CONNECTION_DETAILS,
            title: 'Prompt for Connection Details',
            arguments: [locationNodeParams],
          },
        };
      default:
        throw new UnreachableCaseError(serviceDescription);
    }
  };

export const toFilteredNode =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (filters: ReadonlyArray<ElementFilter>): FilteredNode | undefined => {
    if (!filters.length) return;
    const children = filters
      .map((filter) => toFilterNode(serviceId)(searchLocationId)(filter))
      .filter(isDefined);
    if (!children.length) return;
    return {
      type: 'FILTERED',
      name: '<Filtered>',
      searchLocationName: searchLocationId.name,
      searchLocationSource: searchLocationId.source,
      serviceName: serviceId.name,
      serviceSource: serviceId.source,
      children: children.filter(isDefined),
      tooltip: children
        .map((child) => {
          return `By ${child.name.toString()}`;
        })
        .join(`${FILTER_DELIMITER} `),
    };
  };

const toFilterNode =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (filter: ElementFilter): FilterNode | undefined => {
    let filterType: FilterNodeType;
    switch (filter.type) {
      case ElementFilterType.ELEMENT_NAMES_FILTER:
        filterType = FilterNodeType.NAMES_FILTER;
        break;
      case ElementFilterType.ELEMENT_TYPES_FILTER:
        filterType = FilterNodeType.TYPES_FILTER;
        break;
      case ElementFilterType.ELEMENT_CCIDS_FILTER:
        filterType = FilterNodeType.CCIDS_FILTER;
        break;
      case ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER:
      case ElementFilterType.EMPTY_TYPES_FILTER:
        return;
      default:
        throw new UnreachableCaseError(filter);
    }
    if (
      filter.value[0] == FILTER_WILDCARD_ZERO_OR_MORE &&
      filter.value.length == 1
    )
      return;
    return {
      type: 'FILTER',
      name: filterType,
      filterType,
      searchLocationName: searchLocationId.name,
      searchLocationSource: searchLocationId.source,
      serviceName: serviceId.name,
      serviceSource: serviceId.source,
      children: filter.value.map((value) =>
        toFilterValueNode(serviceId)(searchLocationId)(filterType)(value)
      ),
      tooltip: filter.value.join(FILTER_DELIMITER),
    };
  };

const toFilterValueNode =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (filterType: FilterNodeType) =>
  (value: string): FilterValueNode => {
    return {
      type: 'FILTER_VALUE',
      name: value,
      filterType,
      searchLocationName: searchLocationId.name,
      searchLocationSource: searchLocationId.source,
      serviceName: serviceId.name,
      serviceSource: serviceId.source,
    };
  };

export const emptyMapNode: EmptyMapNode = {
  type: 'EMPTY_MAP_NODE',
};
