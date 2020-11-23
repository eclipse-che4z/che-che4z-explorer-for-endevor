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

import { IProfileLoaded, IProfile } from '@zowe/imperative';
import { IConnection } from '../interface/IConnection';
import { IRepository } from '../interface/IRepository';

export class Connection implements IConnection {
  message: string;
  type: string;
  failNotFound: boolean;
  name?: string;
  referencedBy?: string;
  profile?: IProfile;
  dependenciesLoaded?: boolean;
  dependencyLoadResponses?: IProfileLoaded[];
  private _repositories: Map<string, IRepository>;

  constructor(profile: IProfileLoaded) {
    this.message = profile.message;
    this.type = profile.type;
    this.failNotFound = profile.failNotFound;
    this.name = profile.name;
    this.referencedBy = profile.referencedBy;
    this.profile = profile.profile;
    this.dependenciesLoaded = profile.dependenciesLoaded;
    this.dependencyLoadResponses = profile.dependencyLoadResponses;
    this._repositories = new Map();
  }

  public loadRepository(repo: IRepository) {
    this._repositories.set(repo.getName(), repo);
  }

  public findRepository(repoName: string): IRepository | undefined {
    return this._repositories.get(repoName);
  }

  public getRepository(): IRepository {
    throw new Error('Method not implemented.');
  }

  public getRepositoryMap(): Map<string, IRepository> {
    return this._repositories;
  }

  public getRepositoryList(): IRepository[] {
    return Array.from(this._repositories.values());
  }

  public setRepositoryList(repos: IRepository[]) {
    repos.forEach((repo) => {
      this._repositories.set(repo.getName(), repo);
    });
  }
  public get repositories(): Map<string, IRepository> {
    return this._repositories;
  }

  public set repositories(repoMap: Map<string, IRepository>) {
    this._repositories = repoMap;
  }

  public getConnection(): Connection {
    return this;
  }

  public getName(): string | undefined {
    return this.name;
  }
  public getDescription(): string {
    return '';
  }

  public getProfile(): IProfile | undefined {
    return this.profile;
  }
}
