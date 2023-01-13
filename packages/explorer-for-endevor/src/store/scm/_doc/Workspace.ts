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

import { Element } from '@local/endevor/_doc/Endevor';
import { Uri } from 'vscode';

export type EndevorElement = Omit<Element, 'configuration' | 'lastActionCcid'>;

export const enum WorkspaceElementType {
  ELEMENT_ADDED = 'ELEMENT/ADDED',
  ELEMENT_REMOVED = 'ELEMENT/REMOVED',
  ELEMENT_MODIFIED = 'ELEMENT/MODIFIED',
  ELEMENT_SYNCED = 'ELEMENT/SYNCED',
  ELEMENT_CONFLICTED = 'ELEMENT/CONFLICTED',
}

export type AddedElement = Readonly<{
  elementType: WorkspaceElementType.ELEMENT_ADDED;
  element: EndevorElement;
  workspaceElementUri: Uri;
}>;

export type ElementCachedVersion = Readonly<{
  hashValue: string;
  hashFilePath: string;
}>;
export type RemovedElement = Readonly<{
  elementType: WorkspaceElementType.ELEMENT_REMOVED;
  element: EndevorElement;
  workspaceElementUri: Uri;
  originalCacheVersion: ElementCachedVersion;
}>;
export type ModifiedElement = Readonly<{
  elementType: WorkspaceElementType.ELEMENT_MODIFIED;
  element: EndevorElement;
  workspaceElementUri: Uri;
  originalCacheVersion: ElementCachedVersion;
}>;
export type NonConflictedChangedElement =
  | AddedElement
  | RemovedElement
  | ModifiedElement;
export type NonConflictedChangedElements =
  ReadonlyArray<NonConflictedChangedElement>;

export type ConflictedElement = Readonly<{
  elementType: WorkspaceElementType.ELEMENT_CONFLICTED;
  element: EndevorElement;
  workspaceElementUri: Uri;
  originalCacheVersion: ElementCachedVersion;
}>;
export type ChangedElement = NonConflictedChangedElement | ConflictedElement;
export type ChangedElements = ReadonlyArray<ChangedElement>;

export type SyncedElement = Readonly<{
  elementType: WorkspaceElementType.ELEMENT_SYNCED;
  element: EndevorElement;
  workspaceElementUri: Uri;
  originalCacheVersion: ElementCachedVersion;
}>;

export type WorkspaceElement = ChangedElement | SyncedElement;
export type WorkspaceElements = ReadonlyArray<WorkspaceElement>;

export type State = WorkspaceElements;

export const enum ScmStatus {
  UNKNOWN = 'unknown',
  INITIALIZED = 'initialized',
}

// public API

export type OriginalElementCacheVersion = Readonly<{
  workspaceElementUri: Uri;
  originalCacheVersion: ElementCachedVersion;
}>;
