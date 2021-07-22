/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { IChannel, LOGEVEL } from './_doc/logger';

const format = (userMsg: string, logMsg?: string) =>
  logMsg ? `${userMsg} (see OUTPUT for more details)` : userMsg;

const prependTimestamp = (message: string): string =>
  `${new Date().toISOString()} - ${message}`;

const logAndDisplay = (outputChannel: IChannel) => (lvl: LOGEVEL) => (
  userMsg: string,
  logMsg?: string
) => {
  outputChannel.appendLine(prependTimestamp(userMsg));
  if (logMsg) outputChannel.appendLine(prependTimestamp(logMsg));

  switch (lvl) {
    case LOGEVEL.TRACE:
      break;
    case LOGEVEL.INFO:
      vscode.window.showInformationMessage(format(userMsg, logMsg));
      break;
    case LOGEVEL.WARN:
      vscode.window.showWarningMessage(format(userMsg, logMsg));
      break;
    case LOGEVEL.ERROR:
      vscode.window.showErrorMessage(format(userMsg, logMsg));
      break;
    default:
      throw new UnreachableCaseError(lvl);
  }
};

const make = (outputChannel: vscode.OutputChannel): Logger => {
  const log = logAndDisplay(outputChannel);

  return {
    trace: (msg: string) => log(LOGEVEL.TRACE)(msg),
    info: log(LOGEVEL.INFO),
    warn: log(LOGEVEL.WARN),
    error: log(LOGEVEL.ERROR),
  };
};

export const createLogger = (name: string): Logger => {
  const outputChannel = vscode.window.createOutputChannel(name);
  return make(outputChannel);
};
