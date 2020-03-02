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
import { EndevorElementNode } from "./ui/tree/EndevorNodes";

export function toArray<T>(data: any): T[] {
    if (Array.isArray(data)) {
        return data as T[];
    } else if(data) {
        return [data] as T[];
    } else {
        return [];
    }
}

export function constructFilterName(uri: string): string {
    let name: string = "";
    const splitString = uri.split("/");
    splitString.forEach(member => {
        if (
            !(
                member === "env" ||
                member === "stgnum" ||
                member === "sys" ||
                member === "subsys" ||
                member === "type" ||
                member === "ele"
            )
        ) {
            name = name + "/" + member;
        }
    });
    return name.replace("//", "/");
}

export function constructFilterUri(uri: string): string {
    const uriFormatted: string = "";

    return uriFormatted;
}

export function prepareElementNodesForRetrieve(selection: any[]): EndevorElementNode[] {
    const selectedElementNodes: EndevorElementNode[] = [];
    for (let i = 0; i < selection.length; i++) {
        if (selection[i] instanceof EndevorElementNode) {
            selectedElementNodes.push(selection[i]);
        }
    }
    return selectedElementNodes;
}

export function multipleElementsSelected(selection: any[]): boolean {
    if (selection.length > 1) {
        return true;
    } else {
        return false;
    }
}
