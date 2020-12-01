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

import { IType, IRepository } from '../interface/entities';

export class Type implements IType {
  private envName: string;
  private sysName: string;
  private stgNum: string;
  private typeName: string;
  private repository: IRepository;
  private fileExt: string;

  constructor(
    repo: IRepository,
    type: {
      envName: string;
      sysName: string;
      stgNum: string;
      typeName: string;
      fileExt: string;
    }
  ) {
    this.envName = type.envName;
    this.sysName = type.sysName;
    this.stgNum = type.stgNum;
    this.typeName = type.typeName;
    this.fileExt = type.fileExt;
    this.repository = repo;
  }

  public getName(): string {
    return this.typeName;
  }
  public getDescription(): string {
    return '';
  }

  public getFileExt(): string {
    return this.fileExt;
  }

  public setFileExt(ext: string) {
    this.fileExt = ext;
  }

  public getTypeName(): string {
    return this.typeName;
  }

  public setTypeName(name: string) {
    this.typeName = name;
  }

  public getStgNum(): string {
    return this.stgNum;
  }

  public setStgNum(num: string) {
    this.stgNum = num;
  }

  public getSysName(): string {
    return this.sysName;
  }

  public setSysName(name: string) {
    this.sysName = name;
  }

  public getEnvName(): string {
    return this.envName;
  }

  public setEnvName(name: string) {
    this.envName = name;
  }

  public getRepository(): IRepository {
    return this.repository;
  }

  public setRepository(repo: IRepository) {
    this.repository = repo;
  }
}
