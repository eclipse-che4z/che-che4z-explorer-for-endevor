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

import { CommandId } from '../commands/id';
import { EmptyMapNode } from './_doc/ElementTree';
import {
  AddNewServiceNode,
  AddNewSearchLocationNode,
  ServiceNodes,
  InvalidServiceNode,
  InvalidLocationNode,
  ValidLocationNode,
  ValidServiceNode,
} from './_doc/ServiceLocationTree';
import {
  EndevorSearchLocationDescription,
  EndevorSearchLocationDescriptions,
  EndevorSearchLocationStatus,
  EndevorServiceDescription,
  EndevorServiceLocations,
  EndevorServiceStatus,
  InvalidServiceDescription,
  ValidEndevorSearchLocationDescription,
  ValidEndevorServiceDescription,
} from '../store/_doc/v2/Store';
import { reporter } from '../globals';
import { TelemetryEvents } from '../_doc/telemetry/v2/Telemetry';
import { Source } from '../store/storage/_doc/Storage';
import { toCompositeKey } from '../store/storage/utils';
import { toServiceLocationCompositeKey } from '../store/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';

export const addNewServiceButton: AddNewServiceNode = {
  type: 'BUTTON_ADD_SERVICE',
  label: 'Add a new Endevor connection',
  command: {
    title: 'Add a new Endevor connection',
    command: CommandId.ADD_NEW_SERVICE,
    argument: undefined,
  },
};

export const addNewSearchLocationButton = (
  serviceNode: ValidServiceNode
): AddNewSearchLocationNode => {
  return {
    type: 'BUTTON_ADD_SEARCH_LOCATION',
    label: 'Add a new inventory location',
    command: {
      title: 'Add a new inventory location',
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
        return toServiceNode(serviceLocation)(serviceLocation.value);
      case EndevorServiceStatus.INVALID:
        return toInvalidServiceNode(serviceLocation)(serviceLocation.value);
    }
  });
};

const toServiceNode =
  (service: ValidEndevorServiceDescription) =>
  (locations: EndevorSearchLocationDescriptions): ValidServiceNode => {
    const serviceNodeParams: Omit<ValidServiceNode, 'type'> = {
      id: toCompositeKey(service.id),
      name: service.id.name,
      source: service.id.source,
      duplicated: service.duplicated,
      tooltip: service.url ? service.url : service.id.name,
      children: Object.values(locations).map((location) => {
        switch (location.status) {
          case EndevorSearchLocationStatus.VALID:
            return toSearchLocationNode(service)(location);
          case EndevorSearchLocationStatus.INVALID:
            return toInvalidSearchLocationNode(service)(location);
        }
      }),
    };
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_PROVIDED_INTO_TREE,
      source: service.id.source,
    });
    switch (service.id.source) {
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
        throw new UnreachableCaseError(service.id.source);
    }
  };

const toInvalidServiceNode =
  (service: InvalidServiceDescription) =>
  (locations: EndevorSearchLocationDescriptions): InvalidServiceNode => {
    const serviceNodeParams: InvalidServiceNode = {
      id: toCompositeKey(service.id),
      type: 'SERVICE_PROFILE/INVALID',
      name: service.id.name,
      source: service.id.source,
      duplicated: service.duplicated,
      tooltip:
        'Unable to locate this Endevor connection. Check out the configuration or just hide it.',
      children: Object.entries(locations).map(([, location]) =>
        toInvalidSearchLocationNode(service)(location)
      ),
    };
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_PROVIDED_INTO_TREE,
      source: service.id.source,
    });
    return serviceNodeParams;
  };

export const toSearchLocationNode =
  (service: EndevorServiceDescription) =>
  (location: ValidEndevorSearchLocationDescription): ValidLocationNode => {
    const locationNodeParams: Omit<ValidLocationNode, 'type'> = {
      id: toServiceLocationCompositeKey(service.id)(location.id),
      name: location.id.name,
      source: location.id.source,
      serviceName: service.id.name,
      serviceSource: service.id.source,
      duplicated: location.duplicated,
      tooltip: location.path ? location.path : location.id.name,
    };
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE,
      source: location.id.source,
      serviceSource: service.id.source,
    });
    switch (location.id.source) {
      case Source.INTERNAL:
        return {
          ...locationNodeParams,
          type: 'LOCATION',
        };
      case Source.SYNCHRONIZED:
        return {
          ...locationNodeParams,
          type: 'LOCATION_PROFILE',
        };
      default:
        throw new UnreachableCaseError(location.id.source);
    }
  };

export const toInvalidSearchLocationNode =
  (service: EndevorServiceDescription) =>
  (location: EndevorSearchLocationDescription): InvalidLocationNode => {
    const locationNodeParams: Omit<InvalidLocationNode, 'tooltip'> = {
      id: toServiceLocationCompositeKey(service.id)(location.id),
      type: 'LOCATION_PROFILE/INVALID',
      name: location.id.name,
      source: location.id.source,
      duplicated: location.duplicated,
      serviceName: service.id.name,
      serviceSource: service.id.source,
    };
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE,
      source: location.id.source,
      serviceSource: service.id.source,
    });
    switch (service.status) {
      case EndevorServiceStatus.VALID:
        return {
          ...locationNodeParams,
          tooltip:
            'Unable to locate this inventory location. Check out the configuration or just hide it.',
        };
      case EndevorServiceStatus.INVALID:
        return {
          ...locationNodeParams,
          tooltip:
            'Unable to use this inventory location because corresponding Endevor connection not found. Check out the configuration.',
        };
    }
  };

export const emptyMapNode: EmptyMapNode = {
  type: 'EMPTY_MAP_NODE',
};
