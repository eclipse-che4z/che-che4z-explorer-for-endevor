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

import { IEndevorEntity, IRepository } from '../interface/entities';
import { IEndevorQualifier } from '../interface/IEndevorQualifier';

export class Element implements IEndevorEntity {
  public envName: string;
  public sysName: string;
  public sbsName: string;
  public stgNum: string;
  public typeName: string;
  public fullElmName: string;
  private elmVVLL: string;
  private repository: IRepository;
  private elmName: string;

  constructor(repo: IRepository, qualifier: IEndevorQualifier) {
    this.elmName = qualifier.element;
    this.fullElmName = qualifier.element;
    this.elmVVLL = qualifier.element;
    this.envName = qualifier.env;
    this.sysName = qualifier.system;
    this.sbsName = qualifier.subsystem;
    this.stgNum = qualifier.stage;
    this.typeName = qualifier.type;
    this.repository = repo;
  }

  getName(): string {
    return this.elmName;
  }

  getDescription(): string {
    return '';
  }

  public getElmName(): string {
    return this.elmName;
  }

  public setElmName(name: string) {
    this.elmName = name;
  }

  public getElmVVLL(): string {
    return this.elmVVLL;
  }

  public setElmVVLL(VVLL: string) {
    this.elmVVLL = VVLL;
  }

  public getRepository(): IRepository {
    return this.repository;
  }

  public setRepository(repo: IRepository) {
    this.repository = repo;
  }

  public getQualifier(): IEndevorQualifier {
    return {
      env: this.envName,
      stage: this.stgNum,
      system: this.sysName,
      subsystem: this.sbsName,
      type: this.typeName,
      element: this.fullElmName,
    };
  }
}
