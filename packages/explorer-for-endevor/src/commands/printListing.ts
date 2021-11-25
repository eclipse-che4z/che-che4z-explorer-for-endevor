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

import { logger } from '../globals';
import { filterElementNodes } from '../utils';
import { ElementNode, Node } from '../_doc/ElementTree';
import { window } from 'vscode';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../constants';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import { getMaxParallelRequests } from '../settings/settings';
import { isError } from '@local/endevor/utils';
import { toElementListingUri } from '../uri/elementListingUri';
import { fromTreeElementUri } from '../uri/treeElementUri';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const printListingCommand = async (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Print listing command was called for ${elementNodes
        .map((node) => node.name)
        .join(',')}`
    );
    let endevorMaxRequestsNumber: number;
    try {
      endevorMaxRequestsNumber = getMaxParallelRequests();
    } catch (e) {
      logger.warn(
        `Cannot read settings value for endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead`,
        `Reading settings error: ${e.message}`
      );
      endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
    }
    const overallProgress = 100;
    const progressPerListing = overallProgress / elementNodes.length;
    const printedElements = await withNotificationProgress(
      `Printing elements: ${elementNodes
        .map((node) => node.name)
        .join(',')} listing content`
    )((progressReporter) => {
      return new PromisePool(
        elementNodes
          .map((elementNode) => fromTreeElementUri(elementNode.uri))
          .map((uriParams) => {
            if (isError(uriParams)) {
              const error = uriParams;
              logger.trace(
                `Unable to print element listing, because of: ${error.message}`
              );
              return new Error(`Unable to print element listing`);
            }
            const lastRefreshTimestamp = uriParams.fragment;
            const listingUri =
              toElementListingUri(uriParams)(lastRefreshTimestamp);
            if (isError(listingUri)) {
              const error = listingUri;
              logger.trace(
                `Unable to print element: ${uriParams.element.name} listing, because of ${error.message}`
              );
              return new Error(
                `Unable to print element: ${uriParams.element.name} listing`
              );
            }
            return listingUri;
          })
          .map((listingUri) => async () => {
            if (isError(listingUri)) {
              const error = listingUri;
              return error;
            }
            try {
              await window.showTextDocument(listingUri);
              progressReporter.report({
                increment: progressPerListing,
              });
            } catch (error) {
              progressReporter.report({
                increment: progressPerListing,
              });
              return error;
            }
          }),
        {
          concurrency: endevorMaxRequestsNumber,
        }
      ).start();
    });
    const errors = printedElements.filter(isError);
    if (errors.length) {
      logger.error(`Unable to print some elements listings`);
    }
    return;
  } else if (elementNode) {
    logger.trace(`Print Listing command was called for ${elementNode.name}`);
    const result = await withNotificationProgress(
      `Printing element: ${elementNode.name} listing content`
    )(async (progressReporter) => {
      const uriParams = fromTreeElementUri(elementNode.uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print element: ${elementNode.name} listing`,
          `Unable to print element: ${elementNode.name} listing, because of ${error.message}`
        );
        return;
      }
      const listingUri = toElementListingUri(uriParams)(uriParams.fragment);
      if (isError(listingUri)) {
        const error = listingUri;
        logger.error(
          `Unable to print element: ${elementNode.name} listing`,
          `Unable to print element: ${elementNode.name} listing, because of ${error.message}`
        );
        return;
      }
      progressReporter.report({ increment: 50 });
      try {
        await window.showTextDocument(listingUri);
        progressReporter.report({ increment: 100 });
      } catch (error) {
        progressReporter.report({ increment: 100 });
        return error;
      }
    });
    if (isError(result)) {
      logger.error(`Unable to print element: ${elementNode.name} listing`);
      return;
    }
    return result;
  }
};
