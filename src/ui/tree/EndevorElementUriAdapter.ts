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

import { URL } from "url";
import { SCHEMA_NAME } from "../../constants";
import { EndevorQualifier } from "../../model/IEndevorQualifier";
import { Repository } from "../../model/Repository";
import { UriParts, UriQuery } from "../../service/uri";

const NO_SPECIFIED_NAME = "NO_SPECIFIED";

export class EndevorElementUriParts implements UriParts<EndevorElementUriQuery> {
    readonly schemaName: string;
    readonly authorityName: string;
    readonly path: string;
    readonly query: UriQuery<EndevorElementUriQuery>;

    constructor(elementRepo: Repository, elementQualifier: EndevorQualifier) {
        this.checkRepository(elementRepo);
        this.checkQualifier(elementQualifier);
        this.authorityName = new URL(elementRepo.getUrl()).host;
        this.schemaName = SCHEMA_NAME;
        if (elementQualifier.element) {
            this.path = elementQualifier.element;
        } else {
            this.path = NO_SPECIFIED_NAME;
        }
        this.query = {
            getValue(): EndevorElementUriQuery {
                return {
                    qualifier: elementQualifier,
                    repository: {
                        name: elementRepo.getName(),
                        url: elementRepo.getUrl(),
                        username: elementRepo.getUsername(),
                        password: elementRepo.getPassword(),
                        datasource: elementRepo.getDatasource(),
                        profileLabel: elementRepo.getProfileLabel()
                    }
                };
            }
        }
    }

    private checkRepository(repository: Repository) {
        const repositoryPropertiesSpecified = repository 
                                                    && repository.getUrl() 
                                                    && repository.getName() 
                                                    && repository.getDatasource();
        if (!repositoryPropertiesSpecified) {
            throw new Error(`Input miss repository required properties, actual value for required properties: ${JSON.stringify({
                url: repository.getUrl(),
                name: repository.getName(),
                datasourse: repository.getDatasource()
            })}`);
        }
    }

    private checkQualifier(qualifier: EndevorQualifier) {
        const qualifierPropertiesSpecified = qualifier 
                                                && qualifier.env 
                                                && qualifier.stage 
                                                && qualifier.subsystem 
                                                && qualifier.system 
                                                && qualifier.type;
        if (!qualifierPropertiesSpecified) {
            throw new Error(`Input miss qualifier required properties, actual value for required properties: ${JSON.stringify({
                env: qualifier.env,
                stage: qualifier.stage,
                subsystem: qualifier.subsystem,
                system: qualifier.system,
                type: qualifier.type
            })}`);
        }
    }
}

export interface EndevorElementUriQuery {
    readonly repository: {
        readonly name: string,
        readonly url: string,
        readonly username: string | undefined,
        readonly password: string | undefined,
        readonly datasource: string,
        readonly profileLabel: string | undefined
    },
    readonly qualifier: EndevorQualifier;
}

export const endevorElementQuerySerializer = (elementQuery: EndevorElementUriQuery): string => {
    return JSON.stringify(elementQuery);
};

export const endevorElementQueryDeserializer = (rawQuery: string): EndevorElementUriQuery => {
    return JSON.parse(rawQuery);
};
