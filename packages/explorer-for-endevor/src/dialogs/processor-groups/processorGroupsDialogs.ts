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
  ElementTypeMapPath,
  ErrorResponseType,
  ProcessorGroup,
  ProcessorGroupsResponse,
  Value,
} from '@local/endevor/_doc/Endevor';
import {
  showVscodeQuickPick,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { CancellationTokenSource, QuickPickItem } from 'vscode';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { formatWithNewLines } from '../../utils';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { EndevorLogger } from '../../logger';

export const pickedChoiceLabel = '[ Do not override ]';

export const askForProcessorGroup = async (
  logger: EndevorLogger,
  searchLocation: Partial<ElementTypeMapPath>,
  getProcessorGroups: (
    progress: ProgressReporter
  ) => (
    typeMapPath: Partial<ElementTypeMapPath>
  ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>,
  defaultProcGroup?: Value
): Promise<string | undefined> => {
  logger.trace('Prompt for Element processor groups.');
  const tokenSource = new CancellationTokenSource();
  const choice = await showVscodeQuickPick(
    getProcessorGroupsQuickPickItems(logger)(
      searchLocation,
      getProcessorGroups,
      tokenSource,
      defaultProcGroup
    ),
    {
      title: 'Select from the available Element processor groups',
      placeHolder: 'Start typing to filter...',
      ignoreFocusOut: true,
      canPickMany: false,
    },
    tokenSource.token
  );
  return choice?.label;
};

const getProcessorGroupsQuickPickItems =
  (logger: EndevorLogger) =>
  async (
    searchLocation: Partial<ElementTypeMapPath>,
    getProcessorGroups: (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>,
    tokenSource: CancellationTokenSource,
    defaultProcGroup?: Value
  ): Promise<QuickPickItem[]> => {
    const typeText = searchLocation.type
      ? 'type ' + searchLocation.type
      : 'all types';
    const processorGroupsResponse = await withNotificationProgress(
      `Retrieving processor groups info for ${typeText} ...`
    )((progressReporter) =>
      getProcessorGroups(progressReporter)(searchLocation)()
    );
    if (isErrorEndevorResponse(processorGroupsResponse)) {
      tokenSource.cancel();
      const errorResponse = processorGroupsResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to retrieve processor groups info for ${typeText} because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.errorWithDetails(
            'Endevor credentials are incorrect or expired.',
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          return [];
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.errorWithDetails(
            'Unable to connect to Endevor Web Services.',
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          return [];
        case ErrorResponseType.GENERIC_ERROR:
          logger.errorWithDetails(
            `Unable to retrieve processor groups info for ${typeText}`,
            `${error.message}.`
          );
          return [];
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const pickedItem: QuickPickItem = {
      label: pickedChoiceLabel,
      detail: 'The current processor group will be used for this action',
      picked: true,
    };
    const quickPickItems = processorGroupsResponse.result.map((procGroup) =>
      toQuickPickItem(procGroup, defaultProcGroup)
    );
    return [pickedItem, ...quickPickItems];
  };

const toQuickPickItem = (
  procGroup: ProcessorGroup,
  defaultProcGroup?: Value
): QuickPickItem => {
  const isCurrent = procGroup.procGroupName === defaultProcGroup;
  return {
    label: procGroup.procGroupName,
    description: isCurrent ? '[Current]' : undefined,
    detail: procGroup.description,
  };
};
