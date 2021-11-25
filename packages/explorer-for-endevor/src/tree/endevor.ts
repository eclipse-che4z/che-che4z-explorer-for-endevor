/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
  Systems,
  SystemNode,
  SubSystemNode,
  TypeNode,
  ElementNode,
  Services,
  ServiceNode,
  LocationNode,
} from '../_doc/ElementTree';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { logger } from '../globals';
import { CachedElement } from '../_doc/Store';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from '../_doc/settings';
import { Uri } from 'vscode';

export const toElementId =
  (service: EndevorServiceName) =>
  (searchLocation: ElementLocationName) =>
  (element: Element): string => {
    return `${service}/${searchLocation}/${element.instance}/${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
  };

export const toServiceId = (service: EndevorServiceName): string => {
  return service;
};

export const toSearchLocationId =
  (service: EndevorServiceName) =>
  (searchLocation: ElementLocationName): string => {
    return `${service}/${searchLocation}`;
  };

export const toServiceNodes = (
  locations: ReadonlyArray<LocationConfig>
): Services => {
  return locations.map((location) =>
    toServiceNode(location.service)(location.elementLocations)
  );
};

export const toServiceNode =
  (service: EndevorServiceName) =>
  (searchLocations: ReadonlyArray<ElementLocationName>): ServiceNode => {
    return {
      id: toServiceId(service),
      type: 'SERVICE',
      name: service,
      children: searchLocations.map((elementLocation) => ({
        id: toSearchLocationId(service)(elementLocation),
        type: 'LOCATION',
        name: elementLocation,
        serviceName: service,
      })),
    };
  };

export const toSearchLocationNode =
  (service: EndevorServiceName) =>
  (searchLocation: ElementLocationName): LocationNode => {
    return {
      id: toSearchLocationId(service)(searchLocation),
      type: 'LOCATION',
      name: searchLocation,
      serviceName: service,
    };
  };

/**
 * Converts list element result into a tree for tree view
 */
export const buildTree = (
  serviceName: EndevorServiceName,
  service: Service,
  searchLocationName: ElementLocationName,
  elementsSearchLocation: ElementSearchLocation,
  elements: ReadonlyArray<CachedElement>
): SystemNode[] => {
  const systems: Systems = new Map();

  const addSystemNode = (elm: Element): SystemNode => {
    const name = elm.system;
    const node: SystemNode = systems.get(name) ?? {
      type: 'SYS',
      name,
      children: new Map(),
    };
    systems.set(name, node);

    return node;
  };

  const addSubSystemNode = (element: Element): SubSystemNode => {
    const system = addSystemNode(element);
    const name = element.subSystem;
    const node: SubSystemNode = system.children.get(name) ?? {
      type: 'SUB',
      name,
      children: new Map(),
    };
    system.children.set(name, node);

    return node;
  };

  const addTypeNode = (element: Element): TypeNode => {
    const subsystem = addSubSystemNode(element);
    const name = element.type;
    const node: TypeNode = subsystem.children.get(name) ?? {
      type: 'TYPE',
      name,
      children: new Map(),
    };
    subsystem.children.set(name, node);

    return node;
  };

  const addElementNode = async (
    endevorElement: CachedElement
  ): Promise<void> => {
    const type = addTypeNode(endevorElement.element);
    const name = endevorElement.element.name;
    const serializedUri = toTreeElementUri({
      serviceName,
      searchLocationName,
      service,
      element: endevorElement.element,
      searchLocation: elementsSearchLocation,
    })(endevorElement.lastRefreshTimestamp.toString());
    if (isError(serializedUri)) {
      const error = serializedUri;
      logger.trace(
        `Cannot show an element ${name} in the tree, because of: ${error.message}`
      );
    } else {
      const node = newElementNode(
        serviceName,
        searchLocationName,
        endevorElement.element,
        name,
        serializedUri
      );
      type.children.set(name, node);
    }
  };

  Array.from(elements)
    .sort((l, r) => l.element.name.localeCompare(r.element.name))
    .forEach(addElementNode);

  return Array.from(systems.values());
};

export const newElementNode = (
  serviceName: EndevorServiceName,
  searchLocationName: ElementLocationName,
  element: Element,
  name: string,
  serializedUri: Uri
): ElementNode => {
  return {
    id: toElementId(serviceName)(searchLocationName)(element),
    searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
    type: 'ELEMENT',
    name,
    uri: serializedUri,
  };
};
