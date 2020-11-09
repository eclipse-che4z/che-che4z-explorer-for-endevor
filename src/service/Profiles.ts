/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import { EndevorProfilesConfig } from "@broadcom/endevor-for-zowe-cli";
import { CliProfileManager, ImperativeConfig, IProfile, IProfileLoaded, ISession, Logger, Session } from "@zowe/imperative";
import * as os from "os";
import * as path from "path";
import { URL } from "url";
import * as vscode from "vscode";
import { logger } from "../globals";
import { IConnection } from "../model/IConnection";

interface UrlValidator {
    valid: boolean;
    host: string;
    port: number;
    protocol: string;
}

export class Profiles {
    public static async createInstance(log: Logger) {
        Profiles.loader = new Profiles(log);
        await Profiles.loader.refresh();
        return Profiles.loader;

    }
    public static getInstance() {
        return Profiles.loader;
    }

    private static loader: Profiles;
    public allProfiles: IProfileLoaded[] = [];
    public defaultProfile: IProfileLoaded | undefined = undefined;
    private endevorProfileManager: CliProfileManager = undefined;

    // Commenting these because they are not used anywhere...
    // private spawnValue: number = -1;
    // private initValue: number = -1;
    private constructor(public log: Logger) {}

    public loadNamedProfile(name: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && profile.type === "endevor") {
                return profile;
            }
        }
        throw new Error("Could not find profile named: "
            + name + ".");
    }
    public getDefaultProfile(): IProfileLoaded {
        return this.defaultProfile;
    }
    public async refresh() {
        // Why is this here? Commenting it because it seems useless...?
        // EndevorProfilesConfig
        this.allProfiles = [];
        const profileManager = this.getEndevorCliProfileManager();
        const endevorProfiles = (await (await profileManager).loadAll()).filter(profile => {
            return profile.type === "endevor";
        });
        if (endevorProfiles && endevorProfiles.length > 0) {
            this.allProfiles.push(...endevorProfiles);
            let defaultProfile: IProfileLoaded;
            try {
                defaultProfile = await (await profileManager).load({ loadDefault: true});
                this.defaultProfile = defaultProfile ? defaultProfile : undefined;
            } catch (error) {
                logger.error(error.message);
            }
        }
    }

    public listProfiles() {
        return this.allProfiles;
    }

    public validateAndParseUrl = (newUrl: string): UrlValidator => {
        let url: URL;
        const validProtocols: string[] = ["https", "http"];

        const validationResult: UrlValidator = {
            host: null,
            port: null,
            protocol: null,
            valid: false,
        };

        try {
            url = new URL(newUrl);
        } catch (error) {
            return validationResult;
        }

        // overkill with only one valid protocol, but we may expand profile types and protocols in the future?
        if (!validProtocols.some((validProtocol: string) => url.protocol.includes(validProtocol))) {
            return validationResult;
        } else {
            validationResult.protocol = url.protocol.replace(":", "");
        }

        if (!url.port.trim()) {
            return validationResult;
        } else {
            validationResult.port = Number(url.port);
        }

        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    public async getUrl(urlInputBox): Promise<string | undefined> {
        return new Promise<string | undefined> (resolve => {
            urlInputBox.onDidHide(() => { resolve(urlInputBox.value); });
            urlInputBox.onDidAccept(() => {
                if (this.validateAndParseUrl(urlInputBox.value).valid) {
                    resolve(urlInputBox.value);
                } else {
                    urlInputBox.validationMessage = "Please enter a valid URL in the format http(s)://url:port.";
                }
            });
        });
    }

    public async createNewConnection(profileName: string): Promise<string | undefined> {
        let userName: string;
        let passWord: string;
        let endevorURL: string;
        let rejectUnauthorize: boolean;
        let options: vscode.InputBoxOptions;

        const urlInputBox = vscode.window.createInputBox();
        urlInputBox.ignoreFocusOut = true;
        urlInputBox.placeholder = "http(s)://url:port";
        urlInputBox.prompt = "Enter an Endevor URL in the format 'http(s)://url:port'.";

        urlInputBox.show();
        endevorURL = await this.getUrl(urlInputBox);
        urlInputBox.dispose();

        if (!endevorURL) {
            logger.info("No valid value for Endevor URL. Operation Cancelled");
            return undefined;
        }

        const endevorUrlParsed = this.validateAndParseUrl(endevorURL);

        options = {
            placeHolder: "Optional: User Name",
            prompt: "Enter the user name for the connection. Leave blank to not store.",
            value: userName,
        };
        userName = await vscode.window.showInputBox(options);

        if (userName === undefined) {
            logger.info("Operation Cancelled");
            return;
        }

        options = {
            password: true,
            placeHolder: "Optional: Password",
            prompt: "Enter the password for the connection. Leave blank to not store.",
            value: passWord,
        };
        passWord = await vscode.window.showInputBox(options);

        if (passWord === undefined) {
            logger.info("Operation Cancelled");
            return;
        }

        const quickPickOptions: vscode.QuickPickOptions = {
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Reject Unauthorized Connections",
        };

        const selectRU = ["True - Reject connections with self-signed certificates",
            "False - Accept connections with self-signed certificates"];

        const ruOptions = Array.from(selectRU);

        const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);

        if (chosenRU === ruOptions[0]) {
            rejectUnauthorize = true;
        } else if (chosenRU === ruOptions[1]) {
            rejectUnauthorize = false;
        } else {
            logger.info("Operation Cancelled");
            return undefined;
        }

        for (const profile of this.allProfiles) {
            if (profile.name === profileName) {
                logger.error("Profile name already exists. Please create a profile using a different name");
                return undefined;
            }
        }

        const connection: IConnection = {
            host: endevorUrlParsed.host,
            name: profileName,
            password: passWord,
            port: endevorUrlParsed.port,
            protocol: endevorUrlParsed.protocol,
            rejectUnauthorized: rejectUnauthorize,
            user: userName,
        };

        let newProfile: IProfile;

        try {
            newProfile = await this.saveProfile(connection, connection.name, "endevor");
        } catch (error) {
            logger.error("Error saving profile", error.message);
        }
        await this.createBasicEndevorSession(newProfile);
        logger.info(`Profile ${profileName} was created.`);
        await this.refresh();
        return profileName;
    }

    public async createBasicEndevorSession(profile) {
        logger.trace(`Creating an Endevor session from the profile named ${profile.name}`);
        return new Session({
            base64EncodedAuth: profile.auth,
            basePath: profile.basePath,
            hostname: profile.host,
            password: profile.password,
            port: profile.port,
            rejectUnauthorized: profile.rejectUnauthorized,
            type: "basic",
            user: profile.user,
        });
    }

    public async promptCredentials(sessName) {
        let userName: string;
        let passWord: string;
        let options: vscode.InputBoxOptions;

        const loadProfile = this.loadNamedProfile(sessName);
        const loadSession = loadProfile.profile as ISession;

        if (!loadSession.user) {

            options = {
                placeHolder: "User Name",
                prompt: "Enter the user name for the connection",
                value: userName,
            };
            userName = await vscode.window.showInputBox(options);

            if (!userName) {
                logger.error("Please enter your z/OS username. Operation Cancelled");
                return;
            } else {
                loadSession.user = userName;
            }
        }

        if (!loadSession.password) {
            passWord = loadSession.password;

            options = {
                password: true,
                placeHolder: "Password",
                prompt: "Enter a password for the connection",
                value: passWord,
            };
            passWord = await vscode.window.showInputBox(options);

            if (!passWord) {
                logger.error("Please enter your z/OS password. Operation Cancelled");
                return;
            } else {
                loadSession.password = passWord.trim();
            }
        }
        const updSession = await this.createBasicEndevorSession(loadSession as IProfile);
        return [updSession.ISession.user, updSession.ISession.password, updSession.ISession.base64EncodedAuth];
    }

    public async getEndevorCliProfileManager(): Promise<CliProfileManager> {
        let profileManager = this.endevorProfileManager;
        if (!profileManager) {
            try {
                await CliProfileManager.initialize(
                    {
                        configuration: EndevorProfilesConfig,
                        profileRootDirectory: path.join(this.getZoweDir(), "profiles"),
                        reinitialize: false});
                profileManager = new CliProfileManager({
                    profileRootDirectory: path.join(this.getZoweDir(), "profiles"),
                    type: "endevor",
                });
                this.endevorProfileManager = profileManager;
            } catch (error) {
                logger.error("Failed to load Imperative Profile Manager.", error.message);
            }
        }
        return profileManager;
    }

    private getZoweDir(): string {
        ImperativeConfig.instance.loadedConfig = {
            defaultHome: path.join(os.homedir(), ".zowe"),
            envVariablePrefix: "ZOWE",
        };
        return ImperativeConfig.instance.cliHome;
    }

    private async saveProfile(ProfileInfo, ProfileName, ProfileType) {
        let endevorProfile: IProfile;
        try {
            endevorProfile = await (await this.getEndevorCliProfileManager()).save({
                name: ProfileName,
                profile: ProfileInfo,
                type: ProfileType });
        } catch (error) {
            logger.error("Error saving profile.", error.message);
        }
        return endevorProfile.profile;
    }
}
