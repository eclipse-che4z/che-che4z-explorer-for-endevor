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

import { EndevorEntity } from "./EndevorEntity";
import { EndevorFilter, FILTER_ALL_STRING } from "./EndevorFilter";
import { Environment } from "./Environment";
import { Filter } from "./IEndevorEntities";
import { System } from "./System";

export class Repository extends EndevorEntity {
    private _id?: number;
    private name: string;
    private url: string;
    private username: string;
    private password: string | undefined;
    private datasource: string;
    private _environments: Map<string, Environment>;
    private _filters: EndevorFilter[];
    private _map: EndevorFilter;
    private _profileLabel: string;

    constructor(name: string, url: string, username: string, password: string | undefined, datasource: string, profileLabel: string, id?: number) {
        super();
        this._id = id;
        this.name = name;
        this.url = url;
        this.username = username;
        this.password = password;
        this.datasource = datasource;
        this._environments = new Map();
        this._filters = [];
        this._map = new EndevorFilter(this, FILTER_ALL_STRING);
        this._profileLabel = profileLabel;
    }

    public loadInfoFromConfig(repo: Repository) {
        this.name = repo.name;
        this.url = repo.url;
        this.username = repo.username;
        this.datasource = repo.datasource;
        this._filters = repo.filters;
        this._filters.forEach(filter => {
            filter.setRepository(this);
        });
    }

    public loadEnvironments(envs: Environment[], append: boolean) {
        if (!append) {
            this._environments = new Map();
        }
        envs.forEach(env => {
            env.repository = this;
            this._environments.set(env.envName, env);
        });
    }

    public findEnvironment(envName: string): Environment | undefined {
        return this._environments.get(envName);
    }

    public findSystem(envName: string, sysName: string): System | undefined {
        const env: Environment | undefined = this.findEnvironment(envName);
        if (env) {
            return env.findSystem(sysName);
        }
    }

    public findType(typeName: string, envName: string, sysName: string) {
        const system: System | undefined = this.findSystem(envName, sysName);
        if (system) {
            return system.findType(typeName);
        }
    }

    public findFilter(uri: string): EndevorFilter | undefined {
        for (const filter of this.filters) {
            if (filter.getUri() === uri) {
                return filter;
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
        this.name = value;
    }

    public getName(): string {
        return this.name;
    }
    public setProfileLabel(value: string) {
        this._profileLabel = value;
    }

    public getProfileLabel(): string {
        return this._profileLabel;
    }

    public isAttachedToConnection(value: string) {
        return value === this._profileLabel;
    }

    public setUsername(value: string) {
        this.username = value;
    }

    public getUsername(): string {
        return this.username;
    }

    public setPassword(value: string) {
        this.password = value;
    }

    public getPassword(): string | undefined {
        return this.password;
    }

    public getDescription(): string {
        return this.url + " | " + this.datasource;
    }

    public getUrl(): string {
        return this.url;
    }

    public setUrl(value: string) {
        this.url = value;
    }

    public getDatasource(): string {
        return this.datasource;
    }

    public setDatasource(value: string) {
        this.datasource = value;
    }

    public getEnvironmentMap(): Map<string, Environment> {
        return this._environments;
    }

    public get environments(): Environment[] {
        return Array.from(this._environments.values());
    }

    public get filters(): EndevorFilter[] {
        return this._filters;
    }

    public set filters(value: EndevorFilter[]) {
        this._filters = value;
    }

    public get map(): EndevorFilter {
        return this._map;
    }

    public set map(value: EndevorFilter) {
        this._map = value;
    }

    public getUrlString(): string {
        let urlPath: string = "EndevorService/rest/" + this.datasource;
        if (this.datasource !== "") {
            urlPath = urlPath + "/";
        }
        if (!this.url.endsWith("/")) {
            urlPath = "/" + urlPath;
        }
        return this.url + urlPath;
    }

    public getRepository(): Repository {
        return this;
    }

    public getIFilters(): Filter[] {
        const resultFilters: Filter[] = [];
        this._filters.forEach(filter => {
            resultFilters.push({ uri: filter.getUri() });
        });
        return resultFilters;
    }

    /**
     * Checks if this repository is the same instance (url, datasource and username are equal) as parameter `repo`
     * @param repo Repository to compare with this repository
     * @return True if this repository and `repo` have the same Endevor instance.
     */
    public isSameInstance(repo: Repository | undefined): boolean {
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
    public isEqual(repo: Repository | undefined): boolean {
        if (!repo || !this.isSameInstance(repo)) {
            return false;
        }
        if (repo.getName() !== this.getName()) {
            return false;
        }
        if (repo.filters.length !== this.filters.length) {
            return false;
        }
        for (const filter of repo.filters) {
            if (!this.findFilter(filter.getUri())) {
                return false;
            }
        }

        return true;
    }
}
