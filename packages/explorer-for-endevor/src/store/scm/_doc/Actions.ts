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

import { Uri } from 'vscode';

export const enum SyncActions {
  SYNC_ELEMENTS_UPDATED = 'SYNC_ELEMENTS/UPDATED',
  WORKSPACE_SYNCED = 'WORKSPACE/SYNCED',
  WORKSPACE_SYNCED_ONEWAY = 'WORKSPACE/SYNCED_ONEWAY',
  SYNC_ELEMENTS_DISCARDED = 'SYNC_ELEMENTS/DISCARDED',
}

export type SyncElementsUpdated = Readonly<{
  type: SyncActions.SYNC_ELEMENTS_UPDATED;
}>;

export type ElementsChangesDiscarded = Readonly<{
  type: SyncActions.SYNC_ELEMENTS_DISCARDED;
  discardedWorkspaceElementUris: Uri[];
}>;

export type WorkspaceSynced = Readonly<{
  type: SyncActions.WORKSPACE_SYNCED;
}>;

export type WorkspaceSyncedOneWay = Readonly<{
  type: SyncActions.WORKSPACE_SYNCED_ONEWAY;
}>;

export type SyncAction =
  | SyncElementsUpdated
  | ElementsChangesDiscarded
  | WorkspaceSynced
  | WorkspaceSyncedOneWay;
