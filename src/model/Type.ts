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

import { IType } from './IEndevorEntities';
import { EndevorEntity } from './IEndevorEntity';

export class Type implements EndevorEntity {
  envName: string;
  sysName: string;
  stgNum: string;
  typeName: string;
  repository: EndevorEntity;
  fileExt: string;

  constructor(repo: EndevorEntity, type: IType) {
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

  public getTypeName(): string {
    return this.typeName;
  }

  public getRepository(): EndevorEntity {
    return this.repository;
  }
}
