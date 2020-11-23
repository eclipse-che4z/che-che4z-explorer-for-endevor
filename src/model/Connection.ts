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
import { Repository } from './Repository';
import { IProfileLoaded, IProfile } from '@zowe/imperative';

export class Connection extends EndevorEntity implements IProfileLoaded {
  message: string;
  type: string;
  failNotFound: boolean;
  name?: string;
  referencedBy?: string;
  profile?: IProfile;
  dependenciesLoaded?: boolean;
  dependencyLoadResponses?: IProfileLoaded[];
  private _repositories: Map<string, Repository>;

  constructor(profile: IProfileLoaded) {
    super();
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

  public loadRepository(repo: Repository) {
    this._repositories.set(repo.getName(), repo);
  }

  public findRepository(repoName: string): Repository | undefined {
    return this._repositories.get(repoName);
  }

  public getRepository(): Repository {
    throw new Error('Method not implemented.');
  }

  public getRepositoryMap(): Map<string, Repository> {
    return this._repositories;
  }

  public getRepositoryList(): Repository[] {
    return Array.from(this._repositories.values());
  }

  public setRepositoryList(repos: Repository[]) {
    repos.forEach((repo) => {
      this._repositories.set(repo.getName(), repo);
    });
  }
  public get repositories(): Map<string, Repository> {
    return this._repositories;
  }

  public set repositories(repoMap: Map<string, Repository>) {
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
