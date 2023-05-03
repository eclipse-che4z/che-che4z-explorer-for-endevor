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
  ElementsPerRoute,
  EndevorId,
} from '../store/_doc/v2/Store';
import { TelemetryEvents } from '../_doc/telemetry/v2/Telemetry';
import { fromSubsystemMapPathId } from '../store/utils';
import {
  ChangeLevelNode,
  ChangeLevels,
  HistoryLine,
  HistoryLines,
} from './_doc/ChangesTree';
import { Uri } from 'vscode';
import { toElementTooltip } from './utils';

type ElementsTreeOptions = Readonly<{
  withElementsUpTheMap: boolean;
  showEmptyRoutes: boolean;
}>;

export const HISTORY_LINE_PATTERN =
  '^\\s*(%{0,1})\\+([0-9]{4})(?:-| )([0-9]{4}|\\s{4}) (.*)$';
const SOURCE_CHANGE_LINE_PATTERN =
  '^\\s*([0-9]{4})\\s+([A-Z]{0,1})\\s+(.{1,8})\\s+(\\S{7})' +
  '\\s+(\\S{5})\\s+([0-9]+) (.{1,12}) (.*)';
const SOURCE_CHANGE_LINE_HEADER =
  'VVLL SYNC USER     DATE    TIME     STMTS CCID         COMMENT';

/**
 * Converts list element result into a tree for tree view
 */
export const buildTree =
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
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
          subSystemMapPath: parsedSearchSubsystem,
          serviceId,
          searchLocationId,
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
          if (cachedElement.elementIsUpTheMap && withElementsUpTheMap) {
            overallElementsUpTheMapCount++;
            const typeNode = addTypeNode(element.type);
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
              searchLocationId
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
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
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
      tooltip: toElementTooltip(element),
      noSource: element.noSource,
    };
  };

const toUpTheMapElementNode =
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  ({ element, lastRefreshTimestamp }: CachedElement) =>
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
      tooltip: toElementTooltip(element),
      noSource: element.noSource,
    };
  };

export const parseHistory = (
  content: string,
  uri: Uri
): { changeLevels: ChangeLevels; historyLines: HistoryLines } | Error => {
  const contentLines = content.split(/\r?\n/);
  const changeLevels = Array<ChangeLevelNode>();
  const historyLines = Array<HistoryLine>();

  let lineIndex = 0;
  let isHeader = contentLines[lineIndex]?.indexOf(SOURCE_CHANGE_LINE_HEADER);
  while (lineIndex < contentLines.length && isHeader && isHeader < 0) {
    lineIndex++;
    isHeader = contentLines[lineIndex]?.indexOf(SOURCE_CHANGE_LINE_HEADER);
  }
  if (!isHeader || isHeader < 0) {
    return new Error('History Change Level metadata header does not match.');
  }
  while (
    lineIndex < contentLines.length &&
    !contentLines[lineIndex]?.match(HISTORY_LINE_PATTERN)
  ) {
    const matcher = contentLines[lineIndex]?.match(SOURCE_CHANGE_LINE_PATTERN);
    if (matcher && matcher[1]) {
      const node = {
        uri,
        vvll: matcher[1].trim(),
        user: matcher[3]?.trim(),
        date: matcher[4]?.trim(),
        time: matcher[5]?.trim(),
        ccid: matcher[7]?.trim(),
        comment: matcher[8]?.trim(),
        lineNums: [],
      };
      changeLevels.push(node);
    }
    lineIndex++;
  }
  while (lineIndex < contentLines.length) {
    const matcher = contentLines[lineIndex]?.match(HISTORY_LINE_PATTERN);
    if (matcher) {
      const historyLine = {
        changed: matcher[1] === '%',
        addedVersion: matcher[2]?.trim() || '',
        removedVersion: matcher[3]?.trim() || '',
        line: lineIndex,
        lineLength: contentLines[lineIndex]?.length,
      };
      historyLines.push(historyLine);
    }
    lineIndex++;
  }
  if (!changeLevels || !historyLines) {
    return new Error('Could not find any history data');
  }
  return {
    changeLevels,
    historyLines,
  };
};
