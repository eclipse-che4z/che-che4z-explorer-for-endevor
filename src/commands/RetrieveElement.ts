/* eslint-disable @typescript-eslint/no-explicit-any */
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

import * as vscode from "vscode";
import { logger } from "../globals";
import { EndevorQualifier } from "../model/IEndevorQualifier";
import { Repository } from "../model/Repository";
import { RetrieveElementService } from "../service/RetrieveElementService";
import { EndevorElementNode, EndevorNode } from "../ui/tree/EndevorNodes";
import { prepareElementNodesForRetrieve } from "../utils";

export async function retrieveElement(
        arg: any,
        selection: EndevorNode[],
        retrieveElementService: RetrieveElementService,
    ) {
    await vscode.window.withProgress(
        {
            cancellable: true,
            location: vscode.ProgressLocation.Notification,
            title: "Retrieving element",
        },
        async (progress, token) => {
            if (token) {
                token.onCancellationRequested(() => {
                    logger.info("Retrieve Cancelled.");
                });
            }
            const processedSelection: EndevorElementNode[] = prepareElementNodesForRetrieve(selection);
            if (processedSelection.length === 0) {
                processedSelection.push(arg);
            }
            const incrementNumber = 100 / processedSelection.length;
            if (!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)) {
                logger.error("Specify workspace before retrieving elements");
                return;
            }
            const workspace = vscode.workspace.workspaceFolders[0];
            for (let i = 0; i < processedSelection.length; i++) {
                if (token && token.isCancellationRequested) {
                    return;
                }
                const currentElement: EndevorElementNode = processedSelection[i];

        const repo: Repository | undefined = currentElement.getRepository();
        const elementName: string | undefined = currentElement.label;
        const eq: EndevorQualifier | undefined = currentElement.getQualifier();
        if (!(repo && elementName && eq)) {
          throw new Error(JSON.stringify({ repo, elementName, eq }));
        }
        try {
          progress.report({
            message: `(${i + 1}/${processedSelection.length}) ${elementName}`,
          });
          const filePath: string = await retrieveElementService.retrieveElement(
            workspace,
            repo,
            elementName,
            eq
          );
          const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(
            filePath
          );
          vscode.window.showTextDocument(doc, { preview: false });

          progress.report({
            increment: incrementNumber,
            message: `(${i + 1}/${processedSelection.length}) ${elementName}`,
          });
        } catch (error) {
          retrieveElementService.processRetrieveElementError(error);
        }
      }
    }
  );
}
