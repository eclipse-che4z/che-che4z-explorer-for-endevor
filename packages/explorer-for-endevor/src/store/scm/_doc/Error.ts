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
import { EndevorElement } from './Workspace';

export const enum WorkspaceResponseStatus {
  NO_CHANGES = 'NO_CHANGES',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  CONFLICT = 'CONFLICT',
  ERROR = 'ERROR',
}

export const enum WorkspaceOperation {
  RETRIEVE = 'retrieve',
  UPDATE = 'update',
  CONFLICT = 'conflict resolution',
  LOCAL_DELETE = 'local delete',
  REMOTE_DELETE = 'remote delete',
}

export type WorkspaceElementErrorInfo = {
  errorMessages: ReadonlyArray<string>;
  element: EndevorElement;
  fileUri: Uri;
  operation: WorkspaceOperation;
};
export type WorkspaceElementErrorDetails = Array<WorkspaceElementErrorInfo>;

export type WorkspaceSyncErrorResponse = {
  status: WorkspaceResponseStatus.ERROR;
  messages: ReadonlyArray<string>;
  errorDetails: WorkspaceElementErrorDetails;
};

export type WorkspaceElementConflictInfo = {
  element: EndevorElement;
  fileUri: Uri;
};
export type WorkspaceElementConflictDetails =
  Array<WorkspaceElementConflictInfo>;

export type WorkspaceSyncConflictResponse = {
  status: WorkspaceResponseStatus.CONFLICT;
  messages: ReadonlyArray<string>;
  conflictDetails: WorkspaceElementConflictDetails;
};

export type WorkspaceSyncResponse =
  | {
      status:
        | WorkspaceResponseStatus.NO_CHANGES
        | WorkspaceResponseStatus.SUCCESS
        | WorkspaceResponseStatus.WARNING;
      messages: ReadonlyArray<string>;
    }
  | WorkspaceSyncConflictResponse
  | WorkspaceSyncErrorResponse;

export type WorkspaceResponse = {
  status:
    | WorkspaceResponseStatus.SUCCESS
    | WorkspaceResponseStatus.WARNING
    | WorkspaceResponseStatus.ERROR;
  messages: ReadonlyArray<string>;
};
