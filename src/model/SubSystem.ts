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

import { EndevorEntity } from './IEndevorEntity';
import { ISubsystem } from './IEndevorEntities';

export class SubSystem implements EndevorEntity {
  envName: string;
  sysName: string;
  sbsName: string;
  repository: EndevorEntity;

  constructor(repo: EndevorEntity, subsys: ISubsystem) {
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
  public getRepository(): EndevorEntity {
    return this.repository;
  }
}
