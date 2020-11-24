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

import { IProfile } from '@zowe/imperative';
import { IEndevorQualifier } from './IEndevorQualifier';
import { IFilter } from './IFilter';

export interface IConnection extends IProfile {
  name?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  user?: string | undefined;
  password?: string | undefined;
  rejectUnauthorized?: boolean | undefined;
  protocol?: string | undefined;
}

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

export interface IEndevorEntity {
  filters?: IEndevorFilter[];
  getName(): string | undefined;
  getDescription(): string | undefined;
  getRepository(): IRepository;
}

export interface IEndevorFilter {
  loadElements: (newElements: IElement[], append: boolean) => void;
  getName: () => string;
  getUri: () => string;
  getDescription: () => string;
  getRepository: () => IRepository;
  setRepository: (value: IRepository) => void;
  getElements: () => IElement[];
  getQualifier: () => IEndevorQualifier;
  updateFilterString: (filterString: string) => void;
  editFilter: (name: string) => void;
  deleteFilter: () => void;
}

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

export interface IRepository {
  id: number | undefined;
  environments: IEnvironment[] | undefined;
  filters: IEndevorFilter[] | undefined;
  map: IEndevorFilter | undefined;
  loadInfoFromConfig: (repo: IRepository) => void;
  loadEnvironments: (envs: IEnvironment[], append: boolean) => void;
  findEnvironment: (envName: string) => IEnvironment | undefined;
  findSystem: (envName: string, sysName: string) => ISystem | undefined;
  findType: (
    typeName: string,
    envName: string,
    sysName: string
  ) => IType | undefined;
  findFilter: (uri: string) => IEndevorFilter | undefined;
  setName: (value: string) => void;
  getName: () => string | undefined;
  setProfileLabel: (value: string) => void;
  getProfileLabel: () => string | undefined;
  isAttachedToConnection: (value: string) => boolean;
  setUsername: (value: string) => void;
  getUsername: () => string | undefined;
  setPassword: (value: string) => void;
  getPassword: () => string | undefined;
  getDescription: () => string | undefined;
  getUrl: () => string | undefined;
  setUrl: (value: string) => void;
  getDatasource: () => string | undefined;
  setDatasource: (value: string) => void;
  getEnvironmentMap: () => Map<string, IEnvironment> | undefined;
  getUrlString: () => string;
  getRepository: () => IRepository;
  getFilters: () => IFilter[] | undefined;
  getEndevorFilters: () => IEndevorFilter[] | undefined;
  isSameInstance: (repo: IRepository | undefined) => boolean;
  isEqual: (repo: IRepository | undefined) => boolean;
}

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

export interface ISubsystem {
  envName: string;
  sysName: string;
  sbsName: string;
  repository: IRepository;
  getName: () => string;
  getDescription: () => string;
  getRepository: () => IRepository;
}

export interface ISystem {
  envName: string;
  sysName: string;
  loadSubSystems: (newSubSystems: ISubsystem[], append: boolean) => void;
  loadTypes: (newTypes: IType[], append: boolean) => void;
  findType: (typeName: string) => IType | undefined;
  getTypes: () => IType[];
  findSubSystem: (subsysName: string) => ISubsystem | undefined;
  getSubSystems: () => ISubsystem[];
  getName: () => string;
  getDescription: () => string;
  getSysName: () => string;
  getRepository: () => IRepository;
}

export interface IType {
  envName: string;
  sysName: string;
  stgNum: string;
  typeName: string;
  fileExt: string;
  repository: IRepository;
  getName: () => string;
  getDescription: () => string;
  getTypeName: () => string;
  getRepository: () => IRepository;
}
