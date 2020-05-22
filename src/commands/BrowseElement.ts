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
import { EndevorQualifier } from "../model/IEndevorQualifier";
import { Repository } from "../model/Repository";
import { proxyBrowseElement } from "../service/EndevorCliProxy";

export async function browseElement(arg: any) {
    const repo: Repository = arg.getRepository();
    const elementName: string = arg.label;
    const eq: EndevorQualifier = arg.getQualifier();
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Loading: ${elementName}...`,
        },
        async progress => {
            progress.report({ increment: 10 });
            try {
                const data = await proxyBrowseElement(repo, eq);
                progress.report({ increment: 50 });
                let doc: vscode.TextDocument | undefined;
                doc = await vscode.workspace.openTextDocument({ content: data });
                progress.report({ increment: 100 });
                return vscode.window.showTextDocument(doc, { preview: false });
            } catch (error) {
                if (!error.cancelled) {
                    vscode.window.showErrorMessage(error.error);
                }
            }
        },
    );
}
