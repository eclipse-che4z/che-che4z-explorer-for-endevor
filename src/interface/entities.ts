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

import { IProfile, IProfileLoaded } from '@zowe/imperative';
import { IEndevorQualifier } from './IEndevorQualifier';
import { IFilter } from './IFilter';

export interface IConnection extends IProfile {
  name?: string;
  message: string;
  type: string;
  failNotFound: boolean;
  referencedBy?: string;
  profile?: IProfile;
  dependenciesLoaded?: boolean;
  dependencyLoadResponses?: IProfileLoaded[];
  loadRepository: (repo: IRepository) => void;
  findRepository: (repoName: string) => IRepository | undefined;
  getName: () => string;
  getDescription: () => string;
  getRepository: () => IRepository;
  getRepositoryArray: () => IRepository[];
  setRepositoryArray: (repos: IRepository[]) => void;
  getRepositories: () => Map<string, IRepository>;
  setRepositories: (repoMap: Map<string, IRepository>) => void;
  getConnection: () => IConnection;
  getProfile?: () => IProfile | undefined;
  setProfile?: (profile: IProfile) => void;
}

export interface IElement extends IEndevorEntity {
  fullElmName: string;
  envName: string;
  sysName: string;
  sbsName: string;
  stgNum: string;
  typeName: string;
  getName: () => string;
  getDescription: () => string;
  getElmName: () => string;
  setElmName: (name: string) => void;
  getElmVVLL: () => string;
  setElmVVLL: (VVLL: string) => void;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
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
  getQualifier: () => IEndevorQualifier;
  updateFilterString: (filterString: string) => void;
  editFilter: (name: string) => void;
  deleteFilter: () => void;
  getRepository: () => IRepository;
  setRepository: (value: IRepository) => void;
  getElements: () => IElement[];
  setElements: (elements: IElement[]) => void;
  getEnvFilter: () => string;
  setEnvFilter: (value: string) => void;
  getStageFilter: () => string;
  setStageFilter: (value: string) => void;
  getSystemFilter: () => string;
  setSystemFilter: (value: string) => void;
  getSubsysFilter: () => string;
  setSubsysFilter: (value: string) => void;
  getTypeFilter: () => string;
  setTypeFilter: (value: string) => void;
  getElementFilter: () => string;
  setElementFilter: (value: string) => void;
}

export interface IEnvironment {
  systems: Map<string, ISystem>;
  loadSystems: (newSystems: ISystem[], append: boolean) => void;
  loadStages: (newStages: IStage[]) => void;
  getName: () => string;
  getDescription: () => string;
  getEnvName: () => string;
  setEnvName: (name: string) => void;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
  findSystem: (sysName: string) => ISystem | undefined;
  getSystemsAsArray: () => ISystem[];
  getStage: (num: number) => IStage | undefined;
  getStages: () => IStage[];
  setStages: (stages: IStage[]) => void;
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
  getDescription: () => string;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
  getStgName: () => string;
  setStgName: (name: string) => void;
  getEnvName: () => string;
  setEnvName: (name: string) => void;
  getStgId: () => string;
  setStgId: (id: string) => void;
  getStgNum: () => string;
  setStgNum: (num: string) => void;
}

export interface ISubsystem {
  envName: string;
  sysName: string;
  sbsName: string;
  getName: () => string;
  getDescription: () => string;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
}

export interface ISystem {
  subsystems: Map<string, ISubsystem>;
  types: Map<string, IType>;
  loadSubsystems: (newSubsystems: ISubsystem[], append: boolean) => void;
  loadTypes: (newTypes: IType[], append: boolean) => void;
  findType: (typeName: string) => IType | undefined;
  getTypes: () => IType[];
  findSubsystem: (subsysName: string) => ISubsystem | undefined;
  getSubsystems: () => ISubsystem[];
  getName: () => string;
  getDescription: () => string;
  getSysName: () => string;
  setSysName: (name: string) => void;
  getEnvName: () => string;
  setEnvName: (name: string) => void;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
}

export interface IType {
  getName: () => string;
  getDescription: () => string;
  getFileExt: () => string;
  setFileExt: (ext: string) => void;
  getTypeName: () => string;
  setTypeName: (name: string) => void;
  getStgNum: () => string;
  setStgNum: (num: string) => void;
  getSysName: () => string;
  setSysName: (name: string) => void;
  getEnvName: () => string;
  setEnvName: (name: string) => void;
  getRepository: () => IRepository;
  setRepository: (repo: IRepository) => void;
}
