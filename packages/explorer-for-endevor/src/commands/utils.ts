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

import { toServiceLocationCompositeKey } from '../store/utils';
import { ElementNode } from '../tree/_doc/ElementTree';
import { Uri } from 'vscode';
import { showFileContent } from '@local/vscode-wrapper/window';

type GroupedElementNodes = {
  [searchLocationId: string]: ReadonlyArray<ElementNode>;
};
export const groupBySearchLocationId = (
  elementNodes: ReadonlyArray<ElementNode>
): Readonly<GroupedElementNodes> => {
  return elementNodes.reduce((acc: GroupedElementNodes, currentNode) => {
    const serviceLocationId = toServiceLocationCompositeKey(
      currentNode.serviceId
    )(currentNode.searchLocationId);
    acc[serviceLocationId] = [...(acc[serviceLocationId] || []), currentNode];
    return acc;
  }, {});
};

export const showElementToEdit = async (
  fileUri: Uri
): Promise<void | Error> => {
  try {
    await showFileContent(fileUri);
  } catch (e) {
    return new Error(
      `Unable to open the file ${fileUri.fsPath} because of error ${e.message}`
    );
  }
};
