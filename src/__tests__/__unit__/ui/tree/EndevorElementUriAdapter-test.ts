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

import { assert } from 'chai';
import * as vscode from 'vscode';
import { SCHEMA_NAME } from '../../../../constants';
import { EndevorQualifier } from '../../../../model/IEndevorQualifier';
import { Repository } from '../../../../model/Repository';
import { endevorElementQueryDeserializer, endevorElementQuerySerializer, EndevorElementUriParts, EndevorElementUriQuery } from '../../../../ui/tree/EndevorElementUriAdapter';

// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('endevor element uri serialization adapter usage', () => {

    it('should return endevor element adapter to use in uri building', () => {
        // given
        const endevorQualifier: EndevorQualifier = {
            element: 'some_value',
            env: 'envTest',
            stage: '1',
            subsystem: 'sbsTest',
            system: 'sysTest',
            type: 'COBOL',
        };
        const repoHost = 'example.com:1234';
        const endevorRepository = new Repository(
            'testRepo',
            `https://${repoHost}`,
            'testUser',
            'testPass',
            'testRepo',
            'testConnLabel'
        );
        // when
        const uriParamsToBuild = new EndevorElementUriParts(endevorRepository, endevorQualifier);
        const rawUriQuery = endevorElementQuerySerializer(uriParamsToBuild.query.getValue());
        // then
        assert.isDefined(uriParamsToBuild);
        assert.equal(uriParamsToBuild.schemaName, SCHEMA_NAME);
        assert.equal(uriParamsToBuild.path, endevorQualifier.element);
        assert.equal(uriParamsToBuild.authorityName, repoHost);
        assert.equal(
            rawUriQuery,
            '{"qualifier":{"element":"some_value","env":"envTest","stage":"1","subsystem":"sbsTest","system":"sysTest","type":"COBOL"},' +
                '"repository":{"name":"testRepo","url":"https://example.com:1234","username":"testUser","password":"testPass","datasource":"testRepo","profileLabel":"testConnLabel"}}'
        );
    });

    it('should return endevor element adapter to use in uri building with default path', () => {
        // given
        const endevorQualifier: EndevorQualifier = {
            env: 'envTest',
            stage: '1',
            subsystem: 'sbsTest',
            system: 'sysTest',
            type: 'COBOL',
        };
        const repoHost = 'example.com:1234';
        const endevorRepository = new Repository(
            'testRepo',
            `https://${repoHost}`,
            'testUser',
            'testPass',
            'testRepo',
            'testConnLabel'
        );
        // when
        const uriParamsToBuild = new EndevorElementUriParts(endevorRepository, endevorQualifier);
        const rawUriQuery = endevorElementQuerySerializer(uriParamsToBuild.query.getValue());
        // then
        assert.isDefined(uriParamsToBuild);
        assert.equal(uriParamsToBuild.schemaName, SCHEMA_NAME);
        assert.equal(uriParamsToBuild.path, 'NO_SPECIFIED');
        assert.equal(uriParamsToBuild.authorityName, repoHost);
        assert.equal(
            rawUriQuery,
            '{"qualifier":{"env":"envTest","stage":"1","subsystem":"sbsTest","system":"sysTest","type":"COBOL"},' +
            '"repository":{"name":"testRepo","url":"https://example.com:1234","username":"testUser","password":"testPass","datasource":"testRepo","profileLabel":"testConnLabel"}}'
        );
    });

    it('should throw an error, if some of required properties of repo missed', () => {
        // given
        const endevorQualifier: EndevorQualifier = {
            env: 'envTest',
            stage: '1',
            subsystem: 'sbsTest',
            system: 'sysTest',
            type: 'COBOL',
        };
        const repositoryWithEmptyUrl = new Repository(
            'testRepo',
            '',
            'testUser',
            'testPass',
            'testRepo',
            'testConnLabel'
        );
        // when && then
        assert.throws(() => {
            new EndevorElementUriParts(repositoryWithEmptyUrl, endevorQualifier)
        },
        Error, `Input miss repository required properties, actual value for required properties: ${JSON.stringify({
            url: repositoryWithEmptyUrl.getUrl(),
            name: repositoryWithEmptyUrl.getName(),
            datasourse: repositoryWithEmptyUrl.getDatasource()
        })}`)
    });

    it('should throw an error, if some of required properties of qualifier missed', () => {
        // given
        const endevorQualifierWithoutStage: EndevorQualifier = {
            env: 'envTest',
            subsystem: 'sbsTest',
            system: 'sysTest',
            type: 'COBOL',
        };
        const repoHost = 'example.com:1234';
        const elementRepo = new Repository(
            'testRepo',
            `https://${repoHost}`,
            'testUser',
            'testPass',
            'testRepo',
            'testConnLabel'
        );
        // when && then
        assert.throws(() => {
            new EndevorElementUriParts(elementRepo, endevorQualifierWithoutStage)
        },
        Error, `Input miss qualifier required properties, actual value for required properties: ${JSON.stringify({
            env: endevorQualifierWithoutStage.env,
            stage: endevorQualifierWithoutStage.stage,
            subsystem: endevorQualifierWithoutStage.subsystem,
            system: endevorQualifierWithoutStage.system,
            type: endevorQualifierWithoutStage.type
        })}`)
    });
});

describe('endevor element uri deserialization adapter usage', () => {
    it('should parse raw uri query into domain model', () => {
        // given
        const rawUriQuery = '{"qualifier":{"env":"envTest","stage":"1","subsystem":"sbsTest","system":"sysTest","type":"COBOL"},' +
        '"repository":{"name":"testRepo","url":"https://example.com:1234","username":"testUser","password":"testPass","datasource":"testRepo","profileLabel":"testConnLabel"}}';
        // when
        const parsedQuery: EndevorElementUriQuery = endevorElementQueryDeserializer(rawUriQuery);
        // then
        assert.isDefined(parsedQuery);

        assert.isDefined(parsedQuery.qualifier);
        assert.equal(parsedQuery.qualifier.env, 'envTest');
        assert.equal(parsedQuery.qualifier.stage, '1');
        assert.equal(parsedQuery.qualifier.subsystem, 'sbsTest');
        assert.equal(parsedQuery.qualifier.system, 'sysTest');
        assert.equal(parsedQuery.qualifier.type, 'COBOL');

        assert.isDefined(parsedQuery.repository);
        assert.equal(parsedQuery.repository.name, 'testRepo');
        assert.equal(parsedQuery.repository.url, 'https://example.com:1234');
        assert.equal(parsedQuery.repository.username, 'testUser');
        assert.equal(parsedQuery.repository.password, 'testPass');
        assert.equal(parsedQuery.repository.datasource, 'testRepo');
        assert.equal(parsedQuery.repository.profileLabel, 'testConnLabel');
    });

    it('should throw an error, if raw uri query has invalid format', () => {
        // given
        const incorrectUriQuery = 'some_query';
        // when && then
        assert.throws(() => {
            endevorElementQueryDeserializer(incorrectUriQuery);
        }, Error);
    });
});
