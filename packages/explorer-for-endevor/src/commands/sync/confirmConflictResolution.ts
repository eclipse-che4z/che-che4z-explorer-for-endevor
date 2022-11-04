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

import { stringifyPretty } from '@local/endevor/utils';
import { SourceControlResourceState } from 'vscode';
import { logger, reporter } from '../../globals';
import { confirmConflictResolution as confirmEndevorConflictResolution } from '../../store/scm/workspace';
import { SyncAction, SyncActions } from '../../store/scm/_doc/Actions';
import { isError } from '../../utils';
import { TreeElementCommandArguments } from '../../_doc/Telemetry';
import {
  ConfirmConflictResolutionCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';

export const confirmConflictResolutionCommand =
  (scmDispatch: (_action: SyncAction) => Promise<void>) =>
  async (resourceStates: SourceControlResourceState[]): Promise<void> => {
    logger.trace('Conflict resolution confirmation command called.');
    if (!resourceStates) {
      logger.error(
        'Unable to confirm conflict resolution(s).',
        'Unable to confirm conflict resolution(s) because resource state(s) are undefined.'
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_CALLED,
      commandArguments:
        resourceStates.length > 1
          ? {
              type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
              elementsAmount: resourceStates.length,
            }
          : {
              type: TreeElementCommandArguments.SINGLE_ELEMENT,
            },
    });
    const conflictConfirmations = await Promise.all(
      resourceStates.map(async (resourceState) => {
        if (!resourceState.resourceUri) {
          return new Error(
            `Unable to confirm conflict resolution because of a resource state incorrect format:\n${stringifyPretty(
              resourceState
            )}`
          );
        }
        const confirmationResult = await confirmEndevorConflictResolution(
          resourceState.resourceUri
        );
        if (isError(confirmationResult)) {
          const error = confirmationResult;
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_CALLED,
            status:
              ConfirmConflictResolutionCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return error;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED,
          status: ConfirmConflictResolutionCommandCompletedStatus.SUCCESS,
        });
        return confirmationResult;
      })
    );
    const overallErrors = conflictConfirmations.filter(isError);
    if (overallErrors.length > 1) {
      logger.error(
        'There were some issues confirming conflict resolutions.',
        `There were some issues confirming conflict resolutions: ${[
          '',
          ...overallErrors.map((error) => error.message),
        ].join('\n')}.`
      );
    } else if (overallErrors.length === 1) {
      logger.error(
        'Unable to confirm conflict resolution.',
        `${overallErrors[0]?.message}`
      );
    }
    scmDispatch({
      type: SyncActions.SYNC_ELEMENTS_UPDATED,
    });
  };
