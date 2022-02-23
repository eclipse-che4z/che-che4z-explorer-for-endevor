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
import { ElementNode, Node } from '../_doc/ElementTree';
import { renderElementAttributes } from '../view/elementAttributes';
import { showWebView } from '@local/vscode-wrapper/window';
import { filterElementNodes, isError } from '../utils';
import { COMMAND_PREFIX } from '../constants';
import { fromTreeElementUri } from '../uri/treeElementUri';
import {
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const viewElementDetails = (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
): void => {
  if (nodes) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `View element details command was called for ${elementNodes
        .map((node) => node.name)
        .join(',')}`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
        elementsAmount: elementNodes.length,
      },
    });
    elementNodes.forEach((elementNode) => showElementAttributes(elementNode));
  } else if (elementNode) {
    logger.trace(
      `View element details command was called for ${elementNode.name}`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
    });
    showElementAttributes(elementNode);
  }
};

const showElementAttributes = (elementNode: ElementNode): void => {
  const uriParams = fromTreeElementUri(elementNode.uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to show the element ${elementNode.name} details.`,
      `Unable to show the element ${elementNode.name} details because of ${error.message}`
    );
    return;
  }
  const element = uriParams.element;
  const panelTitle = element.name + ' - Details';
  const panelBody = renderElementAttributes(element);
  showWebView(COMMAND_PREFIX)(panelTitle, panelBody);
};
