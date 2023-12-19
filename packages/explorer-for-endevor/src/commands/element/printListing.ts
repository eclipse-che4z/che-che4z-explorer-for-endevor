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

import { ElementNode } from '../../tree/_doc/ElementTree';
import { window } from 'vscode';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { isError } from '../../utils';
import { toElementListingUri } from '../../uri/elementListingUri';
import { createEndevorLogger } from '../../logger';

type SelectedElementNode = Omit<ElementNode, 'parent' | 'type'>;

export const printListingCommand = async (elementNode: SelectedElementNode) => {
  const logger = createEndevorLogger({
    serviceId: elementNode.serviceId,
    searchLocationId: elementNode.searchLocationId,
  });
  const element = elementNode.element;
  logger.traceWithDetails(
    `Print listing command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name}.`
  );
  return withNotificationProgress(
    `Printing a listing for element ${elementNode.name} ...`
  )(async (progressReporter) => {
    const listingUri = toElementListingUri(elementNode)(elementNode.timestamp);
    if (isError(listingUri)) {
      const error = listingUri;
      logger.error(
        `Unable to print element ${elementNode.name} listing.`,
        `Unable to print element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name} listing because parsing of the element's URI failed with error ${error.message}.`
      );
      return error;
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
};
