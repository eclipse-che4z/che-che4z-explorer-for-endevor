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

import { IRepository } from './IRepository';
import { IStage } from './IStage';
import { ISystem } from './ISystem';

export interface IEnvironment {
  envName: string;
  repository: IRepository;
  systems: Map<string, ISystem>;
  stages: IStage[];
  loadSystems: (newSystems: ISystem[], append: boolean) => void;
  loadStages: (newStages: IStage[]) => void;
  getName: () => string;
  getDescription: () => string;
  getEnvName: () => string;
  getRepository: () => IRepository;
  findSystem: (sysName: string) => ISystem | undefined;
  getSystems: () => ISystem[];
  getStage: (num: number) => IStage | undefined;
  getStages: () => IStage[];
}
