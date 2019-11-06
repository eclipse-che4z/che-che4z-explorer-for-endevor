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
import { Element } from "../model/Element";
import { IElement, IType } from "../model/IEndevorEntities";
import { EndevorQualifier } from "../model/IEndevorQualifier";
import { Repository } from "../model/Repository";
import { EndevorRestClient, Resource } from "./EndevorRestClient";
import { GitBridgeSupport } from "./GitBridgeSupport";

export class RetrieveElementService {
    constructor(private gitBridge: GitBridgeSupport) {}

    public async retrieveElement(
        workspace: vscode.WorkspaceFolder,
        repo: Repository,
        elementName: string,
        eq: EndevorQualifier,
    ): Promise<string> {
        const data: any = await EndevorRestClient.retrieveElement(repo, eq, false);
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
        const elements: IElement[] = await EndevorRestClient.retrieveElementDependencies(repo, eq);
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
        const typeQualifier: EndevorQualifier = {
            env: eq.env,
            stage: eq.stage,
            system: eq.system,
            type: eq.type,
        };
        const types: IType[] = await EndevorRestClient.getMetadata(repo, typeQualifier, Resource.TYPE);
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
