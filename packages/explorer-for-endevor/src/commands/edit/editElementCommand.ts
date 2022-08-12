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
import * as vscode from 'vscode';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { isAutomaticSignOut } from '../../settings/settings';
import { editSingleElementWithSignout } from './editElementWithSignout';
import { editSingleElement } from './editElement';
import { Action } from '../../store/_doc/Actions';

type SelectedElementNode = ElementNode;

export type CommandContext = Readonly<{
  getTempEditFolderUri: () => vscode.Uri;
  dispatch: (action: Action) => Promise<void>;
}>;

export const editElementCommand =
  ({ getTempEditFolderUri, dispatch }: CommandContext) =>
  async (elementNode: SelectedElementNode) => {
    logger.trace(`Edit element command was called for ${elementNode.name}`);
    if (isAutomaticSignOut()) {
      await editSingleElementWithSignout(dispatch)(getTempEditFolderUri)(
        elementNode
      );
      return;
    }
    try {
      await editSingleElement(getTempEditFolderUri)(elementNode);
    } catch (e) {
      return;
    }
    return;
  };
