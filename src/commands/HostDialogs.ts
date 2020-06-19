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

import { URL } from "url";
import { ProgressLocation, window, workspace } from "vscode";
import { EndevorController } from "../EndevorController";
import { Repository } from "../model/Repository";
import { proxyGetDsNamesFromInstance } from "../service/EndevorCliProxy";
import { Profiles } from "../service/Profiles";
import * as utils from "../utils";
import * as vscode from "vscode";
import { Connection } from "../model/Connection";


export class HostDialogs {
    public static async addConnection() {
        const allProfiles = (Profiles.getInstance()).allProfiles;
        const createNewProfile = "Create a New Endevor Profile";
        let chosenProfile: string;

        let profileNamesList = allProfiles.map(profile => {
            return profile.name;
        });

        if (profileNamesList) {
            profileNamesList = profileNamesList.filter(profileNames =>
                !EndevorController.instance.getConnections().find((connection: Connection) =>
                    connection.getName() === profileNames,
                ),
            );
        }
        const createPick = new utils.FilterDescriptor("\uFF0B " + createNewProfile);
        const items: vscode.QuickPickItem[] = profileNamesList.map(element => new utils.FilterItem(element));
        const placeholder = "Choose \"Create new...\" to define a new profile or select an existing one";

        const quickpick = vscode.window.createQuickPick();
        quickpick.items = [createPick, ...items];
        quickpick.placeholder = placeholder;
        quickpick.ignoreFocusOut = true;
        quickpick.show();
        const choice = await utils.resolveQuickPickHelper(quickpick);
        quickpick.hide();
        if (!choice) {
            vscode.window.showInformationMessage("No selection made.");
            return;
        }
        if (choice instanceof utils.FilterDescriptor) {
            chosenProfile = "";
        } else {
            chosenProfile = choice.label;
        }

        if (chosenProfile === "") {
            let newProfileName: any;
            let profileName: string;
            const options = {
                placeHolder: "Profile Name",
                prompt: "Enter a name for the profile",
                value: profileName,
            };
            profileName = await vscode.window.showInputBox(options);
            if (!profileName) {
                vscode.window.showInformationMessage("Profile Name was not supplied. Operation Cancelled");
                return;
            }
            chosenProfile = profileName;
            try {
                newProfileName = await Profiles.getInstance().createNewConnection(chosenProfile);
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
            if (newProfileName) {
                try {
                    const newProfile = Profiles.getInstance().listProfiles().find(
                        profile => profile.name === newProfileName);
                    const profileToAdd = new Connection(newProfile);
                    EndevorController.instance.addConnection(profileToAdd);
                } catch (error) {
                    vscode.window.showErrorMessage("Error while adding new profile");
                }
            }
        } else if (chosenProfile) {
            const profileToAdd = new Connection(allProfiles.find(profile => profile.name === chosenProfile));
            EndevorController.instance.addConnection(profileToAdd);
        } else {
            vscode.window.showInformationMessage("Operation cancelled");
        }
    }
    /**
     * Add host.
     * @param
     * @returns
     */
    public static async addHost(connection) {
        if (!(workspace.workspaceFolders && workspace.workspaceFolders.length > 0)) {
            window.showErrorMessage("Specify workspace before creating repository.");
            return;
        }

        const profile = connection.getEntity().getProfile();
        const url = `${profile.protocol}://${profile.host}:${profile.port}`;
        // TODO: add dataSource here when we import endevor-connection profile
        const dataSource = "";
        const newRepo = new Repository("", url, profile.user, profile.password, dataSource, connection.label);

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
                    if (EndevorController.instance.isRepoInConnection(dsItem.label, connection.label)) {
                        window.showErrorMessage("Configuration with name " + dsItem.label + " already exists in this session.");
                        return;
                    }

                    newRepo.setName(dsItem.label);
                    newRepo.setDatasource(dsItem.label);
                    EndevorController.instance.addRepository(newRepo, connection.getEntity().getName());
                    EndevorController.instance.updateSettings();
                    window.showInformationMessage("Configuration " + dsItem.label + " was added.");
                } catch (error) {
                    window.showErrorMessage("The host " + newRepo.getUrl() + " is not available.");
                }
            },
        );
    }

    public static async editHost(context) {
        const repo: Repository | undefined = context.getRepository();
        if (repo) {
            const newName =  await HostDialogs.showHostNameInput(repo);

            if (newName === undefined) {
                return;
            }
            if (EndevorController.instance.isRepoInConnection(newName, repo.getProfileLabel())) {
                window.showErrorMessage("Configuration with name " + newName + " already exists");
                return;
            }
            const oldName = repo.getName();
            EndevorController.instance.updateRepositoryName(oldName, newName, repo.getProfileLabel());
            EndevorController.instance.updateSettings();
            window.showInformationMessage(`Configuration ${oldName} was renamed to ${newName}.`);
        }
    }

    private static async showHostNameInput(repo: Repository): Promise<string | undefined> {
        return window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: "Configuration name",
            prompt: "Enter a custom name for the configuration.",
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
