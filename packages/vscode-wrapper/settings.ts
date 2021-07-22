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

export const updateGlobalEndevorConfiguration = (
  configurationKey: string
) => async <T>(
  settingsKey: string,
  newSettingsValue: Readonly<T>
): Promise<void> => {
  await vscode.workspace
    .getConfiguration(configurationKey)
    .update(settingsKey, newSettingsValue, vscode.ConfigurationTarget.Global);
};

export const getEndevorConfigurationValue = (configurationKey: string) => <T>(
  settingsKey: string,
  defaultValue: Readonly<T>
): Readonly<T> => {
  return vscode.workspace
    .getConfiguration(configurationKey)
    .get(settingsKey, defaultValue);
};
