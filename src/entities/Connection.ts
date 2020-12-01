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
import { IConnection, IRepository } from '../interface/entities';

export class Connection implements IConnection {
  public message: string;
  public type: string;
  public failNotFound: boolean;
  public name?: string;
  public referencedBy?: string;
  public profile?: IProfile;
  public dependenciesLoaded?: boolean;
  public dependencyLoadResponses?: IProfileLoaded[];
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
    const repoName = repo.getName();
    if (repoName) {
      this._repositories.set(repoName, repo);
    }
  }

  public findRepository(repoName: string): IRepository | undefined {
    return this._repositories.get(repoName);
  }

  public getRepositoryArray(): IRepository[] {
    return Array.from(this._repositories.values());
  }

  public setRepositoryArray(repos: IRepository[]) {
    repos.forEach((repo) => {
      const repoName = repo.getName();
      if (repoName) {
        this._repositories.set(repoName, repo);
      }
    });
  }

  public getName(): string {
    return this.name ? this.name : '';
  }

  public getDescription(): string {
    return '';
  }

  public getRepository(): IRepository {
    throw new Error('Method not implemented.');
  }

  public getRepositories(): Map<string, IRepository> {
    return this._repositories;
  }

  public setRepositories(repoMap: Map<string, IRepository>) {
    this._repositories = repoMap;
  }

  public getConnection(): IConnection {
    return this;
  }

  public getProfile(): IProfile | undefined {
    return this.profile;
  }

  public setProfile(profile: IProfile) {
    this.profile = profile;
  }
}
