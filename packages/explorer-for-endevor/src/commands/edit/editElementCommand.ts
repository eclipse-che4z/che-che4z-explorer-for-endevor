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

import { logger } from '../../globals';
import { ElementNode, Node } from '../../_doc/ElementTree';
import { filterElementNodes, groupBySearchLocationId } from '../../utils';
import { isAutomaticSignOut } from '../../settings/settings';
import { AUTOMATIC_SIGN_OUT_DEFAULT } from '../../constants';
import {
  editMultipleElementsWithSignout,
  editSingleElementWithSignout,
} from './editElementWithSignout';
import { editMultipleElements, editSingleElement } from './editElement';
import { Action } from '../../_doc/Actions';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const editElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes && nodes.length) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Edit element command was called for ${elementNodes
        .map((node) => node.name)
        .join(', ')}`
    );
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for automatic signout, the default ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead.`,
        `Reading settings error ${e.message}.`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
      const groupedElementNodes = groupBySearchLocationId(elementNodes);
      for (const elementNodesGroup of Object.values(groupedElementNodes)) {
        await editMultipleElementsWithSignout(dispatch)(elementNodesGroup);
      }
      return;
    }
    await editMultipleElements(elementNodes);
    return;
  } else if (elementNode) {
    logger.trace(`Edit element command was called for ${elementNode.name}`);
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for automatic signout, the default ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead.`,
        `Reading settings error: ${e.message}.`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
      await editSingleElementWithSignout(dispatch)(elementNode);
      return;
    }
    try {
      await editSingleElement(elementNode);
    } catch (e) {
      return;
    }
    return;
  } else {
    return;
  }
};
