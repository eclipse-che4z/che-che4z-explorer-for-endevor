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

import { showVscodeQuickPick } from '@local/vscode-wrapper/window';
import { ElementHistoryData } from '../tree/_doc/ChangesTree';
import { CancellationTokenSource } from 'vscode';
import { getDescriptionFromChangeNode } from '../utils';

export const askForCompareWithChangeLevel = async (
  currentVvll: string,
  historyData?: ElementHistoryData
): Promise<string | undefined> => {
  const quickPickItems = historyData?.changeLevels
    ?.filter((changeLevel) => changeLevel.vvll !== currentVvll)
    .map((changeLevel) => ({
      label: changeLevel.vvll,
      description: getDescriptionFromChangeNode(changeLevel),
    }));
  if (!quickPickItems?.length) {
    return;
  }
  const tokenSource = new CancellationTokenSource();
  const choice = await showVscodeQuickPick(
    quickPickItems,
    {
      title: `Select change level to compare with ${currentVvll}`,
      placeHolder: 'Start typing to filter...',
      ignoreFocusOut: true,
      canPickMany: false,
    },
    tokenSource.token
  );
  return choice?.label;
};
