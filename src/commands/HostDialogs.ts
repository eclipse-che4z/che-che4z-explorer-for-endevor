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

import { URL } from "url";
import { ProgressLocation, window, workspace } from "vscode";
import { EndevorController } from "../EndevorController";
import { Repository } from "../model/Repository";
import { proxyGetDsNamesFromInstance } from "../service/EndevorCliProxy";

export class HostDialogs {
    /**
     * Add host.
     * @param
     * @returns
     */
    public static async addHost() {
        if (!(workspace.workspaceFolders && workspace.workspaceFolders.length > 0)) {
            window.showErrorMessage("Specify workspace before creating repository.");
            return;
        }

        const url = await HostDialogs.showUrlInput();
        if (url === undefined) {
            return;
        }
        const newRepo = new Repository("", url, "", "", "");

        window.withProgress({
                location: ProgressLocation.Notification,
            },
            async progress => {
                progress.report({message: "Waiting for " + newRepo.getUrl() + " to respond.", increment: 10 });
                try {
                    const dsNames = await proxyGetDsNamesFromInstance(newRepo);
                    progress.report({ increment: 100 });
                    const dsItem = await window.showQuickPick(dsNames.map(label => ({ label })), {
                        ignoreFocusOut: true,
                    });
                    if (dsItem === undefined) {
                        return;
                    }
                    if (EndevorController.instance.findRepoByName(dsItem.label)) {
                        window.showErrorMessage("Host with name " + dsItem.label + " already exists");
                        return;
                    }

                    newRepo.setName(dsItem.label);
                    newRepo.setDatasource(dsItem.label);
                    EndevorController.instance.addRepository(newRepo);
                    EndevorController.instance.saveRepositories();
                    window.showInformationMessage("Connection " + dsItem.label + " was created.");
                } catch (error) {
                    window.showErrorMessage("The host " + newRepo.getUrl() + " is not available.");
                }
            },
        );
    }

    public static async editHost(repo: Repository) {

        const newName =  await HostDialogs.showHostNameInput(repo);

        if (newName === undefined) {
            return;
        }
        if (EndevorController.instance.findRepoByName(newName)) {
            window.showErrorMessage("Host with name " + newName + " already exists");
            return;
        }
        const oldName = repo.getName();
        repo.setName(newName);
        EndevorController.instance.saveRepositories();
        window.showInformationMessage(`Connection ${oldName} was renamed to ${newName}.`);
    }

    private static async showHostNameInput(repo: Repository): Promise<string | undefined> {
        return window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "Connection name",
            prompt: "Enter a custom name for the connection.",
            validateInput: (text: string) => (text !== "" ? "" : "Please use only characters A-z and 0-9."),
            value: repo.getName(),
        });
    }

    private static async showUrlInput(): Promise<string | undefined> {
        const validateUrl = (newUrl: string) => {
            let url: URL;
            try {
                url = new URL(newUrl);
            } catch (error) {
                return false;
            }
            return url.port ? true : false;
        };

        return window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "URL",
            prompt: "Enter a z/OS URL in the format 'http(s)://url:port'.",
            validateInput: (text: string) => (validateUrl(text) ? "" : "Please enter a valid URL."),
        });
    }
}
