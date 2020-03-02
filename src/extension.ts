/*
 * Copyright (c) 2019 Broadcom.
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

import * as vscode from "vscode";
import { addFilter } from "./commands/AddFilter";
import { browseElement } from "./commands/BrowseElement";
import { Commands } from "./commands/Common";
import { deleteFilter } from "./commands/DeleteFilter";
import { deleteHost } from "./commands/DeleteHost";
import { editFilter } from "./commands/EditFilter";
import { retrieveElement } from "./commands/RetrieveElement";
import { retrieveWithDependencies } from "./commands/RetrieveElementWithDependencies";
import { EndevorController } from "./EndevorController";
import { Repository } from "./model/Repository";
import { GitBridgeSupport } from "./service/GitBridgeSupport";
import { RetrieveElementService } from "./service/RetriveElementService";
import { HOST_SETTINGS_KEY } from "./service/SettingsFacade";
import { EndevorDataProvider } from "./ui/tree/EndevorDataProvider";
import { EndevorNode } from "./ui/tree/EndevorNodes";
import { HostPanel } from "./ui/views/HostPanel";
import { HostDialogs } from "./commands/HostDialogs";
import { multipleElementsSelected } from "./utils";

export function activate(context: vscode.ExtensionContext) {
    const endevorDataProvider = new EndevorDataProvider();
    const gitBridgeSupport = new GitBridgeSupport();
    const retrieveElementService: RetrieveElementService = new RetrieveElementService(gitBridgeSupport);
    gitBridgeSupport.register(context);
    EndevorController.instance.loadRepositories();

    const endevorExplorerView: vscode.TreeView<EndevorNode> = vscode.window.createTreeView("endevorExplorer", {
        treeDataProvider: endevorDataProvider,
    });
    endevorExplorerView.onDidCollapseElement(event => {
        event.element.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    });
    endevorExplorerView.onDidExpandElement(event => {
        event.element.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    });
    context.subscriptions.push(endevorExplorerView);
    try {
        endevorExplorerView.onDidChangeSelection(() => {
            vscode.commands.executeCommand(
                "setContext",
                "multipleSelection",
                multipleElementsSelected(endevorExplorerView.selection),
            );
        });
    } catch (ignore) {
        // tslint:disable-next-line:no-console
        console.warn(ignore);
        vscode.commands.executeCommand("setContext", "multipleSelection", false);
    }
    context.subscriptions.push(
        vscode.commands.registerCommand("endevorexplorer.newHost", () => {
            HostDialogs.addHost();
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("endevorexplorer.updateHost", (arg: any) => {
            if (arg.contextValue === "repository") {
                const repo: Repository | undefined = arg.getRepository();
                if (repo) {
                    HostDialogs.editHost(repo);
                }
            }
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("endevorexplorer.refreshRepo", (arg: any) => {
            EndevorController.instance.updateNeedReloadInTree(true, arg);
            endevorDataProvider.refresh();
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("endevorexplorer.refreshHosts", () => {
            EndevorController.instance.updateNeedReloadInTree(true, EndevorController.instance.rootNode);
            endevorDataProvider.refresh();
        }),
    );
    context.subscriptions.push(vscode.commands.registerCommand(Commands.AddFilter, addFilter));
    context.subscriptions.push(vscode.commands.registerCommand(Commands.EditFilter, editFilter));
    context.subscriptions.push(vscode.commands.registerCommand(Commands.DeleteFilter, deleteFilter));
    context.subscriptions.push(vscode.commands.registerCommand(Commands.DeleteHost, deleteHost));
    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.RetrieveElement, (arg: any) => {
            retrieveElement(arg, endevorExplorerView.selection, retrieveElementService);
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(Commands.RetrieveWithDependencies, (arg: any) => {
            retrieveWithDependencies(arg, retrieveElementService);
        }),
    );
    context.subscriptions.push(vscode.commands.registerCommand(Commands.BrowseElement, browseElement));

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(HOST_SETTINGS_KEY)) {
                EndevorController.instance.loadRepositories();
                endevorDataProvider.refresh();
            }
        }),
    );
    gitBridgeSupport.searchImports(context);
}

// tslint:disable-next-line: no-empty
export function deactivate() {}
