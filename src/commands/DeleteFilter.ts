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

import { EndevorFilter } from "../model/EndevorFilter";
import { EndevorController } from "../EndevorController";
import * as vscode from 'vscode';


export function deleteFilter(arg: any) {
    if (arg.contextValue === "filter") {
        const filter: EndevorFilter | undefined = <EndevorFilter>arg.getEntity();
        if (filter) {
            vscode.window.showWarningMessage("Delete filter: " + filter.getName() + "?", "OK").then(message => {
                if (message === "OK") {
                    filter.deleteFilter();
                    EndevorController.instance.saveRepositories();
                }
            });
        }
    }
}
