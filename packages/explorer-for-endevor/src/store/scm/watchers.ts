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

import { createFileSystemWatcher } from '@local/vscode-wrapper/workspace';
import { TrackOptions } from '@local/vscode-wrapper/_doc/workspace';
import * as path from 'path';
import { Uri } from 'vscode';
import { SCM_LOCAL_DIR, SCM_METADATA_FILE } from '../../constants';
import {
  SyncActions,
  SyncElementsUpdated,
  WorkspaceSynced,
} from './_doc/Actions';

export const watchForWorkspaceChanges =
  (folderUri: Uri) =>
  (
    scmDispatch: (
      _action: SyncElementsUpdated | WorkspaceSynced
    ) => Promise<void>
  ) => {
    const withoutHiddenFolders = '/**';
    const syncedElementsGlob = `${folderUri.fsPath}${withoutHiddenFolders}`;
    const workspaceWatcher = createFileSystemWatcher(syncedElementsGlob)(
      TrackOptions.TRACK_ALL
    );
    const dispatch = updateScmTreeAfterWorkspaceChange(scmDispatch)(folderUri);
    workspaceWatcher.onDidChange(async (fileUri) => {
      await dispatch(fileUri);
    });
    workspaceWatcher.onDidCreate(async (fileUri) => {
      await dispatch(fileUri);
    });
    workspaceWatcher.onDidDelete(async (fileUri) => {
      await dispatch(fileUri);
    });
    return workspaceWatcher;
  };

const updateScmTreeAfterWorkspaceChange =
  (
    scmDispatch: (
      _action: SyncElementsUpdated | WorkspaceSynced
    ) => Promise<void>
  ) =>
  (folderUri: Uri) =>
  async (fileUri: Uri): Promise<void> => {
    const fileName = path.basename(fileUri.fsPath);
    const relativeFileDir = path.relative(
      folderUri.fsPath,
      path.dirname(fileUri.fsPath)
    );
    if (fileName === SCM_METADATA_FILE && relativeFileDir === SCM_LOCAL_DIR) {
      await scmDispatch({
        type: SyncActions.WORKSPACE_META_UPDATED,
      });
      return;
    }
    if (
      !relativeFileDir.startsWith(SCM_LOCAL_DIR) ||
      (relativeFileDir.startsWith(SCM_LOCAL_DIR) &&
        fileName === SCM_METADATA_FILE)
    ) {
      await scmDispatch({
        type: SyncActions.ELEMENTS_UPDATED,
      });
      return;
    }
  };
