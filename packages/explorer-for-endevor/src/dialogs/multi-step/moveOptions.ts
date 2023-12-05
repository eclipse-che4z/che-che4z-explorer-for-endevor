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

import { QuickPickItem } from 'vscode';
import { MultiStepInput } from '@local/vscode-wrapper/multiStepInput';

interface MoveOptionsState {
  title: string;
  step: number;
  totalSteps: number;
  options: MoveOptions;
}

const defaultOptions = {
  ccid: '',
  comment: '',
  withHistory: false,
  bypassElementDelete: false,
  synchronize: false,
  retainSignout: false,
  ackElementJump: false,
};

export enum MoveOptionValues {
  WITH_HISTORY = 'With History',
  BYPASS_ELEMENT_DELETE = 'Bypass Element Delete',
  SYNCHRONIZE = 'Synchronize',
  RETAIN_SIGNOUT = 'Retain Signout',
  ACK_ELEMENT_JUMP = 'Jump',
  NONE = 'NONE',
}

export interface MoveOptions {
  ccid: string;
  comment: string;
  withHistory: boolean;
  bypassElementDelete: boolean;
  synchronize: boolean;
  retainSignout: boolean;
  ackElementJump: boolean;
}

export const multiStepMoveOptionsForPackage = async (
  packageName: string,
  defaultCcid?: string,
  defaultComment?: string
) => {
  const title = `Move Element options${
    packageName ? ' for package ' + packageName : ''
  }`;
  return multiStepMoveOptions(defaultCcid, defaultComment, title);
};

export async function multiStepMoveOptions(
  defaultCcid?: string,
  defaultComment?: string,
  customTitle?: string
): Promise<MoveOptions | undefined> {
  const options: QuickPickItem[] = [
    [
      MoveOptionValues.WITH_HISTORY,
      'If selected, preserves source Element change history; If NOT selected, Endevor creates a new level at the target location that reflects the differences',
    ],
    [
      MoveOptionValues.BYPASS_ELEMENT_DELETE,
      'Element is retained in the source Stage after successfully completing the move',
    ],
    [
      MoveOptionValues.SYNCHRONIZE,
      'Compensates for differences between the base level of a source Element and the current level of a target Element',
    ],
    [
      MoveOptionValues.RETAIN_SIGNOUT,
      'Element retains the source location signout at the target location',
    ],
    [
      MoveOptionValues.ACK_ELEMENT_JUMP,
      'Move even if the element exists at an intermediate Stage that is not on the map',
    ],
  ].map((option) => ({ label: option[0] || 'N/A', detail: option[1] }));

  const title = customTitle ?? 'Move Element';

  async function collectInputs(): Promise<MoveOptions | undefined> {
    const state: MoveOptionsState = {
      title,
      step: 0,
      totalSteps: 0,
      options: defaultOptions,
    };
    const wasCancelled = await MultiStepInput.run((input) =>
      inputCcid(input, state)
    );
    return !wasCancelled ? state.options : undefined;
  }

  async function inputCcid(input: MultiStepInput, state: MoveOptionsState) {
    state.options.ccid = await input.showInputBox({
      title,
      step: 1,
      totalSteps: 3,
      value: state.options.ccid || defaultCcid || '',
      prompt: 'Type CCID',
      validate: validateCcid,
    });
    return (input: MultiStepInput) => inputComment(input, state);
  }

  async function inputComment(input: MultiStepInput, state: MoveOptionsState) {
    state.options.comment = await input.showInputBox({
      title,
      step: 2,
      totalSteps: 3,
      value: state.options.comment || defaultComment || '',
      prompt: 'Type Comment',
      validate: validateComment,
    });
    return (input: MultiStepInput) => pickOptions(input, state);
  }

  async function pickOptions(input: MultiStepInput, state: MoveOptionsState) {
    const quickItemOptions = await input.showQuickPick({
      title,
      step: 3,
      totalSteps: 3,
      placeholder: 'Select options',
      items: () => Promise.resolve(options),
      canSelectMany: true,
    });
    state.options = quickItemOptions.reduce((acc: MoveOptions, quickItem) => {
      switch (quickItem.label) {
        case MoveOptionValues.WITH_HISTORY:
          acc.withHistory = !!quickItem.picked;
          break;
        case MoveOptionValues.BYPASS_ELEMENT_DELETE:
          acc.bypassElementDelete = !!quickItem.picked;
          break;
        case MoveOptionValues.SYNCHRONIZE:
          acc.synchronize = !!quickItem.picked;
          break;
        case MoveOptionValues.ACK_ELEMENT_JUMP:
          acc.ackElementJump = !!quickItem.picked;
          break;
        case MoveOptionValues.RETAIN_SIGNOUT:
          acc.retainSignout = !!quickItem.picked;
          break;
        default:
          break;
      }
      return acc;
    }, state.options);
  }

  async function validateCcid(ccid: string) {
    return ccid.length > 12 ? 'Ccid too long' : undefined;
  }

  async function validateComment(comment: string) {
    return comment.length > 40 ? 'Comment too long' : undefined;
  }

  const state = await collectInputs();
  return state;
}
