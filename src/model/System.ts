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

import { ISystem } from './IEndevorEntities';
import { EndevorEntity } from './IEndevorEntity';
import { SubSystem } from './SubSystem';
import { Type } from './Type';

export class System implements EndevorEntity {
  envName: string;
  sysName: string;
  subsystems: Map<string, SubSystem>;
  types: Map<string, Type>;
  repository: EndevorEntity;

  constructor(repo: EndevorEntity, system: ISystem) {
    this.envName = system.envName;
    this.sysName = system.sysName;
    this.subsystems = new Map();
    this.types = new Map();
    this.repository = repo;
  }

  public loadSubSystems(newSubSystems: SubSystem[], append: boolean) {
    if (!append) {
      this.subsystems = new Map();
    }
    newSubSystems.forEach((subsys) => {
      this.subsystems.set(subsys.sbsName, subsys);
    });
  }

  public loadTypes(newTypes: Type[], append: boolean) {
    if (!append) {
      this.types = new Map();
    }
    newTypes.forEach((type) => {
      this.types.set(type.typeName, type);
    });
  }

  public findType(typeName: string): Type | undefined {
    return this.types.get(typeName);
  }

  public getTypes(): Type[] {
    return Array.from(this.types.values());
  }

  public findSubSystem(subsysName: string): SubSystem | undefined {
    return this.subsystems.get(subsysName);
  }

  public getSubSystems(): SubSystem[] {
    return Array.from(this.subsystems.values());
  }

  public getName(): string {
    return this.sysName;
  }
  public getDescription(): string {
    return '';
  }

  public getSysName(): string {
    return this.sysName;
  }

  public getRepository(): EndevorEntity {
    return this.repository;
  }
}
