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

interface PackageCreateState {
  title: string;
  step: number;
  totalSteps: number;
  options: PackageCreateOptions;
}

const defaultOptions: PackageCreateOptions = {
  name: '',
  description: '',
  sharable: false,
  backoutEnabled: false,
  doNotValidateSCL: false,
  isEmergency: false,
};

export enum PackageCreateOptionValues {
  SHARABLE = 'Sharable',
  BACKOUT_ENABLED = 'Backout Enabled',
  DO_NOT_VALIDATE_SCL = 'Do Not Validate SCL',
  IS_EMERGENCY = 'Emergency Package',
  NONE = 'NONE',
}

export interface PackageCreateOptions {
  name: string;
  description: string;
  sharable: boolean;
  backoutEnabled: boolean;
  doNotValidateSCL: boolean;
  isEmergency: boolean;
}

export async function multiStepCreatePackageOptions(
  defaultCcid?: string,
  defaultComment?: string
): Promise<PackageCreateOptions | undefined> {
  const options: QuickPickItem[] = [
    [
      PackageCreateOptionValues.SHARABLE,
      'If selected, the Package can be edited by someone other than the Package creator',
    ],
    [
      PackageCreateOptionValues.BACKOUT_ENABLED,
      'Indicates whether you want to have the backout facility available for this Package',
    ],
    [
      PackageCreateOptionValues.DO_NOT_VALIDATE_SCL,
      'If selected, the Package components are not validated while creating this Package',
    ],
    [
      PackageCreateOptionValues.IS_EMERGENCY,
      'If selected, this Package will be an Emergency package (can be only approved by Emergency approver groups)',
    ],
  ].map((option) => ({ label: option[0] || 'N/A', detail: option[1] }));

  const title = 'Create Package';

  async function collectInputs(): Promise<PackageCreateOptions | undefined> {
    const state: PackageCreateState = {
      title,
      step: 0,
      totalSteps: 0,
      options: defaultOptions,
    };
    const wasCancelled = await MultiStepInput.run((input) =>
      inputName(input, state)
    );
    return !wasCancelled ? state.options : undefined;
  }

  async function inputName(input: MultiStepInput, state: PackageCreateState) {
    state.options.name = await input.showInputBox({
      title,
      step: 1,
      totalSteps: 3,
      value: state.options.name || defaultCcid || '',
      prompt: 'Type Package Name',
      validate: validateName,
    });
    state.title = `${title} ${state.options.name}`;
    return (input: MultiStepInput) => inputDescription(input, state);
  }

  async function inputDescription(
    input: MultiStepInput,
    state: PackageCreateState
  ) {
    state.options.description = await input.showInputBox({
      title: state.title,
      step: 2,
      totalSteps: 3,
      value: state.options.description || defaultComment || '',
      prompt: 'Type Package Description',
      validate: validateDescription,
    });
    return (input: MultiStepInput) => pickOptions(input, state);
  }

  async function pickOptions(input: MultiStepInput, state: PackageCreateState) {
    const quickItemOptions = await input.showQuickPick({
      title: state.title,
      step: 3,
      totalSteps: 3,
      placeholder: 'Select options',
      items: () => Promise.resolve(options),
      canSelectMany: true,
    });
    state.options = quickItemOptions.reduce(
      (acc: PackageCreateOptions, quickItem) => {
        switch (quickItem.label) {
          case PackageCreateOptionValues.SHARABLE:
            acc.sharable = !!quickItem.picked;
            break;
          case PackageCreateOptionValues.BACKOUT_ENABLED:
            acc.backoutEnabled = !!quickItem.picked;
            break;
          case PackageCreateOptionValues.DO_NOT_VALIDATE_SCL:
            acc.doNotValidateSCL = !!quickItem.picked;
            break;
          case PackageCreateOptionValues.IS_EMERGENCY:
            acc.isEmergency = !!quickItem.picked;
            break;
          default:
            break;
        }
        return acc;
      },
      state.options
    );
  }

  async function validateName(name: string) {
    if (!name.length) {
      return 'Package Name must be specified';
    }
    return name.length > 16 ? 'Package Name too long' : undefined;
  }

  async function validateDescription(description: string) {
    if (!description.length) {
      return 'Package Description must be specified';
    }
    return description.length > 50 ? 'Package Description too long' : undefined;
  }

  const state = await collectInputs();
  return state;
}
