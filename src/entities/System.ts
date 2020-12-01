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

import { ISystem, ISubsystem, IRepository, IType } from '../interface/entities';

export class System implements ISystem {
  public subsystems: Map<string, ISubsystem>;
  public types: Map<string, IType>;
  private envName: string;
  private sysName: string;
  private repository: IRepository;

  constructor(
    repo: IRepository,
    system: {
      envName: string;
      sysName: string;
    }
  ) {
    this.envName = system.envName;
    this.sysName = system.sysName;
    this.subsystems = new Map();
    this.types = new Map();
    this.repository = repo;
  }

  public loadSubsystems(newSubsystems: ISubsystem[], append: boolean) {
    if (!append) {
      this.subsystems = new Map();
    }
    newSubsystems.forEach((subsys) => {
      this.subsystems.set(subsys.sbsName, subsys);
    });
  }

  public loadTypes(newTypes: IType[], append: boolean) {
    if (!append) {
      this.types = new Map();
    }
    newTypes.forEach((type) => {
      this.types.set(type.getTypeName(), type);
    });
  }

  public findType(typeName: string): IType | undefined {
    return this.types.get(typeName);
  }

  public getTypes(): IType[] {
    return Array.from(this.types.values());
  }

  public findSubsystem(subsysName: string): ISubsystem | undefined {
    return this.subsystems.get(subsysName);
  }

  public getSubsystems(): ISubsystem[] {
    return Array.from(this.subsystems.values());
  }

  public getName(): string {
    return this.sysName;
  }

  public getDescription(): string {
    return '';
  }

  public getEnvName(): string {
    return this.envName;
  }

  public setEnvName(name: string) {
    this.envName = name;
  }

  public getSysName(): string {
    return this.sysName;
  }

  public setSysName(name: string) {
    this.sysName = name;
  }

  public getRepository(): IRepository {
    return this.repository;
  }

  public setRepository(repo: IRepository) {
    this.repository = repo;
  }
}
