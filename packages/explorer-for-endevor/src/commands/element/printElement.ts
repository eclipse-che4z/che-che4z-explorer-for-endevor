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

import { showDocument as showElementContent } from '@local/vscode-wrapper/window';
import { getElementContent } from '../../view/elementContentProvider';
import { logger } from '../../globals';
import { toBasicElementUri } from '../../uri/basicElementUri';
import { isError } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';

export const printElement = async (elementNode: ElementNode) => {
  try {
    const elementUri = toBasicElementUri(elementNode)(elementNode.timestamp);
    if (isError(elementUri)) {
      const error = elementUri;
      const element = elementNode.element;
      logger.error(
        `Unable to print element ${elementNode.name}.`,
        `Unable to print element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    if (elementNode.element.noSource) {
      logger.warn(
        `No content printed because ${elementNode.element.name} is a sourceless element!`
      );
      return;
    }
    const elementContent = await getElementContent(elementUri);
    if (!elementContent.getText()) {
      return;
    }
    await showElementContent(elementContent);
  } catch (error) {
    return;
  }
};
