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

import { EndevorEntity } from "./EndevorEntity";
import { ISubsystem } from "./IEndevorEntities";
import { Repository } from "./Repository";

export class SubSystem extends EndevorEntity implements ISubsystem {
    envName: string;
    sysName: string;
    sbsName: string;
    repository: Repository;

    constructor (repo: Repository, subsys: ISubsystem) {
        super();
        this.envName = subsys.envName;
        this.sysName = subsys.sysName;
        this.sbsName = subsys.sbsName;
        this.repository = repo;
    }

    public getName(): string {
        return this.sbsName;
    }
    public getDescription(): string {
        return "";
    }
    public getRepository(): Repository {
        return this.repository;
    }

}
