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

import { Uri, Event } from 'vscode';

export type WorkspaceFile = Readonly<{
  fileName: string;
  fileExtension?: string;
  workspaceDirectoryPath: string;
}>;

export enum TrackOptions {
  TRACK_ALL,
  TRACK_CHANGED,
  TRACK_CREATED,
  TRACK_DELETED,
}

export type FileSystemWatcher = {
  onDidCreate: Event<Uri>;
  onDidChange: Event<Uri>;
  onDidDelete: Event<Uri>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dispose(): any;
};

export interface SectionChange {
  readonly originalStartLineNumber: number;
  readonly originalEndLineNumber: number;
  readonly modifiedStartLineNumber: number;
  readonly modifiedEndLineNumber: number;
}
