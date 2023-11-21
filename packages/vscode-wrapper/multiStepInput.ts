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
  QuickPickItem,
  window,
  Disposable,
  QuickInput,
  QuickInputButtons,
} from 'vscode';

// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------

enum InputFlowAction {
  BACK,
  CANCEL,
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
  title: string;
  step: number;
  totalSteps: number;
  items: () => Promise<T[]>;
  activeItem?: T;
  ignoreFocusOut?: boolean;
  placeholder: string;
  canSelectMany?: boolean;
}

interface InputBoxParameters {
  title: string;
  step: number;
  totalSteps: number;
  value: string;
  prompt: string;
  validate: (value: string) => Promise<string | undefined>;
  ignoreFocusOut?: boolean;
  placeholder?: string;
}

export class MultiStepInput {
  static async run(start: InputStep) {
    const input = new MultiStepInput();
    return input.stepThrough(start);
  }

  private current?: QuickInput;
  private steps: InputStep[] = [];

  private async stepThrough(start: InputStep): Promise<boolean> {
    let step: InputStep | void = start;
    let wasCancelled = false;
    while (step) {
      this.steps.push(step);
      if (this.current) {
        this.current.enabled = false;
        this.current.busy = true;
      }
      try {
        step = await step(this);
      } catch (error) {
        switch (error) {
          case InputFlowAction.BACK: {
            this.steps.pop();
            step = this.steps.pop();
            break;
          }
          case InputFlowAction.CANCEL: {
            wasCancelled = true;
            step = undefined;
            break;
          }
          default:
            throw error;
        }
      }
    }
    if (this.current) {
      this.current.dispose();
    }
    return wasCancelled;
  }

  async showQuickPick<
    T extends QuickPickItem,
    P extends QuickPickParameters<T>
  >({
    title,
    step,
    totalSteps,
    items,
    activeItem,
    placeholder,
    canSelectMany,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        T[] | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createQuickPick<T>();
        input.busy = true;
        items().then((items) => {
          input.items = items;
          input.busy = false;
        });
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.ignoreFocusOut = true;
        input.placeholder = placeholder;
        input.canSelectMany = !!canSelectMany;
        if (activeItem) {
          input.activeItems = [activeItem];
        }
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
        ];
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.BACK);
            }
          }),
          input.onDidChangeSelection((items) => {
            if (!canSelectMany) {
              resolve([...items]);
            } else {
              input.items.forEach((inputItem) => {
                if (items.includes(inputItem)) {
                  inputItem.picked = true;
                }
              });
            }
          }),
          input.onDidHide(() => {
            reject(InputFlowAction.CANCEL);
          }),
          input.onDidAccept(() => {
            resolve([...input.items]);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  async showInputBox<P extends InputBoxParameters>({
    title,
    step,
    totalSteps,
    value,
    prompt,
    validate,
    placeholder,
  }: P) {
    const disposables: Disposable[] = [];
    try {
      return await new Promise<
        string | (P extends { buttons: (infer I)[] } ? I : never)
      >((resolve, reject) => {
        const input = window.createInputBox();
        input.title = title;
        input.step = step;
        input.totalSteps = totalSteps;
        input.value = value || '';
        input.prompt = prompt;
        input.ignoreFocusOut = true;
        input.placeholder = placeholder;
        input.buttons = [
          ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
        ];
        let validating = validate('');
        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.BACK);
            }
          }),
          input.onDidAccept(async () => {
            const value = input.value;
            input.enabled = false;
            input.busy = true;
            if (!(await validate(value))) {
              resolve(value);
            }
            input.enabled = true;
            input.busy = false;
          }),
          input.onDidChangeValue(async (text) => {
            const current = validate(text);
            validating = current;
            const validationMessage = await current;
            if (current === validating) {
              input.validationMessage = validationMessage;
            }
          }),
          input.onDidHide(() => {
            reject(InputFlowAction.CANCEL);
          })
        );
        if (this.current) {
          this.current.dispose();
        }
        this.current = input;
        this.current.show();
      });
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }
}
