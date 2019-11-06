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

import * as request from "request";
import { URL } from "url";
import * as vscode from "vscode";
import * as constants from "../constants";
import { RC_SIXTEEN, RC_TWENTY } from "../constants";
import { ActionResponse } from "../model/IActionResponse";
import { IElement, IEnvironment } from "../model/IEndevorEntities";
import { DataSource } from "../model/IEndevorInstance";
import { EndevorQualifier } from "../model/IEndevorQualifier";
import { Repository } from "../model/Repository";
import { CredentialsInputBox } from "../ui/tree/CredentialsInput";
import * as utils from "../utils";

export enum Resource {
    DATASOURCES = "datasources",
    ENV = "env",
    STGNUM = "stgnum",
    SYS = "sys",
    SUBSYS = "subsys",
    TYPE = "type",
    ELEMENT = "ele",
    DEPENDENCY = "dependency",
}

export class EndevorRestClient {
    public static async listDatasources(repo: Repository): Promise<DataSource[]> {
        const url: string = EndevorRestClient.createRequestPart(repo, {}, Resource.DATASOURCES);
        const result: Result = await EndevorRestClient.request(url, repo, undefined, true);
        return result.value as DataSource[];
    }

    public static async getMetadata(repo: Repository, qualifier: EndevorQualifier, resource: Resource): Promise<any[]> {
        const url: string = EndevorRestClient.createRequestPart(repo, qualifier, resource);
        const result: Result = await EndevorRestClient.request(url, repo);
        return utils.toArray(result.value.data);
    }

    /* Browse an existing element */
    public static async browseElement(repo: Repository, qualifier: EndevorQualifier): Promise<string> {
        const url = EndevorRestClient.createRequestPart(repo, qualifier, Resource.ELEMENT);
        const result: Result = await EndevorRestClient.request(url, repo, "text/plain", false, false);
        return result.value;
    }

    /* Retrieves an existing element */
    public static async retrieveElement(repo: Repository, qualifier: EndevorQualifier, search: boolean) {
        const seachParam: string = "&search=" + (search ? "yes" : "no");
        const url =
            EndevorRestClient.createRequestPart(repo, qualifier, Resource.ELEMENT) + "?noSignout=yes" + seachParam;
        const result: Result = await EndevorRestClient.request(url, repo, "application/octet-stream", false, false);
        return result.value;
    }

    /* Retrieves an existing element's dependencies*/
    public static async retrieveElementDependencies(
        repo: Repository,
        qualifier: EndevorQualifier,
    ): Promise<IElement[]> {
        const url = EndevorRestClient.createRequestPart(repo, qualifier, Resource.DEPENDENCY);
        const result: Result = await EndevorRestClient.request(url, repo);
        return utils.toArray(result.value.data);
    }

    // tslint:disable-next-line: cognitive-complexity
    private static async request(
        url: string,
        repo: Repository,
        mime?: string,
        isPasswordOptional: boolean = false,
        parseJson: boolean = true,
    ): Promise<Result> {
        const options = {
            headers: {
                Accept: mime ? mime : "application/json",
            },
            host: new URL(url).hostname,
            url,
        };

        // Process auth errors
        while (true) {
            if (!isPasswordOptional) {
                await EndevorRestClient.updateAuth(options, repo);
            }
            const result = await EndevorRestClient.doRequest(options, parseJson);
            if (result.status === 401) {
                isPasswordOptional = false;
                vscode.window.showInformationMessage("Authintification failed");
                result.authError = true;
                result.error = "Authintification failed";
            }
            if (result.status === 500) {
                const actionResponse: ActionResponse = (parseJson
                    ? result.value
                    : JSON.parse(result.value)) as ActionResponse;
                switch (actionResponse.returnCode) {
                    case RC_TWENTY:
                        isPasswordOptional = false;
                        vscode.window.showErrorMessage("Invalid Credentials Provided");
                        result.authError = true;
                        result.error = "Invalid Credentials Provided";
                        break;
                    case RC_SIXTEEN:
                        isPasswordOptional = false;
                        vscode.window.showErrorMessage("Missing Username or Password");
                        result.authError = true;
                        result.error = "Missing Username or Password";
                        break;
                }
            }
            if (result.authError) {
                repo.setPassword("");
            }
            if (!result.authError || result.cancelled) {
                this.processError(result);
                return result;
            }
        }
    }

    // tslint:disable-next-line:cognitive-complexity
    private static async doRequest(options, parseJson: boolean = true): Promise<Result> {
        return new Promise<Result>((resolve, reject) => {
            request.get(options, (error, response, body) => {
                if (error) {
                    reject({
                        cancelled: false,
                        error: JSON.stringify(error),
                    });
                    return;
                }
                const result: Result = {
                    cancelled: false,
                    status: response.statusCode,
                };
                if (response && response.statusCode.toString().startsWith("4")) {
                    result.error = JSON.stringify(response.body);
                }
                if (response && !response.statusCode.toString().startsWith("2") && !result.error) {
                    result.error = response.statusMessage;
                }
                if (parseJson) {
                    try {
                        result.value = JSON.parse(body);
                    } catch (error) {
                        result.error = JSON.stringify(error);
                    }
                } else {
                    result.value = body;
                }
                resolve(result);
            });
        });
    }

    private static async updateAuth(options: any, repo: Repository) {
        if (!repo.getPassword()) {
            const creds = await CredentialsInputBox.askforCredentials(repo);
            if (!creds) {
                throw { cancelled: true };
            }
        }
        // tslint:disable-next-line:no-string-literal
        options.headers["Authorization"] =
            "Basic " + Buffer.from(repo.getUsername() + ":" + repo.getPassword()).toString("base64");
    }

    private static processError(result: Result) {
        if (!result.error) {
            return;
        }
        if (result.cancelled || !result.value) {
            throw result;
        }
        try {
            const msgs = JSON.parse(result.value).messages;
            if (Array.isArray(msgs)) {
                result.error = msgs.join("\n");
            } else {
                result.error = JSON.stringify(msgs);
            }
        } catch (ignore) {
            // noop
        }
        throw result;
    }

    private static createRequestPart(repo: Repository, qualifier: EndevorQualifier, resource: Resource): string {
        let url = repo.getUrlString();
        if (!url.endsWith("/")) {
            url = url + "/";
        }
        const prepQual: EndevorQualifier = {
            env: qualifier.env ? EndevorRestClient.prepUrlSegment(qualifier.env) : constants.ASTERISK,
            stage: qualifier.stage ? EndevorRestClient.prepUrlSegment(qualifier.stage) : constants.ASTERISK,
            system: qualifier.system ? EndevorRestClient.prepUrlSegment(qualifier.system) : constants.ASTERISK,
            // tslint:disable-next-line:object-literal-sort-keys
            subsystem: qualifier.subsystem ? EndevorRestClient.prepUrlSegment(qualifier.subsystem) : constants.ASTERISK,
            type: qualifier.type ? EndevorRestClient.prepUrlSegment(qualifier.type) : constants.ASTERISK,
            element: qualifier.element ? EndevorRestClient.prepUrlSegment(qualifier.element) : constants.ASTERISK,
        };
        switch (resource) {
            case "datasources":
                break;
            case "env":
                url = url + `env/${prepQual.env}`;
                break;
            case "stgnum":
                url = url + `env/${prepQual.env}/stgnum/${prepQual.stage}`;
                break;
            case "sys":
                url = url + `env/${prepQual.env}/stgnum/${prepQual.stage}/sys/${prepQual.system}`;
                break;
            case "subsys":
                url =
                    url +
                    `env/${prepQual.env}/stgnum/${prepQual.stage}/sys/${prepQual.system}/subsys/${prepQual.subsystem}`;
                break;
            case "type":
                url = url + `env/${prepQual.env}/stgnum/${prepQual.stage}/sys/${prepQual.system}/type/${prepQual.type}`;
                break;
            case "ele":
                url =
                    url +
                    `env/${prepQual.env}/stgnum/${prepQual.stage}/sys/${prepQual.system}/subsys/${
                        prepQual.subsystem
                    }/type/${prepQual.type}/ele/${prepQual.element}`;
                break;
            case "dependency":
                url =
                    url +
                    `env/${prepQual.env}/stgnum/${prepQual.stage}/sys/${prepQual.system}/subsys/${
                        prepQual.subsystem
                    }/type/${prepQual.type}/ele/${prepQual.element}/acm`;
                break;
            default:
                throw new Error("Unexpected resource type: " + resource);
        }

        return url;
    }

    private static prepUrlSegment(seg: string): string {
        if (!seg) {
            throw Error("Url segment is undefined!");
        }
        if (seg.toString().startsWith("/")) {
            seg = seg.slice(1);
        }
        if (seg.toString().endsWith("/")) {
            seg = seg.slice(0, -1);
        }
        return seg;
    }
}

interface Result {
    error?: string;
    authError?: boolean;
    value?: any;
    cancelled: boolean;
    status?: number;
}
