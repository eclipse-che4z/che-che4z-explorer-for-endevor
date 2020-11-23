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

import { IEndevorEntity } from './IEndevorEntity';
import { IEndevorQualifier } from './IEndevorQualifier';
import { IRepository } from './IRepository';

export interface IElement extends IEndevorEntity {
  elmName: string;
  fullElmName: string;
  elmVVLL: string;
  envName: string;
  sysName: string;
  sbsName: string;
  stgNum: string;
  typeName: string;
  repository: IRepository;
  getName: () => string;
  getDescription: () => string;
  getElmName: () => string;
  getElmVVLL: () => string;
  getRepository: () => IRepository;
  getQualifier: () => IEndevorQualifier;
}
