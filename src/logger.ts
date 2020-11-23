/* eslint-disable no-case-declarations */
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
import { OUTPUT_CHANNEL_NAME } from './constants';
import { ILogger } from './interface/ILogger';
import { UnreachableCaseError } from './typeHelpers';

enum LOGEVEL {
  TRACE,
  INFO,
  WARN,
  ERROR,
}

interface IChannel {
  appendLine: (line: string) => void;
}

const format = (userMsg: string, logMsg?: string) =>
  logMsg
    ? `${userMsg} (see OUTPUT - ${OUTPUT_CHANNEL_NAME} for more details)`
    : userMsg;

const logAndDisplay = (outputChannel: IChannel) => (lvl: LOGEVEL) => (
  userMsg: string,
  logMsg?: string
) => {
  outputChannel.appendLine(userMsg);
  outputChannel.appendLine(logMsg ?? '(no detail message)');

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

export const make = (outputChannel: vscode.OutputChannel): ILogger => {
  const log = logAndDisplay(outputChannel);

  return {
    trace: (msg: string) => log(LOGEVEL.TRACE)(msg),
    info: log(LOGEVEL.INFO),
    warn: log(LOGEVEL.WARN),
    error: log(LOGEVEL.ERROR),
  };
};
