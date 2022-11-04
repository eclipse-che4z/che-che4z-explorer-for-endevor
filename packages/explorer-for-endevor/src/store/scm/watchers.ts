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

import { createFileSystemWatcher } from '@local/vscode-wrapper/workspace';
import { TrackOptions } from '@local/vscode-wrapper/_doc/workspace';
import { Uri } from 'vscode';
import {
  SyncActions,
  SyncElementsUpdated,
  WorkspaceSynced,
} from './_doc/Actions';

export const watchForFiles =
  (folderUri: Uri) =>
  (scmDispatch: (_action: SyncElementsUpdated) => Promise<void>) => {
    const withoutHiddenFolders = '/[!.]*/**';
    const syncedElementsGlob = `${folderUri.fsPath}${withoutHiddenFolders}`;
    const workspaceWatcher = createFileSystemWatcher(syncedElementsGlob)(
      TrackOptions.TRACK_ALL
    );
    workspaceWatcher.onDidChange(async () => {
      await scmDispatch({
        type: SyncActions.SYNC_ELEMENTS_UPDATED,
      });
    });
    workspaceWatcher.onDidCreate(async () => {
      await scmDispatch({
        type: SyncActions.SYNC_ELEMENTS_UPDATED,
      });
    });
    workspaceWatcher.onDidDelete(async () => {
      await scmDispatch({
        type: SyncActions.SYNC_ELEMENTS_UPDATED,
      });
    });
    return workspaceWatcher;
  };

export const watchForMetadataChanges =
  (folderUri: Uri) =>
  (scmDispatch: (_action: WorkspaceSynced) => Promise<void>) => {
    const metadataFilePath = '/.endevor/**/metadata.json';
    const metadataFileGlob = `${folderUri.fsPath}${metadataFilePath}`;
    const watcher = createFileSystemWatcher(metadataFileGlob)(
      TrackOptions.TRACK_CHANGED
    );
    watcher.onDidChange(async () => {
      await scmDispatch({
        type: SyncActions.WORKSPACE_SYNCED,
      });
    });
    return watcher;
  };
