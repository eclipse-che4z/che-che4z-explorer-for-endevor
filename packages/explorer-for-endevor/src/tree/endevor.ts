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

import {
  Systems,
  SystemNode,
  SubSystemNode,
  TypeNode,
  ElementNode,
} from './_doc/ElementTree';
import { isError } from '../utils';
import { logger, reporter } from '../globals';
import {
  CachedElement,
  CachedEndevorInventory,
  ElementFilter,
  ElementFilterType,
  ElementsPerRoute,
  EndevorId,
} from '../store/_doc/v2/Store';
import { TelemetryEvents } from '../telemetry/_doc/Telemetry';
import { fromSubsystemMapPathId, typeMatchesFilter } from '../store/utils';
import { toElementTooltip } from './utils';
import { SubSystemMapPath } from '@local/endevor/_doc/Endevor';

type ElementsTreeOptions = Readonly<{
  withElementsUpTheMap: boolean;
  showEmptyRoutes: boolean;
  showEmptyTypes: boolean;
}>;

/**
 * Converts list element result into a tree for tree view
 */
export const buildTree =
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (
    elementsPerRoute: ElementsPerRoute,
    endevorInventory: CachedEndevorInventory,
    elementFilters: ReadonlyArray<ElementFilter>
  ) =>
  ({
    withElementsUpTheMap,
    showEmptyRoutes,
    showEmptyTypes,
  }: ElementsTreeOptions): Systems => {
    let overallElementsInPlaceCount = 0;
    let overallElementsUpTheMapCount = 0;
    const addTypeNode = (
      name: string,
      subsystemNode: SubSystemNode
    ): TypeNode => {
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
    const addSystemNode = (name: string, systems: Systems): SystemNode => {
      const existingSystem = systems.find((system) => system.name === name);
      const systemNode: SystemNode = existingSystem ?? {
        type: 'SYS',
        name,
        children: [],
      };
      if (!existingSystem) systems.push(systemNode);
      return systemNode;
    };
    const addSubSystemNode = (
      name: string,
      systemNode: SystemNode,
      subSystemMapPath: SubSystemMapPath
    ): SubSystemNode => {
      const existingSubsystem = systemNode.children.find(
        (treeSubsystem) => treeSubsystem.name === name
      );
      const subsystemNode: SubSystemNode = existingSubsystem ?? {
        type: 'SUB',
        name,
        parent: systemNode,
        children: [],
        subSystemMapPath,
        serviceId,
        searchLocationId,
      };
      if (!existingSubsystem) {
        systemNode.children.push(subsystemNode);
      }
      return subsystemNode;
    };
    const elementsTree = Object.entries(elementsPerRoute)
      .filter(([, elements]) => {
        if (elements.length === 0) {
          return showEmptyRoutes;
        }
        return true;
      })
      .reduce((acc: Systems, [searchSubsystem, elements]) => {
        const parsedSearchSubsystem = fromSubsystemMapPathId(searchSubsystem);
        if (!parsedSearchSubsystem) return acc;
        const systemNode = addSystemNode(parsedSearchSubsystem.system, acc);

        const subsystemNode = addSubSystemNode(
          parsedSearchSubsystem.subSystem,
          systemNode,
          parsedSearchSubsystem
        );
        const addElement = (cachedElement: CachedElement): void => {
          const element = cachedElement.element;
          if (cachedElement.elementIsUpTheMap && withElementsUpTheMap) {
            overallElementsUpTheMapCount++;
            const typeNode = addTypeNode(element.type, subsystemNode);
            const elementName = element.name;
            const elementNode = toUpTheMapElementNode(
              serviceId,
              searchLocationId
            )(cachedElement)(typeNode)(
              elementName + ` [${element.environment}/${element.stageNumber}]`
            );
            if (isError(elementNode)) {
              const error = elementNode;
              logger.trace(
                `Unable to show the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementName} in the tree because of error ${error.message}.`
              );
              return;
            }
            typeNode.map?.elements.push(elementNode);
            return;
          } else {
            overallElementsInPlaceCount++;
            const typeNode = addTypeNode(element.type, subsystemNode);
            const elementNode = toInPlaceElementNode(
              serviceId,
              searchLocationId
            )(cachedElement)(typeNode)();
            if (isError(elementNode)) {
              const error = elementNode;
              logger.trace(
                `Unable to show the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} in the tree because of error ${error.message}.`
              );
              return;
            }
            typeNode.elements.push(elementNode);
          }
        };
        elements.forEach(addElement);
        return acc;
      }, []);

    if (showEmptyTypes && endevorInventory.startEnvironmentStage) {
      const startEnvironmentStage =
        endevorInventory.environmentStages[
          endevorInventory.startEnvironmentStage
        ];
      if (startEnvironmentStage?.systems) {
        Object.entries(startEnvironmentStage.systems).forEach(
          ([, cachedSystem]) => {
            const systemNode = addSystemNode(
              cachedSystem.system.system,
              elementsTree
            );
            Object.entries(cachedSystem.subsystems).forEach(
              ([subsystemPath, subsystem]) => {
                const subSystemMapPath = fromSubsystemMapPathId(subsystemPath);
                if (!subSystemMapPath) {
                  return;
                }
                const subsystemNode = addSubSystemNode(
                  subsystem.subSystem,
                  systemNode,
                  subSystemMapPath
                );
                const typeFilter = elementFilters.find(
                  (elementFilter) =>
                    elementFilter.type ===
                    ElementFilterType.ELEMENT_TYPES_FILTER
                );
                Object.values(cachedSystem.types).forEach((type) => {
                  if (!typeFilter || typeMatchesFilter(type)(typeFilter))
                    addTypeNode(type.type, subsystemNode);
                });
              }
            );
          }
        );
      }
    }

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
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  ({ element, lastRefreshTimestamp, outOfDate }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    return {
      type: 'ELEMENT_IN_PLACE',
      serviceId,
      searchLocationId,
      name: nodeName ?? element.name,
      element,
      timestamp: lastRefreshTimestamp.toString(),
      parent,
      tooltip: toElementTooltip(
        element,
        outOfDate
          ? 'Element details may be out of date. Refresh the tree to get the latest information.'
          : undefined
      ),
      noSource: element.noSource,
      outOfDate,
    };
  };

const toUpTheMapElementNode =
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  ({ element, lastRefreshTimestamp, outOfDate }: CachedElement) =>
  (parent: TypeNode) =>
  (nodeName?: string): ElementNode | Error => {
    return {
      type: 'ELEMENT_UP_THE_MAP',
      serviceId,
      searchLocationId,
      name: nodeName ?? element.name,
      element,
      timestamp: lastRefreshTimestamp.toString(),
      parent,
      tooltip: toElementTooltip(
        element,
        outOfDate ? 'This element info is out of date!' : undefined
      ),
      noSource: element.noSource,
      outOfDate,
    };
  };
