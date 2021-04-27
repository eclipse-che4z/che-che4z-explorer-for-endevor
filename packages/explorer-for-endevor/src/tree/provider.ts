/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
  Services,
  SystemNode,
} from '../_doc/ElementTree';
import { Element } from '@local/endevor/_doc/Endevor';
import { addNewProfileButton } from './buttons';
import { searchForElements } from '../endevor';
import { buildTree } from './endevor';
import { getEndevorServiceByName } from '../services/services';
import { getElementLocationByName } from '../element-locations/elementLocations';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { fromVirtualDocUri } from '../uri';
import { Action, Actions } from '../_doc/Actions';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from '../_doc/settings';
import { Credential } from '@local/endevor/_doc/Credential';
import { resolveCredential } from '../credentials/credentials';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { logger } from '../globals';

class ElementItem extends vscode.TreeItem {
  constructor(node: ElementNode) {
    super(node.name, vscode.TreeItemCollapsibleState.None);

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
    case 'SYS':
    case 'SUB':
    case 'TYPE':
      return new vscode.TreeItem(
        node.name,
        vscode.TreeItemCollapsibleState.Collapsed
      );
    case 'ELEMENT': {
      const elmNode = new ElementItem(node);
      elmNode.tooltip = makeElemTooltip(fromVirtualDocUri(node.uri).element);
      return elmNode;
    }
    default:
      throw new UnreachableCaseError(node);
  }
};

const toServiceNodes = (locations: ReadonlyArray<LocationConfig>): Services => {
  return locations.map((location) => ({
    type: 'SERVICE',
    name: location.service,
    children: location.elementLocations.map((elementLocation) => ({
      type: 'LOCATION',
      name: elementLocation,
      serviceName: location.service,
    })),
  }));
};

interface DataGetters {
  selectLocations: () => ReadonlyArray<LocationConfig>;
  selectSystems: (
    serviceName: EndevorServiceName,
    locationName: ElementLocationName
  ) => SystemNode[] | undefined;
  selectCredential: (serviceName: string) => Credential | undefined;
}

export const make = (
  treeChangeEmitter: vscode.EventEmitter<Node | null>,
  { selectLocations, selectSystems, selectCredential }: DataGetters,
  dispatch: (action: Action) => void
): vscode.TreeDataProvider<Node> => {
  const elmListProvider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: treeChangeEmitter.event,
    getTreeItem(node: Node) {
      return toTreeItem(node);
    },
    async getChildren(node?: Node) {
      if (node == null) {
        return [addNewProfileButton, ...toServiceNodes(selectLocations())];
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
        return Array.from(node.children.values());
      }
      if (node.type === 'SUB') {
        return Array.from(node.children.values());
      }
      if (node.type === 'SYS') {
        return Array.from(node.children.values());
      }
      if (node.type === 'SERVICE') {
        return node.children;
      }
      if (node.type === 'LOCATION') {
        // If we have fetched element list for before, get it from store
        const cachedSystems = selectSystems(node.serviceName, node.name);
        if (cachedSystems) return cachedSystems;

        // Otherwise go get it from endevor
        const endevorService = await getEndevorServiceByName(
          node.serviceName,
          resolveCredential(node.serviceName, selectCredential, dispatch)
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

        const elements = await withNotificationProgress(
          'Fetching elements'
        )((progress) =>
          searchForElements(progress)(endevorService)(elementsSearchLocation)
        );
        if (!elements.length) {
          logger.warn('Unable to fetch any valid element from Endevor');
          return [];
        }
        const newSystems = buildTree(
          endevorService,
          elementsSearchLocation,
          elements
        );
        dispatch({
          type: Actions.ELEMENT_TREE_ADDED,
          tree: {
            serviceName: node.serviceName,
            locationName: node.name,
            systems: newSystems,
          },
        });
        return newSystems;
      }
      throw new UnreachableCaseError(node); // make sure we covered all node.type cases
    },
  };
  return elmListProvider;
};
