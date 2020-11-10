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

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Element } from '../model/Element';
import { EndevorQualifier } from '../model/IEndevorQualifier';
import { Repository } from '../model/Repository';
import {
    proxyRetrieveAcmComponents,
    proxyRetrieveElement,
    proxyListType,
} from './EndevorCliProxy';
import { logger } from '../globals';

export class RetrieveElementService {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    public async retrieveElement(
        workspace: vscode.WorkspaceFolder,
        repo: Repository,
        elementName: string,
        eq: EndevorQualifier
    ): Promise<string> {
        const data = await proxyRetrieveElement(repo, eq);
        const ext = await this.getExtension(repo, eq);
        const type = eq.type ? eq.type : '';
        const typeDirectory = path.join(workspace.uri.fsPath, type);
        if (!fs.existsSync(typeDirectory)) {
            fs.mkdirSync(typeDirectory);
        }
        const filePath: string = path.join(
            typeDirectory,
            elementName + (ext ? '.' + ext : '')
        );
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        fs.writeFileSync(filePath, data!);

        return filePath;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async processRetrieveElementError(error: any) {
        if (!error.cancelled) {
            logger.error('Error retrieving elements.', error.error);
        }
    }

    /**
     * List dependencies
     * @returns list of dependencies with origin element. Origin element always first.
     */
    public async retrieveDependenciesList(
        repo: Repository,
        eq: EndevorQualifier
    ): Promise<Element[]> {
        const result: Element[] = [];
        const elements = await proxyRetrieveAcmComponents(repo, eq);
        if (elements.length === 0) {
            return [];
        }
        const el = elements[0];
        result.push(new Element(repo, el));
        if (Object.getOwnPropertyDescriptor(el, 'components')) {
            for (const dep of el['components']) {
                if (dep.elmName.trim()) {
                    const element: Element = new Element(repo, dep);
                    result.push(element);
                }
            }
        }
        return result;
    }

    private async getExtension(
        repo: Repository,
        eq: EndevorQualifier
    ): Promise<string> {
        const types = await proxyListType(repo, eq);
        for (const type of types) {
            if (type.typeName === eq.type && type.fileExt) {
                return type.fileExt;
            }
        }
        logger.trace(
            `No fileExt information in element type ${eq.type} for ${eq.element}. Type name will be used.`
        );
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return (eq.type as string).toLowerCase();
    }
}
