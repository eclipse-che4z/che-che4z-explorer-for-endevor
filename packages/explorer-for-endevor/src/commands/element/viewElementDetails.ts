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

import { logger, reporter } from '../../globals';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { renderElementAttributes } from '../../view/elementAttributes';
import { showWebView } from '@local/vscode-wrapper/window';
import { filterElementNodes } from '../../utils';
import { COMMAND_PREFIX } from '../../constants';
import {
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../../_doc/Telemetry';
import { Node } from '../../tree/_doc/ServiceLocationTree';

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
      elementsAmount: elementNodes.length,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
    });
    elementNodes.forEach((elementNode) => showElementAttributes(elementNode));
  } else if (elementNode) {
    logger.trace(
      `View element details command was called for ${elementNode.name}`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED,
      commandArguments: TreeElementCommandArguments.SINGLE_ELEMENT,
    });
    showElementAttributes(elementNode);
  }
};

const showElementAttributes = (elementNode: ElementNode): void => {
  const element = elementNode.element;
  const panelTitle = element.name + ' - Details';
  const panelBody = renderElementAttributes(element);
  showWebView(COMMAND_PREFIX)(panelTitle, panelBody);
};
