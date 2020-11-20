import * as vscode from 'vscode';
import { OUTPUT_CHANNEL_NAME } from './constants';
import { ILogger } from './doc/ILogger';
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
