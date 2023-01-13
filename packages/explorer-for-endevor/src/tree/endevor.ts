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
} from './_doc/ElementTree';
import {
  ElementMapPath,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toTreeElementUri } from '../uri/treeElementUri';
import { isElementUpTheMap, isError } from '../utils';
import { logger, reporter } from '../globals';
import {
  CachedElement,
  ElementsPerRoute,
  EndevorId,
} from '../store/_doc/v2/Store';
import { TelemetryEvents } from '../_doc/telemetry/v2/Telemetry';
import { fromSubsystemMapPathId } from '../_doc/Endevor';
import { toServiceLocationCompositeKey } from '../store/utils';

type ElementsTreeOptions = Readonly<{
  withElementsUpTheMap: boolean;
  showEmptyRoutes: boolean;
}>;

/**
 * Converts list element result into a tree for tree view
 */
export const buildTree =
  (
    serviceId: EndevorId,
    service: Service,
    searchLocationId: EndevorId,
    elementsSearchLocation: ElementSearchLocation
  ) =>
  (elementsPerRoute: ElementsPerRoute) =>
  ({ withElementsUpTheMap, showEmptyRoutes }: ElementsTreeOptions): Systems => {
    let overallElementsInPlaceCount = 0;
    let overallElementsUpTheMapCount = 0;
    const elementsTree = Object.entries(elementsPerRoute)
      .filter(([, elements]) => {
        if (elements.length === 0) {
          if (showEmptyRoutes) return true;
          return false;
        }
        return true;
      })
      .reduce((acc: Systems, [searchSubsystem, elements]) => {
        const parsedSearchSubsystem = fromSubsystemMapPathId(searchSubsystem);
        if (!parsedSearchSubsystem) return acc;
        const existingSystem = acc.find(
          (system) => system.name === parsedSearchSubsystem.system
        );
        const systemNode: SystemNode = existingSystem ?? {
          type: 'SYS',
          name: parsedSearchSubsystem.system,
          children: [],
        };
        if (!existingSystem) acc.push(systemNode);
        const subsystemNode: SubSystemNode = {
          type: 'SUB',
          name: parsedSearchSubsystem.subSystem,
          parent: systemNode,
          children: [],
        };
        systemNode.children.push(subsystemNode);
        const addTypeNode = (name: string): TypeNode => {
          const existingNode = subsystemNode.children.find(
            (node) => node.name === name
          );
          if (existingNode) return existingNode;
          const node: TypeNode = {
            type: 'TYPE',
            name,
            parent: subsystemNode,
            elements: [],
            map: withElementsUpTheMap
              ? {
                  type: 'MAP',
                  name: '[MAP]',
                  elements: [],
                }
              : undefined,
          };
          subsystemNode.children.push(node);
          return node;
        };
        const addElement = (cachedElement: CachedElement): void => {
          const element = cachedElement.element;
          if (
            isElementUpTheMap(elementsSearchLocation)(element) &&
            withElementsUpTheMap
          ) {
            overallElementsUpTheMapCount++;
            const typeNode = addTypeNode(element.type);
            const elementName = element.name;
            const elementNode = toUpTheMapElementNode(
              serviceId,
              service,
              searchLocationId,
              elementsSearchLocation
            )(cachedElement)(typeNode)(
              elementName + ` [${element.environment}/${element.stageNumber}]`
            );
            if (isError(elementNode)) {
              const error = elementNode;
              logger.trace(
                `Unable to show the element ${elementName} in the tree because of error ${error.message}.`
              );
              return;
            }
            typeNode.map?.elements.push(elementNode);
            return;
          } else {
            overallElementsInPlaceCount++;
            const typeNode = addTypeNode(element.type);
            const elementNode = toInPlaceElementNode(
              serviceId,
              service,
              searchLocationId,
              elementsSearchLocation
            )(cachedElement)(typeNode)();
            if (isError(elementNode)) {
              const error = elementNode;
              logger.trace(
                `Unable to show the element ${element.name} in the tree because of error ${error.message}.`
              );
              return;
            }
            typeNode.elements.push(elementNode);
          }
        };
        elements.forEach(addElement);
        return acc;
      }, []);
    if (withElementsUpTheMap) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ELEMENTS_UP_THE_MAP_TREE_BUILT,
        routesCount: Object.keys(elementsPerRoute).length,
        elementsInPlaceCount: overallElementsInPlaceCount,
        elementsUpTheMapCount: overallElementsUpTheMapCount,
      });
    } else {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ELEMENTS_IN_PLACE_TREE_BUILT,
        elementsInPlaceCount: overallElementsInPlaceCount,
        systemsCount: Object.keys(elementsTree).length,
        subsystemsCount: Object.keys(elementsPerRoute).length,
      });
    }
    return elementsTree;
  };

const toInPlaceElementNode =
  (
    serviceId: EndevorId,
    service: Service,
    searchLocationId: EndevorId,
    searchLocation: ElementSearchLocation
  ) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    const serializedUri = toTreeElementUri({
      serviceId,
      searchLocationId,
      service,
      element,
      searchLocation,
    })(lastRefreshTimestamp.toString());
    if (isError(serializedUri)) {
      const error = serializedUri;
      return error;
    }
    return {
      searchLocationId:
        toServiceLocationCompositeKey(serviceId)(searchLocationId),
      type: 'ELEMENT_IN_PLACE',
      name: nodeName ?? element.name,
      uri: serializedUri,
      parent,
      tooltip: toElementTooltip(element),
    };
  };

export const toElementTooltip = (element: ElementMapPath): string => {
  const tooltip =
    element.configuration && element
      ? `${element.configuration}/${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}`
      : '';
  return tooltip;
};

const toUpTheMapElementNode =
  (
    serviceId: EndevorId,
    service: Service,
    searchLocationId: EndevorId,
    searchLocation: ElementSearchLocation
  ) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    const serializedUri = toTreeElementUri({
      serviceId,
      searchLocationId,
      service,
      element,
      searchLocation,
    })(lastRefreshTimestamp.toString());
    if (isError(serializedUri)) {
      const error = serializedUri;
      return error;
    }
    return {
      searchLocationId:
        toServiceLocationCompositeKey(serviceId)(searchLocationId),
      type: 'ELEMENT_UP_THE_MAP',
      name: nodeName ?? element.name,
      uri: serializedUri,
      parent,
      tooltip: toElementTooltip(element),
    };
  };
