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
import { URL } from "url";
import * as vscode from "vscode";
import { Repository } from "../model/Repository";
import { SettingsFacade } from "./SettingsFacade";

const METADATA_FILE: string = ".gbmapping";

export class GitBridgeSupport {
    public static fetchGitBridgeInformation(): GitBridgeInformation | undefined {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        const metafilePath = vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, METADATA_FILE))
            .fsPath;
        if (fs.existsSync(metafilePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(metafilePath).toString()).endevor;
                // check url
                // tslint:disable-next-line: no-unused-expression
                new URL(data.baseUrl);
                return data;
            } catch (error) {
                if (error.message) {
                    vscode.window.showWarningMessage(`${error.message} in ${metafilePath}`);
                } else {
                    vscode.window.showWarningMessage(JSON.stringify(error));
                }
            }
        }
        return undefined;
    }

    public register(context: vscode.ExtensionContext) {
        const metadataWatcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(
            "**/" + METADATA_FILE,
            false,
            false,
            true,
        );
        context.subscriptions.push(metadataWatcher.onDidCreate(this.metaimport));
        context.subscriptions.push(metadataWatcher.onDidChange(this.metaimport));
    }

    public createElementPath(workspace: vscode.WorkspaceFolder, type: string): string {
        const gitBridge: GitBridgeInformation | undefined = GitBridgeSupport.fetchGitBridgeInformation();
        const wsPath: string = workspace.uri.fsPath;
        if (!gitBridge) {
            return path.join(wsPath, type);
        }

        return path.join(
            wsPath,
            gitBridge.environment,
            gitBridge.stageNumber,
            gitBridge.system,
            gitBridge.subsystem,
            type,
        );
    }

    public searchImports(context: vscode.ExtensionContext) {
        vscode.workspace.findFiles(METADATA_FILE).then(async (uris: vscode.Uri[]) => {
            for (const uri of uris) {
                if (
                    context.workspaceState.get("gitbridgemetaimport" + uri.path) !== "skip" &&
                    (await this.metaimport(uri)) === "Ignore"
                ) {
                    context.workspaceState.update("gitbridgemetaimport" + uri.path, "skip");
                }
            }
        });
    }

    private async metaimport(metafilePath: vscode.Uri) {
        const data: GitBridgeInformation | undefined = GitBridgeSupport.fetchGitBridgeInformation();
        if (data === undefined) {
            return;
        }
        const configuration: string = data.configuration;
        const hostURL = new URL(data.baseUrl);
        const repoUrl: string = hostURL.protocol + "//" + hostURL.hostname + ":" + hostURL.port;
        const hostName = repoUrl;

        for (const repo of SettingsFacade.listRepositories()) {
            if (repo.getUrl() === repoUrl) {
                // Ignore if repository is exists
                return;
            }
        }

        const result = await vscode.window.showInformationMessage(
            `Import host(${hostName}) from ${metafilePath.fsPath}?`,
            "Import",
            "Ignore",
        );
        if (result === "Import") {
            const repos: Repository[] = SettingsFacade.listRepositories();
            // TODO: check profileLabel implications here
            const newRepo: Repository = new Repository(hostName, repoUrl, "", undefined, configuration, "");
            repos.push(newRepo);
            // TODO: FIX ME
            // SettingsFacade.updateRepositories(repos);
        }
        return result;
    }
}

// tslint:disable-next-line:interface-name
export interface GitBridgeInformation {
    baseUrl: string;
    configuration: string;
    environment: string;
    stageNumber: string;
    system: string;
    subsystem: string;
}
