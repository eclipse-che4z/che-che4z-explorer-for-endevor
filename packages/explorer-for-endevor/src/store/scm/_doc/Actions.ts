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

export const enum SyncActions {
  ELEMENTS_UPDATED = 'ELEMENTS_UPDATED',
  WORKSPACE_META_UPDATED = 'WORKSPACE_META_UPDATED',
}

export type SyncElementsUpdated = Readonly<{
  type: SyncActions.ELEMENTS_UPDATED;
}>;

export type WorkspaceSynced = Readonly<{
  type: SyncActions.WORKSPACE_META_UPDATED;
}>;

export type SyncAction = SyncElementsUpdated | WorkspaceSynced;
