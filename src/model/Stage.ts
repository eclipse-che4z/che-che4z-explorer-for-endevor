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

import { IStage } from './IEndevorEntities';
import { EndevorEntity } from './EndevorEntity';
import { Repository } from './Repository';

export class Stage extends EndevorEntity implements IStage {
    envName: string;
    stgName: string;
    stgId: string;
    stgNum: string;
    repository: Repository;

    constructor(repo: Repository, stage: IStage) {
        super();
        this.envName = stage.envName;
        this.stgName = stage.stgName;
        this.stgId = stage.stgId;
        this.stgNum = stage.stgNum;
        this.repository = repo;
    }

    public getName(): string {
        return this.stgNum.toString();
    }

    public getDescription(): string {
        return '';
    }

    public getRepository(): Repository {
        return this.repository;
    }

    public getStgName(): string {
        return this.stgName;
    }

    public getStgId(): string {
        return this.stgId;
    }

    public getStgNum(): string {
        return this.stgNum;
    }
}
