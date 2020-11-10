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

import { EndevorEntity } from './EndevorEntity';
import { IEnvironment } from './IEndevorEntities';
import { Repository } from './Repository';
import { Stage } from './Stage';
import { System } from './System';

export class Environment extends EndevorEntity implements IEnvironment {
    envName: string;
    repository: Repository;
    systems: Map<string, System>;
    stages: Stage[];

    constructor(repository: Repository, env: IEnvironment) {
        super();
        this.repository = repository;
        this.envName = env.envName;
        this.systems = new Map();
        this.stages = new Array(2);
    }

    public loadSystems(newSystems: System[], append: boolean) {
        if (!append) {
            this.systems = new Map();
        }
        newSystems.forEach((sys) => {
            this.systems.set(sys.sysName, sys);
        });
    }

    public loadStages(newStages: Stage[]) {
        if (newStages.length !== 2) {
            throw Error('Incorrect number of stages');
        }
        this.stages[0] = newStages[0];
        this.stages[1] = newStages[1];
    }

    public getName(): string {
        return this.envName;
    }
    public getDescription(): string {
        return '';
    }

    public getEnvName(): string {
        return this.envName;
    }

    public getRepository(): Repository {
        return this.repository;
    }

    public findSystem(sysName: string): System | undefined {
        return this.systems.get(sysName);
    }

    public getSystems(): System[] {
        return Array.from(this.systems.values());
    }

    public getStage(num: number): Stage | undefined {
        return this.stages[num];
    }

    public getStages(): Stage[] {
        return this.stages;
    }
}
