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

import { IFilter } from './IFilter';
import { IEndevorFilter } from './IEndevorFilter';
import { IEnvironment } from './IEnvironment';
import { ISystem } from './ISystem';
import { IType } from './IType';

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
