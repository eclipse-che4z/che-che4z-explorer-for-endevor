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

import {
  focusOnView,
  showMessageWithOptions,
} from '@local/vscode-wrapper/window';
import { SCM_VIEW_ID } from '../../constants';
import { logger } from '../../globals';

export const showConflictResolutionRequiredMessage = async (
  elementNames: ReadonlyArray<string>
): Promise<void> => {
  logger.trace(`Prompt for the conflict resolution required.`);
  const goToScmViewOption = 'Go to Source Control';
  const messageResult = await showMessageWithOptions({
    message: `Merge conflicts were detected for some elements: ${elementNames.join(
      ', '
    )}. Provide resolutions for them manually and retry the workspace synchronization.`,
    options: [goToScmViewOption],
  });
  if (messageResult === goToScmViewOption) {
    logger.trace(`Switch to SCM view was selected.`);
    await focusOnView(SCM_VIEW_ID);
  }
};
