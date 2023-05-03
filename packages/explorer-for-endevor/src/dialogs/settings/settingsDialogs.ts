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

import { showMessageWithOptions } from '@local/vscode-wrapper/window';

export const askToReloadWindowAfterSettingsChanged = () => {
  return showMessageWithOptions({
    message:
      'Reloading the window is required to apply the change of the settings. Do you want to do it now?',
    options: ['Reload the Window'],
  });
};
