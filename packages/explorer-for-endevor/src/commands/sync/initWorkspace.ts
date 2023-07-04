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
  openFolder,
  reloadWindow,
  showOpenFolderDialog,
} from '@local/vscode-wrapper/window';
import {
  initWorkspace as initEndevorWorkspace,
  isWorkspace as isEndevorWorkspace,
} from '../../store/scm/workspace';
import { logger, reporter } from '../../globals';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import { isError } from '../../utils';
import { Uri } from 'vscode';
import {
  InitWorkspaceCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/Telemetry';
import { WorkspaceResponseStatus } from '../../store/scm/_doc/Error';

export const initWorkspace = async (): Promise<void> => {
  logger.trace('Initialization of an Endevor workspace called.');
  const folder = await resolveFolder();
  if (!folder) {
    logger.trace(
      'At least one workspace folder should be opened, initialization cancelled.'
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED,
      status: InitWorkspaceCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  if (isEndevorWorkspace(folder.uri)) {
    logger.warn(
      'An opened workspace folder already initialized as the Endevor workspace, initialization cancelled.'
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED,
      status: InitWorkspaceCommandCompletedStatus.CANCELLED,
    });
    return;
  }
  const initResult = await initEndevorWorkspace(folder.uri);
  if (isError(initResult)) {
    const error = initResult;
    logger.error(
      'Unable to initialize Endevor workspace.',
      `${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED,
      status: InitWorkspaceCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  // always dump the result messages
  initResult.messages.forEach((message) => logger.trace(message));
  switch (initResult.status) {
    case WorkspaceResponseStatus.ERROR:
      logger.error('Unable to initialize workspace.');
      return;
    case WorkspaceResponseStatus.WARNING:
      logger.warn(
        'Workspace initialization was successful with some warnings.'
      );
      break;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED,
    status: InitWorkspaceCommandCompletedStatus.SUCCESS,
  });
  if (folder.isOpened) return await reloadWindow();
  return await openFolder(folder.uri);
};

const resolveFolder = async (): Promise<
  | {
      uri: Uri;
      isOpened: boolean;
    }
  | undefined
> => {
  let uri = await getWorkspaceUri();
  if (!uri) {
    uri = await showOpenFolderDialog();
    if (!uri) return;
    return {
      uri,
      isOpened: false,
    };
  }
  return {
    uri,
    isOpened: true,
  };
};
