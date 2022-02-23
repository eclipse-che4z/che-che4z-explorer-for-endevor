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

export type Choice = string;
export interface MessageWithOptions {
  message: string;
  options: ReadonlyArray<string>;
}

export interface PromptInputOptions {
  prompt?: string;
  /**
   * initial value
   */
  value?: string;
  password?: boolean;
  placeHolder?: string;
  validateInput?: (value: string) => string | undefined;
}

export type Progress = Readonly<
  Partial<{ message: string; increment: number }>
>;
export type ProgressReporter = {
  report(value: Progress): void;
};
export type ProgressingFunction<R> = (progress: ProgressReporter) => Promise<R>;
