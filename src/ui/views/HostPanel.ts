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

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { EndevorController } from "../../EndevorController";
import { DataSource } from "../../model/IEndevorInstance";
import { Repository } from "../../model/Repository";
import { EndevorRestClient } from "../../service/EndevorRestClient";

export class HostPanel {
    public static readonly viewType = "endevorHostPanel";
    public static createOrShow(context: vscode.ExtensionContext, repo?: Repository) {
        if (!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)) {
            vscode.window.showErrorMessage("Specify workspace before creating repository.");
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            HostPanel.viewType,
            repo ? repo.getName() : "New Endevor Host",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );
        const filePath: vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, "resources", "hostpanel.html"));
        panel.webview.html = fs
            .readFileSync(filePath.fsPath, "utf8")
            .split("${name}")
            .join(repo ? repo.getName() : "New host");
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case "update":
                        const name = message.data.name;
                        const url = message.data.url;
                        const username = message.data.username;
                        const password = message.data.password;
                        const datasource = message.data.configuration;

                        if (EndevorController.instance.findRepoByName(name)) {
                            vscode.window.showErrorMessage("Host with name " + name + " already exists");
                            return;
                        }
                        const targetRepo: Repository = new Repository(name, url, username, password, datasource);
                        EndevorController.instance.addRepository(targetRepo);
                        EndevorController.instance.saveRepositories();
                        panel.dispose();
                        break;
                    case "configuration":
                        const restUrl = message.data.url;
                        const newRepo = new Repository("", restUrl, "", "", "");
                        try {
                            const datasources: DataSource[] = await EndevorRestClient.listDatasources(newRepo);
                            const dsNames: string[] = [];
                            for (const ds of datasources) {
                                dsNames.push(ds.name);
                            }
                            dsNames.sort();
                            panel.webview.postMessage({ data: dsNames });
                        } catch (error) {
                            // TODO maybe improve error handling here
                            panel.webview.postMessage({ data: [] });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions,
        );
    }
    public static editHost(context: vscode.ExtensionContext, repo: Repository) {
        const panel = vscode.window.createWebviewPanel(
            HostPanel.viewType,
            repo ? repo.getName() : "New Endevor Host",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            },
        );

        const filePath: vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, "resources", "edithost.html"));
        panel.webview.html = fs
            .readFileSync(filePath.fsPath, "utf8")
            .split("${name}")
            .join(repo.getName().replace(/\"/g, "&quot;"))
            .split("${username}")
            .join(repo ? repo.getUsername() : "")
            .split("${url}")
            .join(repo ? repo.getUrl() : "")
            .split("${datasource}")
            .join(repo ? repo.getDatasource() : "")
            .split("${password}")
            .join(repo.getPassword() !== undefined ? repo.getPassword() : "");
        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command !== "editHost") {
                    return;
                }
                const name = message.data.name;
                const username = message.data.username;
                const password = message.data.password;
                if (EndevorController.instance.findRepoByName(name) && repo.getName() !== name) {
                    vscode.window.showErrorMessage("Host with name " + name + " already exists");
                    return;
                }
                repo.setName(name);
                repo.setUsername(username);
                repo.setPassword(password);
                EndevorController.instance.saveRepositories();
                panel.dispose();
            },
            undefined,
            context.subscriptions,
        );
    }
}
