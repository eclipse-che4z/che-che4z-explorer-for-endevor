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
import { renderElementAttributes } from '../../view/elementAttributes';
import { showWebView } from '@local/vscode-wrapper/window';
import { filterElementNodes } from '../../utils';
import { COMMAND_PREFIX } from '../../constants';
import { Node } from '../../tree/_doc/ServiceLocationTree';
import { createEndevorLogger } from '../../logger';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const viewElementDetails = (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
): void => {
  const logger = createEndevorLogger();
  if (nodes) {
    const elementNodes = filterElementNodes(nodes);
    logger.traceWithDetails(
      `View element details command was called for ${elementNodes
        .map((node) => {
          const element = node.element;
          return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${node.name}`;
        })
        .join(',\n ')}`
    );
    elementNodes.forEach((elementNode) => showElementAttributes(elementNode));
  } else if (elementNode) {
    logger.updateContext({
      serviceId: elementNode.serviceId,
      searchLocationId: elementNode.searchLocationId,
    });
    const element = elementNode.element;
    logger.traceWithDetails(
      `View element details command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name}`
    );
    showElementAttributes(elementNode);
  }
};

const showElementAttributes = (elementNode: ElementNode): void => {
  const element = elementNode.element;
  const panelTitle = element.name + ' - Details';
  const warningMessage = elementNode.outOfDate
    ? 'Element details may be out of date. Refresh the tree to get the latest information.'
    : undefined;
  const panelBody = renderElementAttributes(element, warningMessage);
  showWebView(COMMAND_PREFIX)(panelTitle, panelBody);
};
