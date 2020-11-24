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
  envName: string;
  stgName: string;
  stgId: string;
  stgNum: string;
  repository: IRepository;

  constructor(repo: IRepository, stage: IStage) {
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

  public getRepository(): IRepository {
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
