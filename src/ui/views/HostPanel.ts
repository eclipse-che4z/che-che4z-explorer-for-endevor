/* eslint-disable no-case-declarations */
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

import { IEndevorInstance, ListInstance } from '@broadcom/endevor-for-zowe-cli';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EndevorController } from '../../EndevorController';
import * as utils from '../../utils';
import { logger } from '../../globals';
import { IRepository } from '../../interface/IRepository';
import { Repository } from '../../model/Repository';

export class HostPanel {
  public static readonly viewType = 'endevorHostPanel';
  public static createOrShow(
    context: vscode.ExtensionContext,
    repo?: IRepository
  ) {
    if (
      !(
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
      )
    ) {
      logger.error('Specify a workspace before creating a repository.');
      return;
    }
    if (repo) {
      const repoName = repo.getName() ? repo.getName() : '';
      if (repoName) {
        const panel = vscode.window.createWebviewPanel(
          HostPanel.viewType,
          repo ? repoName : 'New Endevor Host',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );
        const filePath: vscode.Uri = vscode.Uri.file(
          path.join(context.extensionPath, 'resources', 'hostpanel.html')
        );
        panel.webview.html = fs
          .readFileSync(filePath.fsPath, 'utf8')
          .split('${name}')
          .join(repo ? repo.getName() : 'New host');
        panel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case 'update':
                const name = message.data.name;
                const url = message.data.url;
                const username = message.data.username;
                const password = message.data.password;
                const datasource = message.data.configuration;

                const targetRepo: IRepository = new Repository(
                  name,
                  url,
                  username,
                  password,
                  datasource,
                  ''
                );
                EndevorController.instance.addRepository(targetRepo, '');
                EndevorController.instance.updateSettings();
                panel.dispose();
                break;
              case 'configuration':
                const restUrl = message.data.url;
                const newRepo = new Repository('', restUrl, '', '', '', '');
                try {
                  const session = await utils.buildSession(newRepo);
                  const datasources: IEndevorInstance[] = await ListInstance.listInstance(
                    session
                  );
                  const dsNames: string[] = [];
                  for (const ds of datasources) {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    dsNames.push(ds.name as string);
                  }
                  dsNames.sort();
                  panel.webview.postMessage({ data: dsNames });
                } catch (error) {
                  panel.webview.postMessage({ data: [] });
                }
                break;
            }
          },
          undefined,
          context.subscriptions
        );
      }
    }
  }
  public static editHost(context: vscode.ExtensionContext, repo: IRepository) {
    const repoName = repo.getName() ? repo.getName() : '';
    if (repoName) {
      const panel = vscode.window.createWebviewPanel(
        HostPanel.viewType,
        repo ? repoName : 'New Endevor Host',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      const filePath: vscode.Uri = vscode.Uri.file(
        path.join(context.extensionPath, 'resources', 'edithost.html')
      );
      panel.webview.html = fs
        .readFileSync(filePath.fsPath, 'utf8')
        .split('${name}')
        // eslint-disable-next-line no-useless-escape
        .join(repoName.replace(/\"/g, '&quot;'))
        .split('${username}')
        .join(repo ? repo.getUsername() : '')
        .split('${url}')
        .join(repo ? repo.getUrl() : '')
        .split('${datasource}')
        .join(repo ? repo.getDatasource() : '')
        .split('${password}')
        .join(repo.getPassword() !== undefined ? repo.getPassword() : '');
      panel.webview.onDidReceiveMessage(
        (message) => {
          if (message.command !== 'editHost') {
            return;
          }
          const name = message.data.name;
          const username = message.data.username;
          const password = message.data.password;
          repo.setName(name);
          repo.setUsername(username);
          repo.setPassword(password);
          EndevorController.instance.updateSettings();
          panel.dispose();
        },
        undefined,
        context.subscriptions
      );
    }
  }
}
