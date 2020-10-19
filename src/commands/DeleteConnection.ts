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

import { Repository } from "../model/Repository";
import { EndevorController } from "../EndevorController";
import * as vscode from "vscode";
import { logger } from "../globals";

export function deleteConnection(arg: any) {
    if (arg.contextValue === "connection") {
        logger.trace(`Remove session ${arg.label}`);
        vscode.window
            .showWarningMessage("Remove session?", "OK", "Cancel")
            .then(selection => {
                if (selection === "OK") {
                    EndevorController.instance.removeConnection(arg.label);
                    vscode.commands.executeCommand(
                        "endevorexplorer.refreshHosts"
                    );
                    logger.info("Session removed.");
                    EndevorController.instance.updateSettings();
                } else {
                    logger.info("Operation cancelled.");
                }
            });
    }
}
