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

import * as vscode from 'vscode';
import { CommandId } from '../commands/id';
import {
  Node,
  ElementNode,
  ServiceNode,
  LocationNode,
  AddNewProfileNode,
} from '../_doc/ElementTree';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { addNewProfileButton } from './buttons';
import {
  getAllEnvironmentStages,
  getAllSubSystems,
  getAllSystems,
  searchForElements,
} from '../endevor';
import { buildTree, toServiceNodes } from './endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Action, Actions } from '../_doc/Actions';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { logger, reporter } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { isDefined, isError } from '../utils';
import { getElements, getEndevorMap, getLocations } from '../store/store';
import { State } from '../_doc/Store';
import {
  ElementsFetchingStatus,
  EndevorMapBuildingStatus,
  TelemetryEvents,
} from '../_doc/Telemetry';
import { toSeveralTasksProgress } from '@local/endevor/utils';
import { EndevorMap } from '../_doc/Endevor';
import { toEndevorMap, toEndevorMapWithWildcards } from './endevorMap';

class ElementItem extends vscode.TreeItem {
  constructor(node: ElementNode) {
    super(node.name, vscode.TreeItemCollapsibleState.None);

    this.resourceUri = node.uri;
    this.contextValue = node.type;

    this.command = {
      title: 'print',
      command: CommandId.PRINT_ELEMENT,
      tooltip: 'Print element',
      arguments: [this.resourceUri, node.name],
    };
  }
}

class LocationItem extends vscode.TreeItem {
  constructor(node: LocationNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'ELEMENT_LOCATION';
  }
}
class ServerItem extends vscode.TreeItem {
  constructor(node: ServiceNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'ENDEVOR_SERVICE';
  }
}
class EmptyMapItem extends vscode.TreeItem {
  constructor() {
    super('No results found.');
  }
}
const makeElemTooltip = (element: Element): string => {
  const tooltip =
    element.instance && element
      ? `/${element.instance}/${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}`
      : '';
  return tooltip;
};

class ButtonItem extends vscode.TreeItem {
  constructor(node: AddNewProfileNode) {
    super(node.label, vscode.TreeItemCollapsibleState.None);
    this.label = node.label;
    this.command = node.command;
  }
}

const toTreeItem = (node: Node): vscode.TreeItem => {
  switch (node.type) {
    case 'BUTTON_ADD_PROFILE':
      return new ButtonItem(node);
    case 'SERVICE':
      return new ServerItem(node);
    case 'LOCATION':
      return new LocationItem(node);
    case 'MAP':
    case 'SYS':
    case 'SUB':
    case 'TYPE': {
      const typeTreeItem = new vscode.TreeItem(
        node.name,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      return typeTreeItem;
    }
    case 'ELEMENT_UP_THE_MAP':
    case 'ELEMENT_IN_PLACE': {
      const elmNode = new ElementItem(node);
      const uriParams = fromTreeElementUri(node.uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.trace(
          `Cannot build a proper tooltip for an element: ${node.name}, because of ${error.message}`
        );
      } else {
        elmNode.tooltip = makeElemTooltip(uriParams.element);
      }
      return elmNode;
    }
    case 'EMPTY_MAP_NODE':
      return new EmptyMapItem();
    default:
      throw new UnreachableCaseError(node);
  }
};

interface DataGetters {
  getState: () => State;
  getService: (name: string) => Promise<Service | undefined>;
  getSearchLocation: (
    serviceName: string,
    searchLocationName: string
  ) => Promise<ElementSearchLocation | undefined>;
}

export const make = (
  treeChangeEmitter: vscode.EventEmitter<Node | null>,
  { getState, getService, getSearchLocation }: DataGetters,
  dispatch: (action: Action) => Promise<void>
): vscode.TreeDataProvider<Node> => {
  const elmListProvider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: treeChangeEmitter.event,
    getTreeItem(node: Node) {
      return toTreeItem(node);
    },
    async getChildren(node?: Node) {
      if (node == null) {
        return [
          addNewProfileButton,
          ...toServiceNodes(getLocations(getState())).sort((l, r) =>
            l.name.localeCompare(r.name)
          ),
        ];
      }
      if (
        node.type === 'ELEMENT_IN_PLACE' ||
        node.type === 'ELEMENT_UP_THE_MAP'
      ) {
        return []; // elements are leaf nodes and have no children
      }
      if (node.type === 'BUTTON_ADD_PROFILE') {
        return []; // buttons are leaf nodes and root at the same time, they don't have any children
      }
      /*
       * typescript's type inference is not able to handle
       * union discrimination in multiple switch cases at once
       * that's why the code bellow is repeated in all cases :-/
       */
      if (node.type === 'TYPE') {
        const children: Node[] = Array.from(node.elements.values()).sort(
          (l, r) => l.name.localeCompare(r.name)
        );
        children.unshift(node.map);
        return children;
      }
      if (node.type === 'SUB') {
        return Array.from(node.children.values()).sort((l, r) =>
          l.name.localeCompare(r.name)
        );
      }
      if (node.type === 'SYS') {
        return Array.from(node.children.values()).sort((l, r) =>
          l.name.localeCompare(r.name)
        );
      }
      if (node.type === 'MAP') {
        const mapArray = Array.from(node.elements.values()).sort((l, r) =>
          l.name.localeCompare(r.name)
        );
        if (mapArray.length == 0) {
          return [
            {
              type: 'EMPTY_MAP_NODE',
            },
          ];
        }
        return mapArray;
      }
      if (node.type === 'EMPTY_MAP_NODE') {
        return [];
      }
      if (node.type === 'SERVICE') {
        return node.children.sort((l, r) => l.name.localeCompare(r.name));
      }
      if (node.type === 'LOCATION') {
        const endevorService = await getService(node.serviceName);
        if (!endevorService) {
          return [];
        }
        const elementsSearchLocation = await getSearchLocation(
          node.serviceName,
          node.name
        );
        if (!elementsSearchLocation) {
          return [];
        }
        const cachedElements = getElements(getState())(node.serviceName)(
          node.name
        );
        const cachedEndevorMap = getEndevorMap(getState())(node.serviceName)(
          node.name
        );
        if (cachedElements.length && cachedEndevorMap) {
          return buildTree(
            node.serviceName,
            endevorService,
            node.name,
            elementsSearchLocation
          )(cachedEndevorMap)(cachedElements).sort((l, r) =>
            l.name.localeCompare(r.name)
          );
        }
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
              )(endevorService)(elementsSearchLocation.instance),
              getAllSystems(toSeveralTasksProgress(progress)(tasksNumber))(
                endevorService
              )(elementsSearchLocation.instance),
              getAllSubSystems(toSeveralTasksProgress(progress)(tasksNumber))(
                endevorService
              )(elementsSearchLocation.instance),
            ]);
          });
        if (isError(elements)) {
          const error = elements;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED,
            status: ElementsFetchingStatus.GENERIC_ERROR,
            error,
          });
          logger.error(
            'Unable to fetch any valid element from Endevor.',
            `${error.message}.`
          );
          return [];
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ELEMENTS_WERE_FETCHED,
          elementsAmount: elements.length,
        });
        if (isError(environmentStages)) {
          const error = environmentStages;
          logger.error(
            'Unable to fetch environments information from Endevor.',
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
            status: EndevorMapBuildingStatus.GENERIC_ERROR,
            error,
          });
          return [];
        }
        if (isError(systems)) {
          const error = systems;
          logger.error(
            'Unable to fetch systems information from Endevor.',
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
            status: EndevorMapBuildingStatus.GENERIC_ERROR,
            error,
          });
          return [];
        }
        if (isError(subsystems)) {
          const error = subsystems;
          logger.error(
            'Unable to fetch subsystems information from Endevor.',
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT,
            status: EndevorMapBuildingStatus.GENERIC_ERROR,
            error,
          });
          return [];
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
        const latestElementVersion = Date.now();
        const newSystems = buildTree(
          node.serviceName,
          endevorService,
          node.name,
          elementsSearchLocation
        )(endevorMap)(
          elements.map((element) => {
            return {
              element,
              lastRefreshTimestamp: latestElementVersion,
            };
          })
        ).sort((l, r) => l.name.localeCompare(r.name));
        await dispatch({
          type: Actions.ELEMENTS_FETCHED,
          elements,
          serviceName: node.serviceName,
          searchLocationName: node.name,
        });
        await dispatch({
          type: Actions.ENDEVOR_MAP_BUILT,
          serviceName: node.serviceName,
          searchLocationName: node.name,
          endevorMap,
        });
        return newSystems;
      }
      throw new UnreachableCaseError(node); // make sure we covered all node.type cases
    },
  };
  return elmListProvider;
};
