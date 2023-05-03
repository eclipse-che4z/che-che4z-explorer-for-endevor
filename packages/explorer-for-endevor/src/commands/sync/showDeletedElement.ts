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

import { showFileContent } from '@local/vscode-wrapper/window';
import { logger } from '../../globals';
import { toCachedElementUri } from '../../uri/cachedElementUri';
import { Uri } from 'vscode';
import path = require('path');

export const showDeletedElementCommand = async (elementUri: Uri) => {
  try {
    const cachedElementUri = toCachedElementUri(elementUri);
    const fileName = path.basename(cachedElementUri.fsPath);
    await showFileContent(cachedElementUri, `${fileName} (Deleted)`);
  } catch (error) {
    logger.error(
      `Unable to open deleted element ${elementUri.path} content.`,
      `Unable to open deleted element ${elementUri.path} content because of error:\n${error.message}.`
    );
    return;
  }
};
