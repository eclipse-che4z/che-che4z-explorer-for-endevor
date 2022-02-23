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
import { Element } from '@local/endevor/_doc/Endevor';
import { addNewProfileButton } from './buttons';
import { searchForElements } from '../endevor';
import { buildTree, toServiceNodes } from './endevor';
import { getEndevorServiceByName } from '../services/services';
import { getElementLocationByName } from '../element-locations/elementLocations';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Action, Actions } from '../_doc/Actions';
import { resolveCredential } from '../credentials/credentials';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { logger, reporter } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { getCredential, getElements, getLocations } from '../store/store';
import { State } from '../_doc/Store';
import { ElementsFetchingStatus, TelemetryEvents } from '../_doc/Telemetry';

class ElementItem extends vscode.TreeItem {
  constructor(node: ElementNode) {
    super(node.name, vscode.TreeItemCollapsibleState.None);

    this.id = node.id;

    this.resourceUri = node.uri;
    this.contextValue = 'ELEMENT_TYPE';

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
    case 'ELEMENT': {
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
    case 'EMPY_MAP_NODE':
      return new EmptyMapItem();
    default:
      throw new UnreachableCaseError(node);
  }
};

interface DataGetters {
  getState: () => State;
}

export const make = (
  treeChangeEmitter: vscode.EventEmitter<Node | null>,
  { getState }: DataGetters,
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
          ...toServiceNodes(getLocations(getState())),
        ];
      }
      if (node.type === 'ELEMENT') {
        return []; // elemetns are leaf nodes and have no children
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
        const children: Node[] = Array.from(node.elements.values());
        children.unshift(node.map);
        return children;
      }
      if (node.type === 'SUB') {
        return Array.from(node.children.values()).sort((l, r) =>
          l.name.localeCompare(r.name)
        );
      }
      if (node.type === 'SYS') {
        return Array.from(node.children.values());
      }
      if (node.type === 'MAP') {
        const mapArray = Array.from(node.elements.values());
        if (mapArray.length == 0) {
          return [
            {
              type: 'EMPY_MAP_NODE',
            },
          ];
        }
        return mapArray;
      }
      if (node.type === 'EMPY_MAP_NODE') {
        return [];
      }
      if (node.type === 'SERVICE') {
        return node.children;
      }
      if (node.type === 'LOCATION') {
        const endevorService = await getEndevorServiceByName(
          node.serviceName,
          resolveCredential(
            node.serviceName,
            getCredential(getState()),
            dispatch
          )
        );
        if (!endevorService) {
          return [];
        }
        const elementsSearchLocation = await getElementLocationByName(
          node.name
        );
        if (!elementsSearchLocation) {
          return [];
        }
        const cachedElements = getElements(getState())(node.serviceName)(
          node.name
        );
        if (cachedElements.length) {
          return buildTree(
            node.serviceName,
            endevorService,
            node.name,
            elementsSearchLocation,
            cachedElements
          );
        }
        const elements = await withNotificationProgress('Fetching elements')(
          (progress) =>
            searchForElements(progress)(endevorService)(elementsSearchLocation)
        );
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
        const latestElementVersion = Date.now();
        const newSystems = buildTree(
          node.serviceName,
          endevorService,
          node.name,
          elementsSearchLocation,
          elements.map((element) => {
            return {
              element,
              lastRefreshTimestamp: latestElementVersion,
            };
          })
        );
        await dispatch({
          type: Actions.ELEMENTS_FETCHED,
          elements,
          serviceName: node.serviceName,
          searchLocationName: node.name,
        });
        return newSystems;
      }
      throw new UnreachableCaseError(node); // make sure we covered all node.type cases
    },
  };
  return elmListProvider;
};
