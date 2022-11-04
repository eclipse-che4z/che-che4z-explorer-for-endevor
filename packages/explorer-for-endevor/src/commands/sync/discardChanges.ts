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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { SourceControlResourceState, Uri, workspace } from 'vscode';
import {
  askForDiscardChanges,
  askForDiscardMultipleChanges,
  askForFileDeletion,
  askForFileRestoration,
} from '../../dialogs/scm/discardChangesDialogs';
import { logger, reporter } from '../../globals';
import {
  WorkspaceElementType,
  NonConflictedChangedElement,
} from '../../store/scm/_doc/Workspace';
import { TreeElementCommandArguments } from '../../_doc/Telemetry';
import {
  DiscardElementChangesCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import * as path from 'path';
import {
  deleteFile,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { isDefined, isError, parseFilePath } from '../../utils';
import { toCachedElementUri } from '../../uri/cachedElementUri';
import { SyncActions, SyncAction } from '../../store/scm/_doc/Actions';
import { stringifyPretty } from '@local/endevor/utils';

export const discardChangesCommand =
  (
    getWorkspaceChangeForFile: (
      fileUri: Uri
    ) => NonConflictedChangedElement | undefined
  ) =>
  (scmDispatch: (_action: SyncAction) => Promise<void>) =>
  async (resourceStates: SourceControlResourceState[]): Promise<void> => {
    logger.trace('Discard element changes command called.');
    if (resourceStates.length > 1) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_CALLED,
        commandArguments: {
          type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
          elementsAmount: resourceStates.length,
        },
      });
      if (!(await askForDiscardMultipleChanges(resourceStates.length))) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
          status: DiscardElementChangesCommandCompletedStatus.CANCELLED,
        });
        return;
      }
      const discardedWorkspaceElementUris = await discardMultipleElementChanges(
        getWorkspaceChangeForFile
      )(resourceStates);
      await scmDispatch({
        type: SyncActions.SYNC_ELEMENTS_DISCARDED,
        discardedWorkspaceElementUris,
      });
      return;
    }
    const [resourceState] = resourceStates;
    const fileUri = resourceState?.resourceUri;
    if (!fileUri) {
      logger.error(
        'Unable to discard element changes.',
        `Unable to discard element changes because of a resource state incorrect format:\n${stringifyPretty(
          resourceState
        )}`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
    });
    const fileName = path.basename(fileUri.fsPath);
    const changedElement = getWorkspaceChangeForFile(fileUri);
    if (!changedElement) {
      logger.warn(
        `Discard element changes failed for the element ${fileName}.`,
        `Discard element changes failed for the element ${fileName} because no changes were found.`
      );
      return;
    }
    let discardResult;
    switch (changedElement.elementType) {
      case WorkspaceElementType.ELEMENT_ADDED: {
        if (!(await askForFileDeletion(fileName))) {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
            status: DiscardElementChangesCommandCompletedStatus.CANCELLED,
          });
          break;
        }
        discardResult = await discardAddedElementChanges(
          changedElement.workspaceElementUri
        );
        break;
      }
      case WorkspaceElementType.ELEMENT_MODIFIED: {
        if (!(await askForDiscardChanges(fileName))) {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
            status: DiscardElementChangesCommandCompletedStatus.CANCELLED,
          });
          break;
        }
        discardResult = await discardModifiedElementChanges(
          changedElement.workspaceElementUri
        );
        break;
      }
      case WorkspaceElementType.ELEMENT_REMOVED: {
        if (!(await askForFileRestoration(fileName))) {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
            status: DiscardElementChangesCommandCompletedStatus.CANCELLED,
          });
          break;
        }
        discardResult = await discardModifiedElementChanges(
          changedElement.workspaceElementUri
        );
        break;
      }
      default:
        throw new UnreachableCaseError(changedElement);
    }
    if (isError(discardResult)) {
      const error = discardResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_CALLED,
        status: DiscardElementChangesCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      logger.error(
        `Unable to discard changes for the element ${fileName}.`,
        `Unable to discard changes for the element ${fileName} because of ${error.message}.`
      );
      return;
    }
    await scmDispatch({
      type: SyncActions.SYNC_ELEMENTS_DISCARDED,
      discardedWorkspaceElementUris: [changedElement.workspaceElementUri],
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
      status: DiscardElementChangesCommandCompletedStatus.SUCCESS,
    });
    return;
  };

const discardMultipleElementChanges =
  (
    getWorkspaceChangeForFile: (
      fileUri: Uri
    ) => NonConflictedChangedElement | undefined
  ) =>
  async (resourceStates: SourceControlResourceState[]): Promise<Uri[]> => {
    const discardResults = await Promise.all(
      resourceStates.map(async (resourceState) => {
        const fileName = path.basename(resourceState.resourceUri.fsPath);
        const changedElement = getWorkspaceChangeForFile(
          resourceState.resourceUri
        );
        if (!changedElement) {
          return new Error(
            `Discard element changes failed for the element ${fileName} because no changes were found`
          );
        }
        let discardResult;
        switch (changedElement.elementType) {
          case WorkspaceElementType.ELEMENT_ADDED: {
            discardResult = await discardAddedElementChanges(
              changedElement.workspaceElementUri
            );
            break;
          }
          case WorkspaceElementType.ELEMENT_REMOVED:
          case WorkspaceElementType.ELEMENT_MODIFIED: {
            discardResult = await discardModifiedElementChanges(
              changedElement.workspaceElementUri
            );
            break;
          }
        }
        if (isError(discardResult)) {
          const error = discardResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_CALLED,
            status: DiscardElementChangesCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED,
          status: DiscardElementChangesCommandCompletedStatus.SUCCESS,
        });
        return resourceState.resourceUri;
      })
    );
    const overallErrors = discardResults.filter(isError);
    if (overallErrors.length) {
      logger.error(
        `There were some issues discarding element changes.`,
        `There were some issues discarding element changes: ${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}.`
      );
    }
    return discardResults
      .map((result) => {
        if (isError(result)) return;
        return result;
      })
      .filter(isDefined);
  };

const discardAddedElementChanges = async (
  fileUri: Uri
): Promise<void | Error> => {
  try {
    return await deleteFile(fileUri);
  } catch (e) {
    return new Error(e.message);
  }
};

const discardModifiedElementChanges = async (
  fileUri: Uri
): Promise<void | Error> => {
  try {
    const cachedElementContent = (
      await workspace.openTextDocument(toCachedElementUri(fileUri))
    ).getText();
    const parsedPath = parseFilePath(fileUri.fsPath);
    await saveFileIntoWorkspaceFolder(Uri.file(parsedPath.path))(
      {
        fileName: parsedPath.fileName,
        fileExtension: parsedPath.fileExtension,
      },
      cachedElementContent
    );
  } catch (e) {
    return new Error(e.message);
  }
};
