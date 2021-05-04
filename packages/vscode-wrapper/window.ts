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
import {
  Choice,
  MessageWithOptions,
  ProgressingFunction,
  PromptInputOptions,
} from './_doc/window';

export const showMessageWithOptions = async ({
  message,
  options,
}: MessageWithOptions): Promise<Choice | undefined> => {
  return await vscode.window.showInformationMessage(message, ...options);
};

export const showInputBox = (
  options: PromptInputOptions
): Thenable<string | undefined> =>
  vscode.window.showInputBox({
    ...options,
    ignoreFocusOut: true,
  });

export const showVscodeQuickPick = (
  items: vscode.QuickPickItem[],
  showOptions?: vscode.QuickPickOptions
): Thenable<vscode.QuickPickItem | undefined> => {
  return vscode.window.showQuickPick(items, showOptions);
};

export const showWebView = (webViewType: string) => (
  title: string,
  body: string
): void => {
  const panelIdentificationType = webViewType;
  const panelLocation = vscode.window.activeTextEditor?.viewColumn || 1;
  const panel = vscode.window.createWebviewPanel(
    panelIdentificationType,
    title,
    panelLocation
  );
  panel.webview.html = body;
};

// don't forget to validate promise.reject
export const showFileContent = async (fileUri: vscode.Uri): Promise<void> => {
  await vscode.window.showTextDocument(fileUri, { preview: false });
};

// don't forget to validate promise.reject
export const withNotificationProgress = (title: string) => async <R>(
  task: ProgressingFunction<R>
): Promise<R> => {
  return await vscode.window.withProgress(
    {
      title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
    },
    async (progress) => {
      return await task(progress);
    }
  );
};
