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
  ElementMapPath,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toTreeElementUri } from '../uri/treeElementUri';
import { isDefined, isElementUpTheMap, isError, isTuple } from '../utils';
import { logger, reporter } from '../globals';
import { CachedElement } from '../_doc/Store';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from '../_doc/settings';
import { TelemetryEvents } from '../_doc/Telemetry';
import {
  EndevorMap,
  SubsystemMapPathId,
  mapSubsystems,
  toSubsystemMapPathId,
} from '../_doc/Endevor';

export const toElementId =
  (service: EndevorServiceName) =>
  (searchLocation: ElementLocationName) =>
  (element: ElementMapPath): string => {
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
export const buildTree =
  (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    elementsSearchLocation: ElementSearchLocation
  ) =>
  (endevorMap: EndevorMap) =>
  (elements: ReadonlyArray<CachedElement>): SystemNode[] => {
    // TODO: update the tree type system to be less profile-oriented
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const searchEnvironment = elementsSearchLocation.environment!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const searchStageNumber = elementsSearchLocation.stageNumber!;

    const searchSystemDefined = elementsSearchLocation.system;

    const searchSubsystemDefined = elementsSearchLocation.subsystem;

    const elementsInPlace: Array<CachedElement> = [];
    const elementsUpTheMap: Array<CachedElement> = [];
    elements.forEach((element) => {
      if (isElementUpTheMap(elementsSearchLocation)(element.element)) {
        elementsUpTheMap.push(element);
      } else {
        elementsInPlace.push(element);
      }
    });

    const tree: Systems = new Map();
    let subsystems = 0;
    let types = 0;

    const addSystemNode = (element: Element): SystemNode => {
      const name = element.system;
      const node: SystemNode = tree.get(name) ?? {
        type: 'SYS',
        name,
        children: new Map(),
      };
      tree.set(name, node);
      return node;
    };
    const addSubSystemNode =
      (system?: SystemNode) =>
      (element: Element): SubSystemNode => {
        const systemNode = system ?? addSystemNode(element);
        const name = element.subSystem;
        const existingNode = systemNode.children.get(name);
        if (existingNode) return existingNode;
        const node: SubSystemNode = systemNode.children.get(name) ?? {
          type: 'SUB',
          name,
          parent: systemNode,
          children: new Map(),
        };
        systemNode.children.set(name, node);
        subsystems++;
        return node;
      };
    const addTypeNode =
      (system?: SystemNode) =>
      (subsystem?: SubSystemNode) =>
      (element: Element): TypeNode => {
        const subsystemNode = subsystem ?? addSubSystemNode(system)(element);
        const name = element.type;
        const existingNode = subsystemNode.children.get(name);
        if (existingNode) return existingNode;
        const node: TypeNode = subsystemNode.children.get(name) ?? {
          type: 'TYPE',
          name,
          parent: subsystemNode,
          elements: new Map(),
          map: {
            type: 'MAP',
            name: '[MAP]',
            elements: new Map(),
          },
        };
        subsystemNode.children.set(name, node);
        types++;
        return node;
      };
    const addElementInPlace = (elementInPlace: CachedElement): void => {
      const element = elementInPlace.element;
      const typeNode = addTypeNode()()(element);
      const elementNode = toInPlaceElementNode(
        serviceName,
        service,
        searchLocationName,
        elementsSearchLocation
      )(elementInPlace)(typeNode)();
      if (isError(elementNode)) {
        const error = elementNode;
        logger.trace(
          `Unable to show the element ${element.name} in the tree because of error ${error.message}.`
        );
        return;
      }
      typeNode.elements.set(elementNode.name, elementNode);
    };
    elementsInPlace.forEach(addElementInPlace);

    const allSubsystemsInPlace = mapSubsystems(endevorMap);
    const addedSubsystemsInPlace: ReadonlyArray<
      [SubsystemMapPathId, SubSystemNode]
    > = Array.from(tree.values()).flatMap((system) => {
      return Array.from(system.children.values()).map((subsystem) => {
        const result: [SubsystemMapPathId, SubSystemNode] = [
          toSubsystemMapPathId({
            environment: searchEnvironment,
            stageNumber: searchStageNumber,
            system: system.name,
            subSystem: subsystem.name,
          }),
          subsystem,
        ];
        return result;
      });
    });
    const skippedSubsystemsInPlace = allSubsystemsInPlace
      .filter(({ subSystem, system }) => {
        const subsystemMapPathId = toSubsystemMapPathId({
          environment: searchEnvironment,
          stageNumber: searchStageNumber,
          subSystem,
          system,
        });
        const subsystemNotAdded = !isDefined(
          addedSubsystemsInPlace.find(([addedSubsystemId]) => {
            return addedSubsystemId === subsystemMapPathId;
          })
        );
        return subsystemNotAdded;
      })
      .filter(({ system }) => {
        if (searchSystemDefined) {
          return system === elementsSearchLocation.system;
        }
        const skipValue = true;
        return skipValue;
      })
      .filter(({ subSystem }) => {
        if (searchSubsystemDefined) {
          return subSystem === elementsSearchLocation.subsystem;
        }
        const skipValue = true;
        return skipValue;
      });
    const addElementUpTheMap = async (
      elementUpTheMap: CachedElement
    ): Promise<void> => {
      const endevorElement = elementUpTheMap.element;
      const elementMapPath = toSubsystemMapPathId(endevorElement);
      [...addedSubsystemsInPlace, ...skippedSubsystemsInPlace].forEach(
        (subsystemInPlace) => {
          const subsystemAlreadyInTree = isTuple(subsystemInPlace);
          if (subsystemAlreadyInTree) {
            const [subsystemMapPathId, subsystemNode] = subsystemInPlace;
            const coveredMapPaths = endevorMap[subsystemMapPathId];
            if (!isDefined(coveredMapPaths)) {
              logger.trace(
                `Unable to show the element ${endevorElement.name} in the tree, because an opened subsystem ${subsystemMapPathId} is not presented in the Endevor map.`
              );
              return;
            }
            const isElementUpTheMap = coveredMapPaths.filter((mapPath) => {
              return mapPath === elementMapPath;
            }).length;
            if (isElementUpTheMap) {
              const typeNode = addTypeNode()(subsystemNode)(endevorElement);
              const nodeName =
                endevorElement.name +
                ` [${endevorElement.environment}/${endevorElement.stageNumber}]`;
              const elementNode = toUpTheMapElementNode(
                serviceName,
                service,
                searchLocationName,
                elementsSearchLocation
              )(elementUpTheMap)(typeNode)(nodeName);
              if (isError(elementNode)) {
                const error = elementNode;
                logger.trace(
                  `Unable to show the element ${nodeName} in the tree because of error ${error.message}.`
                );
                return;
              }
              typeNode.map.elements.set(nodeName, elementNode);
              return;
            }
          } else {
            const subsystemMapPathId = toSubsystemMapPathId({
              environment: searchEnvironment,
              stageNumber: searchStageNumber,
              system: subsystemInPlace.system,
              subSystem: subsystemInPlace.subSystem,
            });
            const coveredMapPaths = endevorMap[subsystemMapPathId];
            if (!isDefined(coveredMapPaths)) {
              logger.trace(
                `Unable to show the element ${endevorElement.name} in the tree, because an opened subsystem ${subsystemMapPathId} is not presented in the Endevor map.`
              );
              return;
            }
            const isElementUpTheMap = coveredMapPaths.filter((mapPath) => {
              return mapPath === elementMapPath;
            }).length;
            if (isElementUpTheMap) {
              const typeNode = addTypeNode()()({
                ...endevorElement,
                system: subsystemInPlace.system,
                subSystem: subsystemInPlace.subSystem,
              });
              const nodeName =
                endevorElement.name +
                ` [${endevorElement.environment}/${endevorElement.stageNumber}]`;
              const elementNode = toUpTheMapElementNode(
                serviceName,
                service,
                searchLocationName,
                elementsSearchLocation
              )(elementUpTheMap)(typeNode)(nodeName);
              if (isError(elementNode)) {
                const error = elementNode;
                logger.trace(
                  `Unable to show the element ${nodeName} in the tree because of error ${error.message}.`
                );
                return;
              }
              typeNode.map.elements.set(nodeName, elementNode);
              return;
            }
          }
        }
      );
    };
    elementsUpTheMap.forEach(addElementUpTheMap);

    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ELEMENTS_PROVIDED,
      elementsInPlace: {
        elements: elementsInPlace.length,
        systems: tree.size,
        subsystems,
        types,
      },
      elementsUpTheMap: {
        elements: elementsUpTheMap.length,
      },
    });
    return Array.from(tree.values());
  };

const toInPlaceElementNode =
  (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    elementsSearchLocation: ElementSearchLocation
  ) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    const serializedUri = toTreeElementUri({
      serviceName,
      searchLocationName,
      service,
      element,
      searchLocation: elementsSearchLocation,
    })(lastRefreshTimestamp.toString());
    if (isError(serializedUri)) {
      const error = serializedUri;
      return error;
    }
    return {
      searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
      type: 'ELEMENT_IN_PLACE',
      name: nodeName ?? element.name,
      uri: serializedUri,
      parent,
    };
  };

const toUpTheMapElementNode =
  (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    elementsSearchLocation: ElementSearchLocation
  ) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    const serializedUri = toTreeElementUri({
      serviceName,
      searchLocationName,
      service,
      element,
      searchLocation: elementsSearchLocation,
    })(lastRefreshTimestamp.toString());
    if (isError(serializedUri)) {
      const error = serializedUri;
      return error;
    }
    return {
      searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
      type: 'ELEMENT_UP_THE_MAP',
      name: nodeName ?? element.name,
      uri: serializedUri,
      parent,
    };
  };
