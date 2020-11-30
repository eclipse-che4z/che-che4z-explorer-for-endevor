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
import { EndevorElementContentProvider } from '../../../../ui/tree/EndevorElementContentProvider';
import * as uri from "../../../../service/uri";
import * as endevorCli from "../../../../service/EndevorCliProxy";
import { Repository } from '../../../../model/Repository';
import { EndevorQualifier } from '../../../../model/IEndevorQualifier';
import { EndevorElementUriParts, EndevorElementUriQuery } from '../../../../ui/tree/EndevorElementUriAdapter';
import { assert } from 'chai';
import { logger } from '../../../../globals';
// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('the endevor element content provider workflow', () => {
    // input stubs
    const cancellationToken: any = undefined;
    const mockUri: vscode.Uri = {
        scheme: '',
        authority: '',
        fsPath: '',
        path: '',
        query: '',
        fragment: '',
        with: jest.fn(),
        toJSON: jest.fn()
    };
    const queryValue: EndevorElementUriQuery = {
        qualifier: {},
        repository: {
            name: '',
            url: '',
            username: '',
            password: '',
            datasource: '',
            profileLabel: ''
        }
    };
    const parsedUriParams: uri.UriParts<unknown> = {
        schemaName: '',
        authorityName: '',
        path: '',
        query: {
            getValue(): EndevorElementUriQuery {
                return queryValue;
            }
        }
    };

    it('should browse the element after successful uri parsing', async () => {
        // given
        jest.spyOn(uri, 'parseUri')
            .mockImplementation((_uri: vscode.Uri, _queryDeserializer: (rawQuery: string) => any) => {
                return parsedUriParams;
        });
        const expectedElementContent = 'some_value';
        jest.spyOn(endevorCli, 'proxyBrowseElement')
            .mockImplementation((_repo: Repository, _qualifier: EndevorQualifier) => {
                return Promise.resolve(expectedElementContent);
        });
        // when;
        const actualElementContent = await new EndevorElementContentProvider()
                .provideTextDocumentContent(mockUri, cancellationToken);
        // then;
        assert.equal(actualElementContent, expectedElementContent);
    });

    it('should show an error message, if uri parsing throws an error', async () => {
        // given
        const expectedErrorMessage = "something went wrong!";
        jest.spyOn(uri, 'parseUri')
            .mockImplementation((_uri: vscode.Uri, _queryDeserializer: (rawQuery: string) => any) => {
                throw new Error(expectedErrorMessage);
        });
        jest.spyOn(logger, 'error').mockImplementation((_message: string) => {
            // do nothing
        });
        // when;
        assert.isUndefined(
            await new EndevorElementContentProvider()
                    .provideTextDocumentContent(mockUri, cancellationToken)
        );
        // then;
        const expectedUserMessage = "Something went wrong with element uri conversion, please, see the output for reasons";
        expect(logger.error).toHaveBeenCalledWith(expectedUserMessage, expectedErrorMessage);
    });

    it('should show an error message, if something went wrong with Envevor call', async () => {
        // given
        jest.spyOn(uri, 'parseUri')
            .mockImplementation((_uri: vscode.Uri, _queryDeserializer: (rawQuery: string) => any) => {
                return parsedUriParams;
        });
        const expectedRejectReason = "something went wrong!";
        jest.spyOn(endevorCli, 'proxyBrowseElement')
            .mockImplementation((_repo: Repository, _qualifier: EndevorQualifier) => {
                return Promise.reject(expectedRejectReason);
        });
        // when;
        assert.isUndefined(
            await new EndevorElementContentProvider()
                    .provideTextDocumentContent(mockUri, cancellationToken)
        );
        // then;
        const expectedUserMessage = "Something went wrong with Endevor call, please, see the output for reasons";
        expect(logger.error).toHaveBeenLastCalledWith(expectedUserMessage, expectedRejectReason);
    });
});
