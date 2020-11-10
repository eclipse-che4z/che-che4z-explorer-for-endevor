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

import * as vscode from 'vscode';
import { EndevorFilter } from '../model/EndevorFilter';
import { Host } from '../model/IEndevorInstance';
import { Repository } from '../model/Repository';
import { Connection } from '../model/Connection';
import { Profiles } from './Profiles';
import { logger } from '../globals';

export const HOST_SETTINGS_KEY: string = 'endevor.connections';

export class SettingsFacade {
    public static listConnections(): any[] {
        return vscode.workspace.getConfiguration().get(HOST_SETTINGS_KEY, []);
    }

    public static listRepositories(connectionLabel: string): Repository[] {
        const repos: Repository[] = [];
        // tslint:disable-next-line: max-line-length
        const allConnectionsInSettings: any[] = vscode.workspace
            .getConfiguration()
            .get(HOST_SETTINGS_KEY, []);
        const connectionInSettings = allConnectionsInSettings.find(
            (connection) => connection.name === connectionLabel
        );
        const hosts: Host[] = connectionInSettings
            ? connectionInSettings.hosts
            : [];
        const profile = Profiles.getInstance().loadNamedProfile(connectionLabel)
            .profile;
        if (profile) {
            hosts.forEach((host) => {
                const repo: Repository = new Repository(
                    host.name,
                    `${profile.protocol}://${profile.host}:${profile.port}`,
                    profile.user,
                    profile.password,
                    host.datasource,
                    host.profileLabel,
                    host.id
                );
                if (host.filters) {
                    const newFilters: Map<string, EndevorFilter> = new Map();
                    host.filters.forEach((filter) => {
                        newFilters.set(
                            filter.uri,
                            new EndevorFilter(repo, filter.uri)
                        );
                        repo.filters.push(new EndevorFilter(repo, filter.uri));
                    });
                    repo.filters = Array.from(newFilters.values());
                }
                repos.push(repo);
            });
        }
        return repos;
    }

    public static async updateSettings(connections: Connection[]) {
        const conns: any[] = [];
        connections.forEach((connection) => {
            const hostsArray: any[] = [];
            const toPush = {
                name: connection.getName(),
                // tslint:disable-next-line: object-literal-sort-keys
                hosts: hostsArray,
            };
            connection.getRepositoryList().forEach((repo) => {
                toPush.hosts.push({
                    datasource: repo.getDatasource(),
                    filters: repo.getIFilters(),
                    id: repo.id,
                    name: repo.getName(),
                    profileLabel: repo.getProfileLabel(),
                    url: repo.getUrl(),
                    username: repo.getUsername(),
                });
            });
            conns.push(toPush);
        });
        try {
            await vscode.workspace
                .getConfiguration()
                .update(
                    HOST_SETTINGS_KEY,
                    conns,
                    vscode.ConfigurationTarget.Global
                );
        } catch (error) {
            logger.error('Error saving to settings.', error);
        }
    }

    public static async updateRepositories(connection: Connection) {
        const repos = connection.getRepositoryList();
        const hosts: Host[] = [];
        repos.forEach((repo) => {
            hosts.push({
                datasource: repo.getDatasource(),
                filters: repo.getIFilters(),
                id: repo.id,
                name: repo.getName(),
                profileLabel: repo.getProfileLabel(),
                url: repo.getUrl(),
                username: repo.getUsername(),
            });
        });
        const value = {
            'endevor.hosts': hosts,
        };

        try {
            await vscode.workspace
                .getConfiguration()
                .update(
                    HOST_SETTINGS_KEY,
                    value,
                    vscode.ConfigurationTarget.Global
                );
        } catch (error) {
            logger.error('Error saving to settings.', error);
        }
    }
}
