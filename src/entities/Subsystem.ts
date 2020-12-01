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

import { ISubsystem, IRepository } from '../interface/entities';

export class Subsystem implements ISubsystem {
  public envName: string;
  public sysName: string;
  public sbsName: string;
  private repository: IRepository;

  constructor(repo: IRepository, subsys: ISubsystem) {
    this.envName = subsys.envName;
    this.sysName = subsys.sysName;
    this.sbsName = subsys.sbsName;
    this.repository = repo;
  }

  public getName(): string {
    return this.sbsName;
  }

  public getDescription(): string {
    return '';
  }

  public getRepository(): IRepository {
    return this.repository;
  }

  public setRepository(repo: IRepository) {
    this.repository = repo;
  }
}
