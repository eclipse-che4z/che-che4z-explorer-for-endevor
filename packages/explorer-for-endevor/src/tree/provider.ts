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
  addNewSearchLocationButton,
  toServiceNodes,
  emptyMapNode,
} from './nodes';
import { buildTree } from './endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorCacheItem,
  EndevorConfiguration,
  EndevorConnection,
  EndevorCredential,
  EndevorId,
  EndevorServiceLocations,
} from '../store/_doc/v2/Store';
import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
import { toTreeItem } from './render';
import { byNameOrder } from '../utils';

interface DataGetters {
  getServiceLocations: () => EndevorServiceLocations;
  getConnectionDetails: (
    id: EndevorId
  ) => Promise<EndevorConnection | undefined>;
  getCredential: (
    credentialId: EndevorId
  ) => Promise<EndevorCredential | undefined>;
  getSearchLocation: (
    searchLocationId: EndevorId
  ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>;
  getEndevorConfiguration: (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ) => Promise<EndevorConfiguration | undefined>;
  getEndevorCache: (
    connection: EndevorConnection,
    configuration: EndevorConfiguration,
    credential: EndevorCredential,
    elementsSearchLocation: Omit<ElementSearchLocation, 'configuration'>
  ) => (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) =>
    | EndevorCacheItem
    | undefined
    | Readonly<{
        pendingTask: Promise<undefined>;
        outdatedCacheValue: Omit<EndevorCacheItem, 'cacheVersion'> | undefined;
      }>;
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
        return toServiceNodes(dataGetters.getServiceLocations()).sort(
          byNameOrder
        );
      }
      switch (node.type) {
        case 'BUTTON_ADD_SEARCH_LOCATION':
          return [];
        case 'SERVICE':
        case 'SERVICE_PROFILE': {
          const searchLocations = node.children.sort(byNameOrder);
          if (searchLocations.length) return searchLocations;
          return [addNewSearchLocationButton(node)];
        }
        case 'SERVICE_PROFILE/NON_EXISTING':
        case 'SERVICE/NON_EXISTING':
        case 'SERVICE_PROFILE/INVALID_CONNECTION':
        case 'SERVICE/INVALID_CONNECTION':
        case 'SERVICE_PROFILE/INVALID_CREDENTIALS':
        case 'SERVICE/INVALID_CREDENTIALS':
          return node.children.sort(byNameOrder);
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
          const connectionDetails = await dataGetters.getConnectionDetails(
            serviceId
          );
          if (!connectionDetails) return [];
          const configuration = await dataGetters.getEndevorConfiguration(
            serviceId,
            searchLocationId
          );
          if (!configuration) return [];
          const credential = await dataGetters.getCredential(serviceId);
          if (!credential) return [];
          const elementsSearchLocation = await dataGetters.getSearchLocation(
            searchLocationId
          );
          if (!elementsSearchLocation) return [];
          const endevorCache = dataGetters.getEndevorCache(
            connectionDetails,
            configuration,
            credential,
            elementsSearchLocation
          )(serviceId, searchLocationId);
          if (!endevorCache) return [];
          // acts like a React effect:
          //    get data from a cache (if available) and render it immediately
          //    or
          //    render with default value and fetch the actual data from REST API with the following rerender afterwards
          const isEndevorCacheItem = <T>(
            value: EndevorCacheItem | T
          ): value is EndevorCacheItem => {
            return 'elements' in value;
          };
          if (isEndevorCacheItem(endevorCache)) {
            if (!endevorCache.elements || !endevorCache.endevorMap) return [];
            return buildTree(
              serviceId,
              {
                ...connectionDetails.value,
                credential: credential.value,
              },
              searchLocationId,
              {
                configuration,
                ...elementsSearchLocation,
              }
            )(endevorCache.endevorMap)(
              Object.values(endevorCache.elements)
            ).sort(byNameOrder);
          }
          await endevorCache.pendingTask;
          const outdatedCacheValue = endevorCache.outdatedCacheValue;
          if (!outdatedCacheValue?.elements || !outdatedCacheValue?.endevorMap)
            return [];
          return buildTree(
            serviceId,
            {
              ...connectionDetails.value,
              credential: credential.value,
            },
            searchLocationId,
            {
              configuration,
              ...elementsSearchLocation,
            }
          )(outdatedCacheValue.endevorMap)(
            Object.values(outdatedCacheValue.elements)
          ).sort(byNameOrder);
        }
        case 'LOCATION_PROFILE/NON_EXISTING':
        case 'LOCATION/NON_EXISTING':
        case 'LOCATION_PROFILE/INVALID_CONNECTION':
        case 'LOCATION/INVALID_CONNECTION':
        case 'LOCATION_PROFILE/INVALID_CREDENTIALS':
        case 'LOCATION/INVALID_CREDENTIALS':
          return [];
        case 'SYS':
          return Array.from(node.children.values()).sort(byNameOrder);
        case 'SUB':
          return Array.from(node.children.values()).sort(byNameOrder);
        case 'TYPE':
          return [
            node.map,
            ...Array.from(node.elements.values()).sort(byNameOrder),
          ];
        case 'MAP': {
          const elementUpTheMap = Array.from(node.elements.values()).sort(
            byNameOrder
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
