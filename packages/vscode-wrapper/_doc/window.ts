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

import { CancellationToken } from 'vscode';

export type Choice = string;

export const enum MessageLevel {
  INFO = 'information',
  WARN = 'warning',
  ERROR = 'error',
}
export interface MessageWithOptions {
  message: string;
  options: ReadonlyArray<string>;
}

export interface ModalMessageWithOptions extends MessageWithOptions {
  detail?: string;
}

export type PromptInputOptions = Readonly<
  Partial<{
    title: string;
    prompt: string;
    /**
     * initial value
     */
    value: string;
    password: boolean;
    placeHolder: string;
    validateInput: (value: string) => string | undefined;
  }>
>;

export type QuickPickOptions = Readonly<
  Partial<{
    title: string;
    placeholder: string;
    ignoreFocusOut: boolean;
    canPickMany: boolean;
  }>
>;

export type Progress = Readonly<
  Partial<{ message: string; increment: number }>
>;
export type ProgressReporter = {
  report(value: Progress): void;
};
export type ProgressingFunction<R> = (
  progress: ProgressReporter,
  token?: CancellationToken
) => Promise<R>;
