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

import { IEndevorAcmComponents, IOptionListRequest, ListType, QueryACMComponents, RetrieveElement } from "@broadcom/endevor-for-zowe-cli";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Element } from "../model/Element";
import { IElement, IType } from "../model/IEndevorEntities";
import { EndevorQualifier } from "../model/IEndevorQualifier";
import { Repository } from "../model/Repository";
import * as utils from "../utils";
import { GitBridgeSupport } from "./GitBridgeSupport";

export class RetrieveElementService {
    constructor(private gitBridge: GitBridgeSupport) {}

    public async retrieveElement(
        workspace: vscode.WorkspaceFolder,
        repo: Repository,
        elementName: string,
        eq: EndevorQualifier,
    ): Promise<string> {
        const session = await utils.buildSession(repo);
        const element = utils.endevorQualifierToElement(eq, repo.getDatasource());
        const requestArgs = {
            nosignout: "yes",
        };
        const requestBody = RetrieveElement.setupRetrieveRequest(requestArgs);
        let data: string | undefined;
        try {
            const retrieveResult = await RetrieveElement.retrieveElement(session, element, requestBody);
            data = retrieveResult.data ? retrieveResult.data.toString() : undefined;
        } catch (error) {
            vscode.window.showErrorMessage(error);
        }
        const ext = await this.getExtension(repo, eq);
        const typeDirectory = this.gitBridge.createElementPath(workspace, eq.type!);
        if (!fs.existsSync(typeDirectory)) {
            fs.mkdirSync(typeDirectory);
        }
        const filePath: string = path.join(typeDirectory, elementName + (ext ? "." + ext : ""));
        fs.writeFileSync(filePath, data);

        return filePath;
    }

    public async processRetrieveElementError(error: any) {
        if (!error.cancelled) {
            vscode.window.showErrorMessage(error.error);
        }
    }

    /**
     * List dependencies
     * @returns list of dependencies with origin element. Origin element always first.
     */
    public async retrieveDependenciesList(repo: Repository, eq: EndevorQualifier): Promise<Element[]> {
        const result: Element[] = [];
        const session = await utils.buildSession(repo);
        const instance = repo.getDatasource();
        const endevorElement = utils.endevorQualifierToElement(eq, instance);
        const requestArguments = {
            excCirculars: "yes",
            excIndirect: "no",
            excRelated: "no",
        };
        const requestBody = QueryACMComponents.setupAcmComponentsRequest(requestArguments);
        const queryacmCompResponse = await QueryACMComponents.queryACMComponents(
            session,
            instance,
            endevorElement,
            requestBody);

        // TODO: IEndevorAcmComponents is not on par with IElement. Should we map it?
        // const elements: IElement[] = await EndevorRestClient.retrieveElementDependencies(repo, eq);
        const elements: any = queryacmCompResponse.data as IEndevorAcmComponents[];
        if (elements.length === 0) {
            return [];
        }
        const el = elements[0];
        result.push(new Element(repo, el));
        if (Object.getOwnPropertyDescriptor(el, "components")) {
            // tslint:disable-next-line: no-string-literal
            for (const dep of el["components"]) {
                if (dep.elmName.trim()) {
                    const element: Element = new Element(repo, dep);
                    result.push(element);
                }
            }
        }
        return result;
    }

    private async getExtension(repo: Repository, eq: EndevorQualifier): Promise<string> {
        const session = await utils.buildSession(repo);
        const instance = repo.getDatasource();
        const typeInput = utils.endevorQualifierToElement(eq, instance);
        const requestBody = ListType.setupListTypeRequest({});
        let types: IType[];
        const listResponse = await ListType.listType(session, instance, typeInput, requestBody);
        types = utils.toArray(listResponse.data);
        for (const type of types) {
            if (type.typeName === eq.type && type.fileExt) {
                return type.fileExt;
            }
        }
        vscode.window.showWarningMessage(
            `No fileExt information in element type ${eq.type} for ${eq.element}. Type name will be used.`,
        );
        return (eq.type as string).toLowerCase();
    }
}
