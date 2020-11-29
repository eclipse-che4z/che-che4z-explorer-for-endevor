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

import * as vscode from 'vscode';
import { logger } from '../globals';

export interface UriParts<T> {
    readonly schemaName: string;
    readonly authorityName: string;
    readonly path: string;
    readonly query: UriQuery<T>;
}

export interface UriQuery<T> {
    getValue: () => T;
}

export function buildUri<T>(uriParams: UriParts<T>, querySerializer: (queryObject: T) => string): vscode.Uri {
    checkUriParams(uriParams);
    const resultUri = vscode.Uri
        .parse(uriParams.schemaName + "://" + uriParams.authorityName)
        .with({
            path: "/" + uriParams.path,
            query: querySerializer(uriParams.query.getValue()),
        }
        );
    logger.trace(`Uri was built: ${JSON.stringify(resultUri)}`);
    return resultUri;
}

function checkUriParams<T>(uriParams: UriParts<T>): void {
    const paramsContainsAllValues = uriParams
                                        && uriParams.schemaName
                                        && uriParams.path
                                        && uriParams.authorityName;
    if (!paramsContainsAllValues) {
        throw new InvalidUriParamsError(`Uri params are invalid, actual value: ${JSON.stringify(uriParams)}`);
    }
}

export function parseUri<T>(uri: vscode.Uri, queryDeserializer: (rawQuery: string) => T): UriParts<T> {
    checkUri(uri);
    const parsedQuery = queryDeserializer(uri.query);
    const parsedUri: UriParts<T> = {
        schemaName: uri.scheme,
        path: uri.path,
        authorityName: uri.authority,
        query: {
            getValue(): T {
                return parsedQuery;
            }
        }
    };
    logger.trace(`Uri was parsed into: ${parsedUri}`);
    return parsedUri;
}

function checkUri(uri: vscode.Uri): void {
    const uriContainsAllRequiredValues = uri 
                                            && uri.query 
                                            && uri.authority 
                                            && uri.scheme 
                                            && uri.path;
    if (!uriContainsAllRequiredValues) {
        throw new InvalidUriError(`Uri is invalid, actual value: ${JSON.stringify(uri)}`);
    }
}

export class InvalidUriParamsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidUriParamsError";
    }
}

export class InvalidUriError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidUriError";
    }
}
