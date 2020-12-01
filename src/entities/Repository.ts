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

import { EndevorFilter, FILTER_ALL_STRING } from './EndevorFilter';
import { IFilter } from '../interface/IFilter';
import {
  IEndevorFilter,
  IEnvironment,
  IRepository,
  ISystem,
} from '../interface/entities';

export class Repository implements IRepository {
  private _id?: number;
  private _name?: string;
  private url?: string;
  private username?: string | undefined;
  private password?: string | undefined;
  private datasource?: string;
  private _environments?: Map<string, IEnvironment>;
  private _filters?: IEndevorFilter[];
  private _map?: IEndevorFilter;
  private _profileLabel?: string | undefined;

  constructor(
    name: string,
    url: string,
    username: string | undefined,
    password: string | undefined,
    datasource: string,
    profileLabel: string | undefined,
    id?: number
  ) {
    this._id = id;
    this._name = name;
    this.url = url;
    this.username = username;
    this.password = password;
    this.datasource = datasource;
    this._environments = new Map();
    this._filters = [];
    this._map = new EndevorFilter(this, FILTER_ALL_STRING);
    this._profileLabel = profileLabel;
  }

  public loadInfoFromConfig(repo: IRepository) {
    this._name = repo.getName();
    this.url = repo.getUrl();
    this.username = repo.getUsername();
    this.datasource = repo.getDatasource();
    this._filters = repo.getEndevorFilters();
    if (this._filters) {
      this._filters.forEach((filter) => {
        filter.setRepository(this);
      });
    }
  }

  public loadEnvironments(envs: IEnvironment[], append: boolean) {
    if (!append) {
      this._environments = new Map();
    }
    envs.forEach((env) => {
      env.setRepository(this);
      if (this._environments) {
        this._environments.set(env.getEnvName(), env);
      }
    });
  }

  public findEnvironment(envName: string): IEnvironment | undefined {
    if (this._environments) {
      this._environments.get(envName);
    }
    return undefined;
  }

  public findSystem(envName: string, sysName: string): ISystem | undefined {
    const env: IEnvironment | undefined = this.findEnvironment(envName);
    if (env) {
      return env.findSystem(sysName);
    }
  }

  public findType(typeName: string, envName: string, sysName: string) {
    const system: ISystem | undefined = this.findSystem(envName, sysName);
    if (system) {
      return system.findType(typeName);
    }
  }

  public findFilter(uri: string): IEndevorFilter | undefined {
    if (this._filters) {
      for (const filter of this._filters) {
        if (filter.getUri() === uri) {
          return filter;
        }
      }
    }
  }

  public get id(): number | undefined {
    return this._id;
  }
  public set id(value: number | undefined) {
    this._id = value;
  }

  public setName(value: string) {
    this._name = value;
  }

  public getName(): string | undefined {
    return this._name;
  }
  public setProfileLabel(value: string) {
    this._profileLabel = value;
  }

  public getProfileLabel(): string | undefined {
    return this._profileLabel;
  }

  public isAttachedToConnection(value: string) {
    return value === this._profileLabel;
  }

  public setUsername(value: string) {
    this.username = value;
  }

  public getUsername(): string | undefined {
    return this.username;
  }

  public setPassword(value: string) {
    this.password = value;
  }

  public getPassword(): string | undefined {
    return this.password;
  }

  public getDescription(): string | undefined {
    return this.url + ' | ' + this.datasource;
  }

  public getUrl(): string | undefined {
    return this.url;
  }

  public setUrl(value: string) {
    this.url = value;
  }

  public getDatasource(): string | undefined {
    return this.datasource;
  }

  public setDatasource(value: string) {
    this.datasource = value;
  }

  public getEnvironmentMap(): Map<string, IEnvironment> | undefined {
    return this._environments;
  }

  public get environments(): IEnvironment[] | undefined {
    if (this._environments) {
      return Array.from(this._environments.values());
    } else {
      return undefined;
    }
  }

  public get filters(): IEndevorFilter[] | undefined {
    return this._filters;
  }

  public set filters(value: IEndevorFilter[] | undefined) {
    this._filters = value;
  }

  public get map(): IEndevorFilter | undefined {
    return this._map;
  }

  public set map(value: IEndevorFilter | undefined) {
    this._map = value;
  }

  public getUrlString(): string {
    let urlPath: string = 'EndevorService/rest/' + this.datasource;
    if (this.datasource !== '') {
      urlPath = urlPath + '/';
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.url && !this.url.endsWith('/')) {
      urlPath = '/' + urlPath;
    }
    return this.url + urlPath;
  }

  public getRepository(): IRepository {
    return this;
  }

  public getFilters(): IFilter[] | undefined {
    const resultFilters: IFilter[] = [];
    if (this._filters) {
      this._filters.forEach((filter) => {
        resultFilters.push({ uri: filter.getUri() });
      });
      return resultFilters;
    } else {
      return undefined;
    }
  }

  public getEndevorFilters(): IEndevorFilter[] | undefined {
    return this._filters;
  }

  /**
   * Checks if this repository is the same instance (url, datasource and username are equal) as parameter `repo`
   * @param repo Repository to compare with this repository
   * @return True if this repository and `repo` have the same Endevor instance.
   */
  public isSameInstance(repo: IRepository | undefined): boolean {
    if (!repo) {
      return false;
    }
    if (this.url !== repo.getUrl()) {
      return false;
    }
    if (this.datasource !== repo.getDatasource()) {
      return false;
    }
    if (this.username !== repo.getUsername()) {
      return false;
    }
    return true;
  }

  /**
   * Checks if this repository is the same as parameter `repo`. Password and metadata are not used in the comparison.
   * @param repo Repository to compare with this repository
   * @return True if this repository and `repo` are the same.
   */
  public isEqual(repo: IRepository | undefined): boolean {
    if (!repo || !this.isSameInstance(repo)) {
      return false;
    }
    if (repo.getName() !== this.getName()) {
      return false;
    }
    if (this._filters) {
      if (this._filters.length !== this._filters.length) {
        return false;
      }
      for (const filter of this._filters) {
        if (!this.findFilter(filter.getUri())) {
          return false;
        }
      }
    }

    return true;
  }
}
