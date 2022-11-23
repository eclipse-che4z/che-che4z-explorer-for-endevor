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
  EndevorActionStatusDetailed,
  EndevorActionStatus,
  EndevorActionType,
} from '@broadcom/endevor-for-zowe-cli/lib/api';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Uri } from 'vscode';
import { isUnique } from '../../utils';
import {
  WorkspaceElementErrorDetails,
  WorkspaceOperation,
  WorkspaceSyncResponse,
  WorkspaceResponseStatus,
  WorkspaceElementConflictDetails,
  WorkspaceResponse,
} from './_doc/Error';
import { EndevorElement } from './_doc/Workspace';
import {
  WorkspaceActionResults as ExternalWorkspaceActionResults,
  WorkspaceResponse as ExternalWorkspaceResponse,
} from './_ext/Workspace';

export const getWorkspaceResponse = (
  externalResponse: ExternalWorkspaceResponse
): WorkspaceResponse => {
  const cleanedUpMessages = externalResponse.messages.map((message) =>
    message.trim()
  );
  // temporary get status from messages too
  // TODO: replace with overall status from Sync API itself
  const allMessageStatuses = getWorkspaceMessagesStatuses(
    externalResponse.messages
  );
  // use statuses from messages to determine the final status
  const overallResponseStatus =
    getWorkspaceOverallResponseStatus(allMessageStatuses);
  return {
    status: overallResponseStatus,
    messages: cleanedUpMessages,
  };
};

export const getWorkspaceSyncResponse = (
  externalResponse: ExternalWorkspaceResponse
): WorkspaceSyncResponse => {
  const cleanedUpMessages = externalResponse.messages.map((message) =>
    message.trim()
  );
  // temporary get status from messages too
  // TODO: replace with overall status from Sync API itself
  const allMessageStatuses = getWorkspaceMessagesStatuses(
    externalResponse.messages
  );
  // get necessary info from actions (if any)
  const [allActionStatuses, conflictDetails, errorDetails] =
    getWorkspaceResponseDetails(externalResponse.actions);
  // combine statuses from messages and from actions to determine the final status
  const overallResponseStatus = getWorkspaceOverallSyncResponseStatus(
    allActionStatuses.concat(allMessageStatuses).filter(isUnique)
  );
  if (
    externalResponse.unresolvedMergeConflicts ||
    overallResponseStatus === WorkspaceResponseStatus.CONFLICT
  ) {
    return {
      status: WorkspaceResponseStatus.CONFLICT,
      messages: cleanedUpMessages,
      conflictDetails,
    };
  }
  switch (overallResponseStatus) {
    case WorkspaceResponseStatus.NO_CHANGES:
    case WorkspaceResponseStatus.SUCCESS:
    case WorkspaceResponseStatus.WARNING:
      return {
        status: overallResponseStatus,
        messages: cleanedUpMessages,
      };
    case WorkspaceResponseStatus.ERROR:
      return {
        status: overallResponseStatus,
        messages: cleanedUpMessages,
        errorDetails,
      };
    default:
      throw new UnreachableCaseError(overallResponseStatus);
  }
};

const getWorkspaceResponseDetails = (
  elementActions: ExternalWorkspaceActionResults
): [
  ReadonlyArray<WorkspaceResponseStatus>,
  WorkspaceElementConflictDetails,
  WorkspaceElementErrorDetails
] => {
  const allReceivedStatuses: Array<WorkspaceResponseStatus> = [];
  const conflictDetails: WorkspaceElementConflictDetails = [];
  const errorDetails: WorkspaceElementErrorDetails = [];
  for (const elementAction of elementActions) {
    const element: EndevorElement = {
      environment: elementAction.environment,
      stageNumber: elementAction.stageNumber,
      system: elementAction.system,
      subSystem: elementAction.subsystem,
      type: elementAction.type,
      name: elementAction.fullElementName,
    };
    const fileUri = Uri.file(elementAction.localFile);
    let operation: WorkspaceOperation;
    switch (elementAction.action) {
      case EndevorActionType.CONFLICT:
        operation = WorkspaceOperation.CONFLICT;
        break;
      case EndevorActionType.LOCAL_DELETE:
        operation = WorkspaceOperation.LOCAL_DELETE;
        break;
      case EndevorActionType.REMOTE_DELETE:
        operation = WorkspaceOperation.REMOTE_DELETE;
        break;
      case EndevorActionType.RETRIEVE:
        operation = WorkspaceOperation.RETRIEVE;
        break;
      case EndevorActionType.UPDATE:
        operation = WorkspaceOperation.UPDATE;
        break;
      default:
        continue;
    }
    switch (elementAction.status) {
      case EndevorActionStatus.NOT_RUN:
        // detect if a manual merge still unsolved on the subsequent sync calls
        switch (elementAction.statusDetailed) {
          case EndevorActionStatusDetailed.NOT_RUN_MANUAL_MERGE_IN_PROGRESS:
            allReceivedStatuses.push(WorkspaceResponseStatus.CONFLICT);
            // provide conflict details
            conflictDetails.push({
              element,
              fileUri,
            });
            break;
          default:
            // otherwise just provide no changes status
            allReceivedStatuses.push(WorkspaceResponseStatus.NO_CHANGES);
            break;
        }
        break;
      case EndevorActionStatus.SUCCESS:
        // detect if a manual merge required for the first time
        switch (elementAction.statusDetailed) {
          case EndevorActionStatusDetailed.SUCCESS_MANUAL_MERGE_STARTED:
            allReceivedStatuses.push(WorkspaceResponseStatus.CONFLICT);
            // provide failure details
            conflictDetails.push({
              element,
              fileUri,
            });
            break;
          default:
            allReceivedStatuses.push(WorkspaceResponseStatus.SUCCESS);
        }
        break;
      case EndevorActionStatus.WARNING:
        allReceivedStatuses.push(WorkspaceResponseStatus.WARNING);
        break;
      case EndevorActionStatus.FAILURE: {
        // error status is always overwrite others
        allReceivedStatuses.push(WorkspaceResponseStatus.ERROR);
        // provide failure details
        errorDetails.push({
          element,
          errorMessages: elementAction.errorMessages,
          fileUri,
          operation,
        });
        break;
      }
      default:
        continue;
    }
  }
  return [allReceivedStatuses.filter(isUnique), conflictDetails, errorDetails];
};

const getWorkspaceOverallSyncResponseStatus = (
  statuses: ReadonlyArray<WorkspaceResponseStatus>
): WorkspaceResponseStatus => {
  switch (true) {
    case statuses.includes(WorkspaceResponseStatus.ERROR):
      return WorkspaceResponseStatus.ERROR;
    case statuses.includes(WorkspaceResponseStatus.CONFLICT):
      return WorkspaceResponseStatus.CONFLICT;
    case statuses.includes(WorkspaceResponseStatus.WARNING):
      return WorkspaceResponseStatus.WARNING;
    case statuses.includes(WorkspaceResponseStatus.SUCCESS):
      return WorkspaceResponseStatus.SUCCESS;
    case statuses.includes(WorkspaceResponseStatus.NO_CHANGES):
    default:
      return WorkspaceResponseStatus.NO_CHANGES;
  }
};

const getWorkspaceOverallResponseStatus = (
  statuses: ReadonlyArray<WorkspaceResponseStatus>
):
  | WorkspaceResponseStatus.SUCCESS
  | WorkspaceResponseStatus.WARNING
  | WorkspaceResponseStatus.ERROR => {
  switch (true) {
    case statuses.includes(WorkspaceResponseStatus.ERROR):
      return WorkspaceResponseStatus.ERROR;
    case statuses.includes(WorkspaceResponseStatus.WARNING):
      return WorkspaceResponseStatus.WARNING;
    case statuses.includes(WorkspaceResponseStatus.SUCCESS):
    default:
      return WorkspaceResponseStatus.SUCCESS;
  }
};

// temporary workaround while overall API response status is absent
const getWorkspaceMessagesStatuses = (
  messages: ReadonlyArray<string>
): ReadonlyArray<WorkspaceResponseStatus> => {
  const allMessageStatuses: Array<WorkspaceResponseStatus> = [];
  messages.forEach((message) => {
    switch (true) {
      case message.includes('[ERROR]'):
        allMessageStatuses.push(WorkspaceResponseStatus.ERROR);
        break;
      case message.includes('[WARN]'):
        allMessageStatuses.push(WorkspaceResponseStatus.WARNING);
        break;
      default:
        break;
    }
  });
  return allMessageStatuses.filter(isUnique);
};
