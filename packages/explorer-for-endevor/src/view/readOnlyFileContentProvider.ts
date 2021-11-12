/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { getFileContent } from '@local/vscode-wrapper/workspace';
import { TextDecoder } from 'util';
import { Uri, CancellationToken, TextDocumentContentProvider } from 'vscode';
import { ENCODING } from '../constants';
import { logger } from '../globals';

export const readOnlyFileContentProvider: TextDocumentContentProvider = {
  async provideTextDocumentContent(
    fileUri: Uri,
    _token: CancellationToken
  ): Promise<string | undefined> {
    const filePath = fileUri.fsPath;
    try {
      const fileContent = await getFileContent(Uri.file(filePath));
      return new TextDecoder(ENCODING).decode(fileContent);
    } catch (error) {
      logger.error(
        `Cannot open read-only file: ${filePath}`,
        `Cannot open read-only file: ${filePath} because of: ${error.message}`
      );
      return;
    }
  },
};
