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

import * as vscode from 'vscode';
import { Logger } from '@local/extension/_doc/Logger';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { LoggerChannel, LOGLEVEL } from './_doc/logger';

const showLogsOption = 'Show Logs';

const prependTimestamp = (message: string): string =>
  `${new Date().toISOString()} - ${message}`;

const logAndDisplay =
  (outputChannel: LoggerChannel) =>
  (lvl: LOGLEVEL) =>
  (userMsg: string, logMsg?: string) => {
    outputChannel.appendLine(prependTimestamp(userMsg));
    if (logMsg) outputChannel.appendLine(prependTimestamp(logMsg));

    switch (lvl) {
      case LOGLEVEL.TRACE:
        break;
      case LOGLEVEL.INFO:
        vscode.window.showInformationMessage(userMsg);
        break;
      case LOGLEVEL.WARN:
        vscode.window
          .showWarningMessage(userMsg, showLogsOption)
          .then((showLogsChosen) => {
            if (showLogsChosen) outputChannel.showLogs();
          });
        break;
      case LOGLEVEL.ERROR:
        vscode.window
          .showErrorMessage(userMsg, showLogsOption)
          .then((showLogsChosen) => {
            if (showLogsChosen) outputChannel.showLogs();
          });
        break;
      default:
        throw new UnreachableCaseError(lvl);
    }
  };

const make = (outputChannel: vscode.OutputChannel): Logger => {
  const log = logAndDisplay({
    appendLine: outputChannel.appendLine,
    showLogs: () => {
      return outputChannel.show(true);
    },
  });

  return {
    trace: (msg: string) => log(LOGLEVEL.TRACE)(msg),
    info: log(LOGLEVEL.INFO),
    warn: log(LOGLEVEL.WARN),
    error: log(LOGLEVEL.ERROR),
  };
};

export const createLogger = (name: string): Logger => {
  // TODO propagate this object to dispose properly on extension deactivation
  // TODO currently it is never disposed
  const outputChannel = vscode.window.createOutputChannel(name);
  return make(outputChannel);
};
