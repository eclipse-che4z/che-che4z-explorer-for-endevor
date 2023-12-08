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

import { updateGlobalSettingsValue } from '@local/vscode-wrapper/settings';
import {
  showMessageWithOptions,
  showVscodeQuickPick,
} from '@local/vscode-wrapper/window';
import {
  DO_NOT_GENERATE_VALUE,
  ENDEVOR_CONFIGURATION,
  GENERATE_VALUE,
  GEN_AFTER_EDIT_SETTING,
} from '../../constants';
import { isDefined } from '../../utils';
import { operationCancelled, valueNotProvided } from '../utils';

export const askToReloadWindowAfterSettingsChanged = () => {
  return showMessageWithOptions({
    message:
      'Reloading the window is required to apply the change of the settings. Do you want to do it now?',
    options: ['Reload the Window'],
  });
};

const GenerateOptionQuickPickItems = [
  {
    label: 'Yes',
    detail: 'Generate processor will be executed for the element',
  },
  {
    label: 'Yes and Remember',
    detail:
      'Generate processor will be executed for the element and this selection will be saved in settings',
  },
  {
    label: 'No',
    detail: 'No generate processor will be executed for the element',
  },
  {
    label: 'No and Remember',
    detail:
      'No generate processor will be executed for the element and this selection will be saved in settings',
  },
];

export const askToGenerateAfterEdit = async (): Promise<
  boolean | undefined
> => {
  const choice = await showVscodeQuickPick(GenerateOptionQuickPickItems, {
    title: 'Do you want to generate the element after editing?',
    placeHolder: 'Select an option or type to filter the options',
    ignoreFocusOut: true,
    canPickMany: false,
  });
  if (
    operationCancelled(choice) ||
    valueNotProvided(choice) ||
    !isDefined(choice.label)
  ) {
    return;
  }
  if (choice.label.includes('Remember')) {
    updateGlobalSettingsValue(ENDEVOR_CONFIGURATION)(
      GEN_AFTER_EDIT_SETTING,
      choice.label.startsWith('Yes') ? GENERATE_VALUE : DO_NOT_GENERATE_VALUE
    );
  }
  return choice.label.startsWith('Yes');
};
