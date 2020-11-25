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

import { IEndevorEntity, IElement, IRepository } from '../interface/entities';
import { IEndevorQualifier } from '../interface/IEndevorQualifier';

export class Element implements IEndevorEntity {
  envName: string;
  sysName: string;
  sbsName: string;
  stgNum: string;
  typeName: string;
  elmName: string;
  fullElmName: string;
  elmVVLL: string;
  repository: IRepository;

  constructor(repo: IRepository, element: IElement) {
    this.elmName = element.elmName;
    this.fullElmName = element.fullElmName;
    this.elmVVLL = element.elmVVLL;
    this.envName = element.envName;
    this.sysName = element.sysName;
    this.sbsName = element.sbsName;
    this.stgNum = element.stgNum;
    this.typeName = element.typeName;
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

  public getElmVVLL(): string {
    return this.elmVVLL;
  }

  public getRepository(): IRepository {
    return this.repository;
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
