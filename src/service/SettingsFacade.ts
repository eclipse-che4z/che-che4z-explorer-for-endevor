/*
 * Copyright (c) 2019 Broadcom.
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

import * as vscode from "vscode";
import { EndevorFilter } from "../model/EndevorFilter";
import { Host } from "../model/IEndevorInstance";
import { Repository } from "../model/Repository";

export const HOST_SETTINGS_KEY: string = "endevor.hosts";

export class SettingsFacade {
    public static listRepositories(): Repository[] {
        const repos: Repository[] = [];
        const hosts: Host[] = vscode.workspace.getConfiguration().get(HOST_SETTINGS_KEY, []) as Host[];
        hosts.forEach(host => {
            const repo: Repository = new Repository(
                host.name,
                host.url,
                host.username,
                host.password,
                host.datasource,
                host.id,
            );
            if (host.filters) {
                const newFilters: Map<string, EndevorFilter> = new Map();
                host.filters.forEach(filter => {
                    newFilters.set(filter.uri, new EndevorFilter(repo, filter.uri));
                    repo.filters.push(new EndevorFilter(repo, filter.uri));
                });
                repo.filters = Array.from(newFilters.values());
            }
            repos.push(repo);
        });
        return repos;
    }

    public static async updateRepositories(repos: Repository[]) {
        const hosts: Host[] = [];
        repos.forEach(repo => {
            hosts.push({
                datasource: repo.getDatasource(),
                filters: repo.getIFilters(),
                id: repo.id,
                name: repo.getName(),
                url: repo.getUrl(),
                username: repo.getUsername(),
            });
        });
        try {
            await vscode.workspace.getConfiguration().update(HOST_SETTINGS_KEY, hosts);
        } catch (error) {
            vscode.window.showErrorMessage("Save settings error: " + error);
        }
    }
}
