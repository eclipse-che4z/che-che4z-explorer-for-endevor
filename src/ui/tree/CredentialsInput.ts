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
import { Connection } from '../../entities/Connection';
import { IRepository } from '../../interface/entities';
import { Profiles } from '../../service/Profiles';
import { SettingsFacade } from '../../service/SettingsFacade';

export class CredentialsInputBox {
  /**
   * Ask credentions.
   * @param repo repository
   * @returns object with username and password attrinbutes of undefined if canceled.
   */
  public static async askforCredentials(
    repo: IRepository
  ): Promise<{ username: string; password: string } | undefined> {
    const username = await CredentialsInputBox.showUserName(repo.getUsername());
    if (username === undefined) {
      return undefined;
    }
    const password = await CredentialsInputBox.showPasswordBox();
    if (password === undefined) {
      return undefined;
    }
    repo.setUsername(username);
    repo.setPassword(password);
    const allConnections = Profiles.getInstance().allProfiles.map((profile) => {
      return new Connection(profile);
    });
    SettingsFacade.updateSettings(allConnections);
    // EndevorController.instance.updateSettings();
    return { password, username };
  }
  public createCredentialsInput() {
    const box = new CredentialsInputBox();
    return box;
  }
  private static async showUserName(
    username?: string
  ): Promise<string | undefined> {
    username = username ? username : '';
    return vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'Username',
      prompt: 'Enter the Username ',
      validateInput: (text: string) =>
        text !== '' ? '' : 'Username must not be empty',
      value: username,
    });
  }
  private static async showPasswordBox(): Promise<string | undefined> {
    return vscode.window.showInputBox({
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'Mainframe password',
      prompt: 'Enter the password ',
      validateInput: (text: string) =>
        text !== '' ? '' : 'Password must not be empty',
    });
  }
}
