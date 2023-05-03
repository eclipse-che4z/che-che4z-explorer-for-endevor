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

import { Uri, TextDocumentContentProvider, Event } from 'vscode';
import { CacheUtils } from '@broadcom/endevor-for-zowe-cli/lib/api/workspace/CacheUtils';
import { BUFFER_ENCODING } from '../constants';
import { OriginalElementCacheVersion } from '../store/scm/_doc/Workspace';

export const cachedElementContentProvider: (
  getChangeForFile: (
    elementUri: Uri
  ) => OriginalElementCacheVersion | undefined,
  onDidChange?: Event<Uri>
) => TextDocumentContentProvider = (
  getChangeForFile: (
    elementUri: Uri
  ) => OriginalElementCacheVersion | undefined,
  onDidChange?: Event<Uri>
) => {
  return {
    onDidChange,
    async provideTextDocumentContent(
      cachedElementUri: Uri
    ): Promise<string | undefined> {
      const changedFile = getChangeForFile(cachedElementUri);
      if (!changedFile) return;
      const cachedElementContent = CacheUtils.readSha1File({
        sha1: changedFile.originalCacheVersion.hashValue,
        sha1File: changedFile.originalCacheVersion.hashFilePath,
      });
      return cachedElementContent.toString(BUFFER_ENCODING);
    },
  };
};
