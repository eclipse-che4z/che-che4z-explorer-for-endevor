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

import {
  WorkspaceElementType,
  State,
  OriginalElementCacheVersion,
  ChangedElement,
  ChangedElements,
  NonConflictedChangedElement,
} from './_doc/Workspace';
import { getWorkspaceState, isWorkspace } from './workspace';
import { isDefined, isError } from '../../utils';
import { logger } from '../../globals';
import { SyncAction, SyncActions } from './_doc/Actions';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Uri } from 'vscode';

export const make =
  (
    state: () => State,
    renderTree: (action?: SyncAction) => void,
    updateState: (state: State) => void
  ) =>
  async (folderUri: Uri) => {
    updateState(await fetchWorkspaceElementsReducer(state())(folderUri));
    renderTree();
    const dispatch = async (action: SyncAction): Promise<void> => {
      switch (action.type) {
        case SyncActions.ELEMENTS_UPDATED:
        case SyncActions.WORKSPACE_META_UPDATED:
          updateState(await fetchWorkspaceElementsReducer(state())(folderUri));
          renderTree(action);
          break;
        default:
          throw new UnreachableCaseError(action);
      }
    };
    return dispatch;
  };

const fetchWorkspaceElementsReducer =
  (initialState: State) =>
  async (folderUri: Uri): Promise<State> => {
    if (!isWorkspace(folderUri)) {
      logger.trace(
        `The workspace ${folderUri.fsPath} is not an endevor workspace.`
      );
      return { ...initialState, workspaceElements: [] };
    }
    const workspaceState = await getWorkspaceState(folderUri);
    if (isError(workspaceState)) {
      const error = workspaceState;
      logger.trace(
        `Unable to retrieve workspace state because of ${error.message}`
      );
      return { ...initialState, workspaceElements: [] };
    }
    return { ...initialState, workspaceElements: workspaceState };
  };

// public API

export const getNonConflictedWorkspaceChangeForFile =
  (state: () => State) =>
  (fileUri: Uri): NonConflictedChangedElement | undefined => {
    for (const workspaceElement of state().workspaceElements) {
      switch (workspaceElement.elementType) {
        case WorkspaceElementType.ELEMENT_ADDED:
        case WorkspaceElementType.ELEMENT_MODIFIED:
        case WorkspaceElementType.ELEMENT_REMOVED:
          if (workspaceElement.workspaceElementUri.fsPath === fileUri.fsPath) {
            return workspaceElement;
          }
          continue;
        case WorkspaceElementType.ELEMENT_CONFLICTED:
        case WorkspaceElementType.ELEMENT_SYNCED:
          continue;
        default:
          throw new UnreachableCaseError(workspaceElement);
      }
    }
    return;
  };

export const getWorkspaceChangeForFile =
  (state: () => State) =>
  (fileUri: Uri): ChangedElement | undefined => {
    for (const workspaceElement of state().workspaceElements) {
      switch (workspaceElement.elementType) {
        case WorkspaceElementType.ELEMENT_ADDED:
        case WorkspaceElementType.ELEMENT_MODIFIED:
        case WorkspaceElementType.ELEMENT_REMOVED:
        case WorkspaceElementType.ELEMENT_CONFLICTED:
          if (workspaceElement.workspaceElementUri.fsPath === fileUri.fsPath) {
            return workspaceElement;
          }
          continue;
        case WorkspaceElementType.ELEMENT_SYNCED:
          continue;
        default:
          throw new UnreachableCaseError(workspaceElement);
      }
    }
    return;
  };

export const getAllWorkspaceChanges = (state: () => State): ChangedElements => {
  return state()
    .workspaceElements.map((workspaceElement) => {
      switch (workspaceElement.elementType) {
        case WorkspaceElementType.ELEMENT_ADDED:
        case WorkspaceElementType.ELEMENT_MODIFIED:
        case WorkspaceElementType.ELEMENT_REMOVED:
        case WorkspaceElementType.ELEMENT_CONFLICTED:
          return workspaceElement;
        case WorkspaceElementType.ELEMENT_SYNCED:
          return undefined;
        default:
          throw new UnreachableCaseError(workspaceElement);
      }
    })
    .filter(isDefined);
};

export const getElementOriginalVersions = (
  state: () => State
): ReadonlyArray<OriginalElementCacheVersion> => {
  return state()
    .workspaceElements.map((workspaceElement) => {
      switch (workspaceElement.elementType) {
        case WorkspaceElementType.ELEMENT_SYNCED:
        case WorkspaceElementType.ELEMENT_MODIFIED:
        case WorkspaceElementType.ELEMENT_REMOVED:
          return workspaceElement;
        case WorkspaceElementType.ELEMENT_CONFLICTED:
        case WorkspaceElementType.ELEMENT_ADDED:
          return undefined;
        default:
          throw new UnreachableCaseError(workspaceElement);
      }
    })
    .filter(isDefined);
};

export const getElementOriginalVersionForFile =
  (state: () => State) =>
  (fileUri: Uri): OriginalElementCacheVersion | undefined => {
    for (const workspaceElement of state().workspaceElements) {
      switch (workspaceElement.elementType) {
        case WorkspaceElementType.ELEMENT_SYNCED:
        case WorkspaceElementType.ELEMENT_MODIFIED:
        case WorkspaceElementType.ELEMENT_REMOVED:
          if (workspaceElement.workspaceElementUri.fsPath === fileUri.fsPath) {
            return workspaceElement;
          }
          continue;
        case WorkspaceElementType.ELEMENT_CONFLICTED:
        case WorkspaceElementType.ELEMENT_ADDED:
          continue;
        default:
          throw new UnreachableCaseError(workspaceElement);
      }
    }
    return;
  };
