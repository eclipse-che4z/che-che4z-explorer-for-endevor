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

import { IRepository } from '../interface/IRepository';
import { ISubsystem } from '../interface/ISubsystem';
import { ISystem } from '../interface/ISystem';
import { IType } from '../interface/IType';
import { Type } from './Type';

export class System implements ISystem {
  envName: string;
  sysName: string;
  subsystems: Map<string, ISubsystem>;
  types: Map<string, Type>;
  repository: IRepository;

  constructor(repo: IRepository, system: ISystem) {
    this.envName = system.envName;
    this.sysName = system.sysName;
    this.subsystems = new Map();
    this.types = new Map();
    this.repository = repo;
  }

  public loadSubSystems(newSubSystems: ISubsystem[], append: boolean) {
    if (!append) {
      this.subsystems = new Map();
    }
    newSubSystems.forEach((subsys) => {
      this.subsystems.set(subsys.sbsName, subsys);
    });
  }

  public loadTypes(newTypes: IType[], append: boolean) {
    if (!append) {
      this.types = new Map();
    }
    newTypes.forEach((type) => {
      this.types.set(type.typeName, type);
    });
  }

  public findType(typeName: string): IType | undefined {
    return this.types.get(typeName);
  }

  public getTypes(): Type[] {
    return Array.from(this.types.values());
  }

  public findSubSystem(subsysName: string): ISubsystem | undefined {
    return this.subsystems.get(subsysName);
  }

  public getSubSystems(): ISubsystem[] {
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

  public getRepository(): IRepository {
    return this.repository;
  }
}
