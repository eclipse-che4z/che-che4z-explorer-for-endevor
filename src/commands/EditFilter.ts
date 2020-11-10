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

import { filterStringValidator } from '../FilterUtils';
import { EndevorFilter } from '../model/EndevorFilter';
import { EndevorController } from '../EndevorController';
import { EndevorNode } from '../ui/tree/EndevorNodes';
import * as vscode from 'vscode';

export function editFilter(arg: any) {
    let inputBoxOptions: vscode.InputBoxOptions = {
        value: arg.getEntity().getName(),
        prompt: 'Edit filter.',
        placeHolder: 'env/stgnum/sys/subsys/type/element',
        ignoreFocusOut: true,
        validateInput(value: string) {
            return filterStringValidator(arg.getRepository(), value);
        },
    };
    vscode.window.showInputBox(inputBoxOptions).then((filterUri) => {
        if (filterUri) {
            if (arg.contextValue === 'filter') {
                const filter: EndevorFilter | undefined = <EndevorFilter>(
                    arg.getEntity()
                );
                if (filter.getUri() !== filterUri) {
                    filter.editFilter(filterUri);
                    (<EndevorNode>arg).children = [];
                    EndevorController.instance.updateSettings();
                }
            }
        }
    });
}
