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

import { IElementActionRequest, IElementBasicData} from "@broadcom/endevor-for-zowe-cli";
import { ISession, Session} from "@zowe/imperative";
import { EndevorQualifier } from "./model/IEndevorQualifier";
import { Repository } from "./model/Repository";
import { CredentialsInputBox } from "./ui/tree/CredentialsInput";
import { EndevorElementNode } from "./ui/tree/EndevorNodes";

export function toArray<T>(data: any): T[] {
    if (Array.isArray(data)) {
        return data as T[];
    } else if (data) {
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

// THROWAWAY: will be covered by profile implementation with Imperative profile management
export async function buildSession(repository: Repository): Promise<Session> {
    const protocol = repository.getUrl().split(":")[0];
    const hostname: string = repository.getUrl().split(":")[1].split("/")[2];
    // TODO: check how to enforce type (see with Vit)
    const port: any = repository.getUrl().split(":")[2];
    // make this readable
    const basePath: string = repository.getUrlString().split(":")[2].split("/")[1] +
        "/" + repository.getUrlString().split(":")[2].split("/")[2];

    // set password if not defined
    if (!repository.getPassword()) {
        const creds = await CredentialsInputBox.askforCredentials(repository)
        if (!creds) {
            throw { cancelled: true };
        }
    }
    const sessionDetails: ISession = {
        base64EncodedAuth: Buffer.from(repository.getUsername() + ":" + repository.getPassword()).toString("base64"),
        basePath,
        hostname,
        // password: repository.getPassword(),
        port,
        // TODO: figure out how to cast this shit (see with Vit)
        protocol: "http",
        rejectUnauthorized: false,
        type: "basic",
        // strictSSL: true,
        // secureProtocol: 'SSLv23_method',
        // user: repository.getUsername(),
    };
    return new Session(sessionDetails);
}

export function endevorQualifierToElement(endevorQualifier: EndevorQualifier, instance: string): IElementBasicData {
    let element: IElementBasicData;
    element = {
        element: endevorQualifier.element ? endevorQualifier.element : "*",
        environment: endevorQualifier.env ? endevorQualifier.env : "*",
        instance,
        stageNumber: endevorQualifier.stage ? endevorQualifier.stage : "*",
        subsystem: endevorQualifier.subsystem ? endevorQualifier. subsystem : "*",
        system: endevorQualifier.system ? endevorQualifier.system : "*",
        type: endevorQualifier.type ? endevorQualifier.type : "*",
        // TODO: see with Vit what to do here
        // [key: string]: null
    };
    return element;
}

export function buildRequestBody(): IElementActionRequest {
    return {
        expandIncludes: "",
        level: "",
        noSignout: "yes",
        oveSign: "",
        replaceMember: "",
        search: "",
        version: "",
    };
}
