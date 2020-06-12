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

import { Repository } from "../model/Repository";
import { EndevorController } from "../EndevorController";
import * as vscode from 'vscode';

export function deleteHost(arg:any){
    if (arg.contextValue === "repository") {
        const repo: Repository | undefined = arg.getRepository();
        if (repo) {
            vscode.window.showWarningMessage("Delete connection: " + repo.getName() + "?", "OK").then(message => {
                if (message === "OK") {
                    EndevorController.instance.removeRepository(repo.getName(), repo.getProfileLabel());
                    EndevorController.instance.updateSettings();
                }
            });
        }
    }
}
