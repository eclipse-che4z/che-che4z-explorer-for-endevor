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

import { IStage, IRepository } from '../interface/entities';

export class Stage implements IStage {
  private envName: string;
  private stgName: string;
  private stgId: string;
  private stgNum: string;
  private repository: IRepository;

  constructor(
    repo: IRepository,
    stage: {
      envName: string;
      stgName: string;
      stgId: string;
      stgNum: string;
    }
  ) {
    this.envName = stage.envName;
    this.stgName = stage.stgName;
    this.stgId = stage.stgId;
    this.stgNum = stage.stgNum;
    this.repository = repo;
  }

  public getEnvName(): string {
    return this.envName;
  }

  public setEnvName(name: string) {
    this.envName = name;
  }

  public getName(): string {
    return this.stgNum.toString();
  }

  public getStgNum(): string {
    return this.stgNum.toString();
  }

  public setStgNum(num: string) {
    this.stgNum = num;
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

  public getStgName(): string {
    return this.stgName;
  }

  public setStgName(name: string) {
    this.stgName = name;
  }

  public getStgId(): string {
    return this.stgId;
  }

  public setStgId(id: string) {
    this.stgId = id;
  }
}
