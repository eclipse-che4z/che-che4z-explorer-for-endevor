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

import * as vscode from 'vscode';

export const updateGlobalSettingsValue =
  (configurationKey: string) =>
  async <T>(
    settingsKey: string,
    newSettingsValue: Readonly<T>
  ): Promise<void> => {
    await vscode.workspace
      .getConfiguration(configurationKey)
      .update(settingsKey, newSettingsValue, vscode.ConfigurationTarget.Global);
  };

export const getSettingsValue =
  (configurationKey: string) =>
  <T>(settingsKey: string, defaultValue: Readonly<T>): Readonly<T> => {
    return vscode.workspace
      .getConfiguration(configurationKey)
      .get(settingsKey, defaultValue);
  };
