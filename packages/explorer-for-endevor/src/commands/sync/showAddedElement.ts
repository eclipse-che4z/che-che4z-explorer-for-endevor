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

import * as vscode from 'vscode';
import { showFileContent } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';

export const showAddedElementCommand = async (elementUri: vscode.Uri) => {
  try {
    await showFileContent(elementUri);
  } catch (error) {
    logger.error(
      `Unable to open added element ${elementUri.path} content.`,
      `Unable to open added element ${elementUri.path} content because of error:\n${error.message}.`
    );
    return;
  }
};
