/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { addFilter } from './commands/AddFilter';
import { browseElement } from './commands/BrowseElement';
import { Commands } from './commands/Common';
import { deleteFilter } from './commands/DeleteFilter';
import { deleteHost } from './commands/DeleteHost';
import { deleteConnection } from './commands/DeleteConnection';
import { editFilter } from './commands/EditFilter';
import { HostDialogs } from './commands/HostDialogs';
import { retrieveElement } from './commands/RetrieveElement';
import { retrieveWithDependencies } from './commands/RetrieveElementWithDependencies';
import { EndevorController } from './EndevorController';
import { RetrieveElementService } from './service/RetrieveElementService';
import { HOST_SETTINGS_KEY } from './service/SettingsFacade';
import { createEndevorTree } from './ui/tree/EndevorDataProvider';
import { EndevorNode } from './ui/tree/EndevorNodes';
import { multipleElementsSelected } from './utils';
import { Logger } from '@zowe/imperative';
import * as path from 'path';
import { Profiles } from './service/Profiles';
import { logger as vscodeLogger } from './globals';
import { SCHEMA_NAME } from './constants';
import { EndevorElementContentProvider } from './ui/tree/EndevorElementContentProvider';

let log: Logger;

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize Imperative Logger and load Profiles
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loggerConfig = require(path.join(
      context.extensionPath,
      'log4jsconfig.json'
    ));
    loggerConfig.log4jsConfig.appenders.default.filename = path.join(
      context.extensionPath,
      'logs',
      'imperative.log'
    );
    loggerConfig.log4jsConfig.appenders.imperative.filename = path.join(
      context.extensionPath,
      'logs',
      'imperative.log'
    );
    loggerConfig.log4jsConfig.appenders.app.filename = path.join(
      context.extensionPath,
      'logs',
      'zowe.log'
    );
    Logger.initLogger(loggerConfig);

    log = Logger.getAppLogger();
    log.debug('Initialized logger from VSCode extension');
  } catch (err) {
    log.error(
      'Error encountered while activating and initializing logger! ' +
        JSON.stringify(err)
    );
    vscodeLogger.error(err.message);
  }

  await Profiles.createInstance(log);
  const endevorDataProvider = await createEndevorTree(log);
  const retrieveElementService: RetrieveElementService = new RetrieveElementService();
  EndevorController.instance.loadRepositories();

  const endevorExplorerView: vscode.TreeView<EndevorNode> = vscode.window.createTreeView(
    'endevorExplorer',
    {
      treeDataProvider: endevorDataProvider,
    }
  );
  endevorExplorerView.onDidCollapseElement((event) => {
    event.element.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
  });
  endevorExplorerView.onDidExpandElement((event) => {
    event.element.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  });
  context.subscriptions.push(endevorExplorerView);
  try {
    endevorExplorerView.onDidChangeSelection(() => {
      vscode.commands.executeCommand(
        'setContext',
        'multipleSelection',
        multipleElementsSelected(endevorExplorerView.selection)
      );
    });
  } catch (ignore) {
    console.warn(ignore);
    vscode.commands.executeCommand('setContext', 'multipleSelection', false);
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('endevorexplorer.newHost', (arg: any) => {
      HostDialogs.addHost(arg).then(() => {
        vscode.commands.executeCommand('endevorexplorer.refreshHosts');
      });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('endevorexplorer.newConnection', () => {
      HostDialogs.addConnection().then(() => {
        vscode.commands.executeCommand('endevorexplorer.refreshHosts');
      });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'endevorexplorer.deleteConnection',
      deleteConnection
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'endevorexplorer.updateHost',
      (arg: any) => {
        if (arg.contextValue === 'repository') {
          HostDialogs.editHost(arg);
        }
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'endevorexplorer.refreshRepo',
      (arg: any) => {
        EndevorController.instance.updateNeedReloadInTree(true, arg);
        endevorDataProvider.refresh();
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('endevorexplorer.refreshHosts', () => {
      EndevorController.instance.updateNeedReloadInTree(
        true,
        EndevorController.instance.rootNode
      );
      endevorDataProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.AddFilter, addFilter)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.EditFilter, editFilter)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.DeleteFilter, deleteFilter)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.DeleteHost, deleteHost)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.RetrieveElement, (arg: any) => {
      retrieveElement(
        arg,
        endevorExplorerView.selection,
        retrieveElementService
      );
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.RetrieveWithDependencies,
      (arg: any) => {
        retrieveWithDependencies(arg, retrieveElementService);
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.BrowseElement, browseElement)
  );

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEMA_NAME, new EndevorElementContentProvider())
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(HOST_SETTINGS_KEY)) {
        endevorDataProvider.refresh();
        vscode.commands.executeCommand('endevorexplorer.refreshHosts');
      }
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
