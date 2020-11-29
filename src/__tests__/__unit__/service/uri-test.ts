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
import { assert } from "chai";
import { buildUri, InvalidUriError, InvalidUriParamsError, parseUri, UriParts, UriQuery } from "../../../service/uri";

// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('uri building cases', () => {
    // vscode uri stubs
    const parseFunction = jest.fn();
    const withFunction = jest.fn();
    const mockUri: vscode.Uri = {
        scheme: '',
        authority: '',
        fsPath: '',
        path: '',
        query: '',
        fragment: '',
        with: withFunction,
        toJSON: jest.fn()
    };
    vscode.Uri.parse = parseFunction;

    it('should be built from uri params', () => {
        // given
        parseFunction.mockImplementation(() => {
            return mockUri;
        });
        withFunction.mockImplementation(() => {
            return mockUri;
        });
        type expectedType = string;
        const initialParams: UriParts<expectedType> = {
            schemaName: 'some_schema',
            authorityName: 'some_authority',
            path: 'some_path',
            query: {
                getValue(): expectedType {
                    return "some_query";
                }
            }
        };
        const querySerializer = (queryValue: expectedType) => {
            return queryValue;
        };
        // when
        const actualUri = buildUri(initialParams, querySerializer);
        // then
        assert.isDefined(actualUri);
        assert.equal(actualUri, mockUri);
        expect(parseFunction)
            .toHaveBeenCalledWith(initialParams.schemaName + "://" + initialParams.authorityName);
        expect(withFunction)
            .toHaveBeenCalledWith({
                path: "/" + initialParams.path,
                query: initialParams.query.getValue()
            });
    });

    it('should throw an error, if some of the uri params is empty', () => {
        // given
        type expectedType = string;
        const emptyValue = '';
        const paramsWithEmptySchema: UriParts<string> = {
            schemaName: emptyValue,
            authorityName: 'some_authority',
            path: 'some_path',
            query: {
                getValue(): expectedType {
                    return "some_query";
                }
            }
        };
        const querySerializer = (queryValue: expectedType) => {
            return queryValue;
        };
        // when && then
        assert.throws(() => {
            buildUri(paramsWithEmptySchema, querySerializer)
        },
        InvalidUriParamsError, `Uri params are invalid, actual value: ${JSON.stringify(paramsWithEmptySchema)}`);
    });

    it('should throw an error, if something went wrong with uri building', () => {
        // given
        parseFunction.mockImplementation(() => {
            return mockUri;
        });
        const expectedErrorMessage = "something went wrong!";
        withFunction.mockImplementation(() => {
            throw new Error(expectedErrorMessage);
        });
        type expectedType = string;
        const initialParams: UriParts<string> = {
            schemaName: 'some_schema',
            authorityName: 'some_authority',
            path: 'some_path',
            query: {
                getValue(): expectedType {
                    return "some_query";
                }
            }
        };
        const querySerializer = (queryValue: expectedType) => {
            return queryValue;
        };
        // when && then
        assert.throws(() => {
            buildUri(initialParams, querySerializer)
        },
        Error, expectedErrorMessage);
    });

    it('should throw an error from serializer, if it happened', () => {
        // given
        parseFunction.mockImplementation(() => {
            return mockUri;
        });
        withFunction.mockImplementation(() => {
            return mockUri;
        });
        type expectedType = string;
        const initialParams: UriParts<expectedType> = {
            schemaName: 'some_schema',
            authorityName: 'some_authority',
            path: 'some_path',
            query: {
                getValue(): expectedType {
                    return "some_query";
                }
            }
        };
        const expectedErrorMessage = "something went wrong!";
        const querySerializer = (_queryValue: expectedType) => {
            throw new Error(expectedErrorMessage);
        };
        // when && then
        assert.throws(() => {
            buildUri(initialParams, querySerializer)
        },
        Error, expectedErrorMessage);
    });
});

describe('uri parsing cases', () => {
    it('should parse uri from raw value into specified type', () => {
        // given
        const mockUri: vscode.Uri = {
            scheme: 'some',
            authority: 'some',
            fsPath: '',
            path: 'some',
            query: 'some_very_important_query',
            fragment: '',
            with: jest.fn(),
            toJSON: jest.fn()
        };
        type expectedType = string;
        const queryDeserializer = (rawValue: string) => {
            return rawValue;
        };
        // when
        const actualQueryValue: UriParts<expectedType> = parseUri(mockUri, queryDeserializer);
        // then
        assert.isDefined(actualQueryValue);
        assert.equal(actualQueryValue.query.getValue(), mockUri.query);
    });

    it('should throw an error, if some of uri parts is empty', () => {
        // given
        const emptyValue = '';
        const expectedJsonValue = 'some_value';
        const uriWithEmptyValues: vscode.Uri = {
            scheme: '',
            authority: '',
            fsPath: '',
            path: '',
            query: emptyValue,
            fragment: '',
            with: jest.fn(),
            toJSON: jest.fn().mockImplementation(() => {
                return expectedJsonValue;
            })
        };
        const queryDeserializer = (rawValue: string) => {
            return rawValue;
        };
        // when && then
        assert.throws(function() {
            parseUri(uriWithEmptyValues, queryDeserializer)
        },
        InvalidUriError, `Uri is invalid, actual value: "${expectedJsonValue}"`);
    });

    it('should throw an error, if uri is undefined', () => {
        // given
        const undefinedUri: any = undefined;
        const queryDeserializer = (rawValue: string) => {
            return rawValue;
        };
        // when && then
        assert.throws(function() {
            parseUri(undefinedUri, queryDeserializer)
        },
        InvalidUriError, `Uri is invalid, actual value: undefined`);
    });

    it('should throw an error from deserializer, if it happened', () => {
        // given
        const expectedErrorMessage = "something went wrong!";
        const mockUri: vscode.Uri = {
            scheme: 'some',
            authority: 'some',
            fsPath: '',
            path: 'some',
            query: 'some_very_important_query',
            fragment: '',
            with: jest.fn(),
            toJSON: jest.fn()
        };
        const queryDeserializer = (_rawValue: string) => {
            throw new Error(expectedErrorMessage);
        };
        // when && then
        assert.throws(function() {
            parseUri(mockUri, queryDeserializer)
        },
        Error, expectedErrorMessage);
    });
});
