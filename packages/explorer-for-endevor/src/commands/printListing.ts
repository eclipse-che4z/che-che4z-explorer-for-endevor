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

import { logger, reporter } from '../globals';
import { ElementNode } from '../_doc/ElementTree';
import { window } from 'vscode';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { isError } from '@local/endevor/utils';
import { toElementListingUri } from '../uri/elementListingUri';
import { fromTreeElementUri } from '../uri/treeElementUri';
import {
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';

type SelectedElementNode = ElementNode;

export const printListingCommand = async (elementNode: SelectedElementNode) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED,
    commandArguments: {
      type: TreeElementCommandArguments.SINGLE_ELEMENT,
    },
  });
  logger.trace(`Print Listing command was called for ${elementNode.name}.`);
  return withNotificationProgress(
    `Printing element: ${elementNode.name} listing content`
  )(async (progressReporter) => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to print the element ${elementNode.name} listing.`,
        `Unable to print the element ${elementNode.name} listing because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    const listingUri = toElementListingUri(uriParams)(uriParams.fragment);
    if (isError(listingUri)) {
      const error = listingUri;
      logger.error(
        `Unable to print the element ${elementNode.name} listing.`,
        `Unable to print the element ${elementNode.name} listing because parsing of the element's URI failed with error ${error.message}.`
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
