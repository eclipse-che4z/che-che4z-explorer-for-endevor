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
  EventEmitter,
  FileDecorationProvider,
  SourceControlResourceGroup,
  Uri,
} from 'vscode';
import {
  OriginalElementCacheVersion,
  ChangedElement,
  ChangedElements,
  WorkspaceElementType,
} from '../store/scm/_doc/Workspace';
import { toCachedElementUri } from '../uri/cachedElementUri';
import { Schemas } from '../_doc/Uri';
import { toFileExplorerChange, toScmProviderChange } from './scmRender';

export const scmTreeProvider =
  (
    scmGroupDescriptions: ReadonlyArray<{
      group: SourceControlResourceGroup;
      changeTypes: ReadonlyArray<WorkspaceElementType>;
    }>
  ) =>
  (actualChanges: () => ChangedElements): void => {
    scmGroupDescriptions.map((scmGroupDescription) => {
      scmGroupDescription.group.resourceStates = actualChanges()
        .filter((changedElement) =>
          scmGroupDescription.changeTypes.includes(changedElement.elementType)
        )
        .map((changedElement) => toScmProviderChange(changedElement));
    });
  };

export const makeQuickDiffProvider = (
  getChangeForFile: (elementUri: Uri) => OriginalElementCacheVersion | undefined
) => {
  return {
    async provideOriginalResource(uri: Uri) {
      const changedElement = getChangeForFile(uri);
      if (!changedElement) {
        return;
      }
      return toCachedElementUri(uri);
    },
  };
};

export const makeFileExplorerDecorationProvider = (
  fileExplorerChangeEmitter: EventEmitter<undefined>,
  getChangeForFile: (elementUri: Uri) => ChangedElement | undefined
): FileDecorationProvider => {
  return {
    onDidChangeFileDecorations: fileExplorerChangeEmitter.event,
    provideFileDecoration(fileUri: Uri) {
      if (fileUri.scheme === Schemas.READ_ONLY_CACHED_ELEMENT) return;
      const changedElement = getChangeForFile(fileUri);
      if (!changedElement) return;
      return toFileExplorerChange(changedElement);
    },
  };
};
