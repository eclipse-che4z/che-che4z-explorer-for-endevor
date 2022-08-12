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
import { Node } from './_doc/ServiceLocationTree';
import {
  addNewServiceButton,
  addNewSearchLocationButton,
  toServiceNodes,
  emptyMapNode,
} from './nodes';
import { buildTree } from './endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorCacheItem,
  EndevorId,
  EndevorServiceLocations,
} from '../store/_doc/v2/Store';
import { ElementSearchLocation, Service } from '@local/endevor/_doc/Endevor';
import { toTreeItem } from './render';
import { byTypeAndNameOrder } from '../utils';

interface DataGetters {
  getServiceLocations: () => EndevorServiceLocations;
  getService: (serviceId: EndevorId) => Promise<Service | undefined>;
  getSearchLocation: (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<ElementSearchLocation | undefined>;
  getEndevorCache: (
    serviceId: EndevorId
  ) => (searchLocationId: EndevorId) => Promise<EndevorCacheItem | undefined>;
}

export const make = (
  treeChangeEmitter: vscode.EventEmitter<Node | null>,
  dataGetters: DataGetters
): vscode.TreeDataProvider<Node> => {
  const elmListProvider: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: treeChangeEmitter.event,
    getTreeItem(node: Node) {
      return toTreeItem(node);
    },
    async getChildren(node?: Node) {
      if (!node) {
        const services = toServiceNodes(dataGetters.getServiceLocations()).sort(
          byTypeAndNameOrder
        );
        if (services.length) return services;
        return [addNewServiceButton];
      }
      switch (node.type) {
        case 'BUTTON_ADD_SERVICE':
        case 'BUTTON_ADD_SEARCH_LOCATION':
          return [];
        case 'SERVICE':
        case 'SERVICE_PROFILE': {
          const searchLocations = node.children.sort(byTypeAndNameOrder);
          if (searchLocations.length) return searchLocations;
          return [addNewSearchLocationButton(node)];
        }
        case 'SERVICE_PROFILE/INVALID':
          return node.children.sort(byTypeAndNameOrder);
        case 'LOCATION':
        case 'LOCATION_PROFILE': {
          const serviceId: EndevorId = {
            name: node.serviceName,
            source: node.serviceSource,
          };
          const searchLocationId: EndevorId = {
            name: node.name,
            source: node.source,
          };
          const endevorService = await dataGetters.getService(serviceId);
          if (!endevorService) {
            return [];
          }
          const elementsSearchLocation = await dataGetters.getSearchLocation(
            serviceId
          )(searchLocationId);
          if (!elementsSearchLocation) {
            return [];
          }
          const endevorCache = await dataGetters.getEndevorCache(serviceId)(
            searchLocationId
          );
          if (
            !endevorCache ||
            !endevorCache.endevorMap ||
            !endevorCache.elements
          ) {
            return [];
          }
          return buildTree(
            serviceId,
            endevorService,
            searchLocationId,
            elementsSearchLocation
          )(endevorCache.endevorMap)(Object.values(endevorCache.elements)).sort(
            (l, r) => l.name.localeCompare(r.name)
          );
        }
        case 'LOCATION_PROFILE/INVALID':
          return [];
        case 'SYS':
          return Array.from(node.children.values()).sort((l, r) =>
            l.name.localeCompare(r.name)
          );
        case 'SUB':
          return Array.from(node.children.values()).sort((l, r) =>
            l.name.localeCompare(r.name)
          );
        case 'TYPE':
          return [
            node.map,
            ...Array.from(node.elements.values()).sort((l, r) =>
              l.name.localeCompare(r.name)
            ),
          ];
        case 'MAP': {
          const elementUpTheMap = Array.from(node.elements.values()).sort(
            (l, r) => l.name.localeCompare(r.name)
          );
          if (elementUpTheMap.length) {
            return elementUpTheMap;
          }
          return [emptyMapNode];
        }
        case 'EMPTY_MAP_NODE':
          return [];
        case 'ELEMENT_IN_PLACE':
        case 'ELEMENT_UP_THE_MAP':
          return [];
        default:
          throw new UnreachableCaseError(node);
      }
    },
  };
  return elmListProvider;
};
