/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Broadcom, Inc. - initial API and implementation
 */

import { IRepository } from '../interface/IRepository';

export interface IStage {
  envName: string;
  stgName: string;
  stgId: string;
  stgNum: string;
  repository: IRepository;
  getName: () => string;
  getDescription: () => string;
  getRepository: () => IRepository;
  getStgName: () => string;
  getStgId: () => string;
  getStgNum: () => string;
}
