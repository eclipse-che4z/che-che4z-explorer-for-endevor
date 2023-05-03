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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { FileDecoration, SourceControlResourceState, ThemeColor } from 'vscode';
import { CommandId } from '../commands/id';
import {
  SCM_RESOURCE_ADDED_COLOR,
  SCM_RESOURCE_ADDED_LETTER,
  SCM_RESOURCE_ADDED_TOOLTIP,
  SCM_RESOURCE_CONFLICTED_COLOR,
  SCM_RESOURCE_CONFLICTED_LETTER,
  SCM_RESOURCE_CONFLICTED_TOOLTIP,
  SCM_RESOURCE_DELETED_COLOR,
  SCM_RESOURCE_DELETED_LETTER,
  SCM_RESOURCE_DELETED_TOOLTIP,
  SCM_RESOURCE_MODIFIED_COLOR,
  SCM_RESOURCE_MODIFIED_LETTER,
  SCM_RESOURCE_MODIFIED_TOOLTIP,
} from '../constants';
import {
  ChangedElement,
  WorkspaceElementType,
} from '../store/scm/_doc/Workspace';

export const toScmProviderChange = (
  changedElement: ChangedElement
): SourceControlResourceState => {
  const changeType = changedElement.elementType;
  switch (changeType) {
    case WorkspaceElementType.ELEMENT_ADDED:
      return {
        resourceUri: changedElement.workspaceElementUri,
        contextValue: changedElement.elementType,
        command: {
          title: 'Show Added Element',
          command: CommandId.SHOW_ADDED_ELEMENT,
          arguments: [changedElement.workspaceElementUri],
        },
      };

    case WorkspaceElementType.ELEMENT_REMOVED:
      return {
        resourceUri: changedElement.workspaceElementUri,
        contextValue: changedElement.elementType,
        command: {
          title: 'Show Deleted Element',
          command: CommandId.SHOW_DELETED_ELEMENT,
          arguments: [changedElement.workspaceElementUri],
        },
        decorations: {
          strikeThrough: true,
        },
      };
    case WorkspaceElementType.ELEMENT_MODIFIED:
      return {
        resourceUri: changedElement.workspaceElementUri,
        contextValue: changedElement.elementType,
        command: {
          title: 'Show Modified Element',
          command: CommandId.SHOW_MODIFIED_ELEMENT,
          arguments: [changedElement.workspaceElementUri],
        },
      };
    case WorkspaceElementType.ELEMENT_CONFLICTED:
      return {
        resourceUri: changedElement.workspaceElementUri,
        contextValue: changedElement.elementType,
        command: {
          title: 'Show Conflicted Element',
          command: CommandId.SHOW_CONFLICTED_ELEMENT,
          arguments: [changedElement.workspaceElementUri],
        },
      };
    default:
      throw new UnreachableCaseError(changeType);
  }
};

export const toFileExplorerChange = (
  changedElement: ChangedElement
): FileDecoration | undefined => {
  if (!changedElement) return;
  const changeType = changedElement.elementType;
  switch (changeType) {
    case WorkspaceElementType.ELEMENT_ADDED: {
      const fileDecoration = new FileDecoration(
        SCM_RESOURCE_ADDED_LETTER,
        SCM_RESOURCE_ADDED_TOOLTIP,
        new ThemeColor(SCM_RESOURCE_ADDED_COLOR)
      );
      fileDecoration.propagate = true;
      return fileDecoration;
    }
    case WorkspaceElementType.ELEMENT_MODIFIED: {
      const fileDecoration = new FileDecoration(
        SCM_RESOURCE_MODIFIED_LETTER,
        SCM_RESOURCE_MODIFIED_TOOLTIP,
        new ThemeColor(SCM_RESOURCE_MODIFIED_COLOR)
      );
      fileDecoration.propagate = true;
      return fileDecoration;
    }
    case WorkspaceElementType.ELEMENT_CONFLICTED: {
      const fileDecoration = new FileDecoration(
        SCM_RESOURCE_CONFLICTED_LETTER,
        SCM_RESOURCE_CONFLICTED_TOOLTIP,
        new ThemeColor(SCM_RESOURCE_CONFLICTED_COLOR)
      );
      fileDecoration.propagate = true;
      return fileDecoration;
    }
    case WorkspaceElementType.ELEMENT_REMOVED: {
      const fileDecoration = new FileDecoration(
        SCM_RESOURCE_DELETED_LETTER,
        SCM_RESOURCE_DELETED_TOOLTIP,
        new ThemeColor(SCM_RESOURCE_DELETED_COLOR)
      );
      return fileDecoration;
    }
    default:
      throw new UnreachableCaseError(changeType);
  }
};
