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

import {
  IEndevorEntity,
  IEnvironment,
  IRepository,
  IStage,
  ISystem,
} from '../interface/entities';

export class Environment implements IEndevorEntity {
  envName: string;
  repository: IRepository;
  systems: Map<string, ISystem>;
  stages: IStage[];

  constructor(repository: IRepository, env: IEnvironment) {
    this.repository = repository;
    this.envName = env.envName;
    this.systems = new Map();
    this.stages = new Array(2);
  }

  public loadSystems(newSystems: ISystem[], append: boolean) {
    if (!append) {
      this.systems = new Map();
    }
    newSystems.forEach((sys) => {
      this.systems.set(sys.sysName, sys);
    });
  }

  public loadStages(newStages: IStage[]) {
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

  public getRepository(): IRepository {
    return this.repository;
  }

  public findSystem(sysName: string): ISystem | undefined {
    return this.systems.get(sysName);
  }

  public getSystems(): ISystem[] {
    return Array.from(this.systems.values());
  }

  public getStage(num: number): IStage | undefined {
    return this.stages[num];
  }

  public getStages(): IStage[] {
    return this.stages;
  }
}
