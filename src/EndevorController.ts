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

import { Repository } from './model/Repository';
import { SettingsFacade } from './service/SettingsFacade';
import { EndevorNode, EndevorBrowsingNode, FilterNode } from './ui/tree/EndevorNodes';

export class EndevorController {
    /**
     * EndevorController singleton instance.
     */
    private static _instance: EndevorController;

    /**
     * This is the root node of Explorer for Endevor view. It is derived from [TreeItem](#TreeItem).
     * Its children are repository nodes.
     */
    private _rootNode: EndevorNode = new EndevorNode(undefined);

    /**
     * Endevor model high level representing Endevor instances (repositories).
     * Repositories in turn have stage and system metadata.
     */
    private repositories: Map<string, Repository> = new Map();

    private constructor() { }

    public static get instance(): EndevorController {
        if (!this._instance) {
            this._instance = new EndevorController();
        }
        return this._instance;
    }

    public get rootNode(): EndevorNode {
        return this._rootNode;
    }

    public set rootNode(value: EndevorNode) {
        this._rootNode = value;
    }

    public getRepositories(): Repository[] {
        return Array.from(this.repositories.values());
    }

    public addRepository(repo: Repository) {
        if (!repo.id) {
            repo.id = this.findNextId();
        }
        this.repositories.set(repo.getName(), repo);
        const newRepoNode: EndevorNode = new EndevorNode(repo);
        this._rootNode.children.push(newRepoNode);
    }

    public removeRepository(repoName: string) {
        this.repositories.delete(repoName);
    }

    public saveRepositories() {
        SettingsFacade.updateRepositories(this.getRepositories());
    }

    public updateNeedReloadInTree(parNeedReload: boolean, refreshTreeRoot: EndevorNode) {
        refreshTreeRoot.updateNeedReload(parNeedReload);
    }

    /**
     * Checks if current filters of the repository node - `repoNode` are different from the loaded ones in `loadedRepo`.
     * Along with updating the filters in model (`Repository`), it also updates the tree.
     * @param repoNode `EndevorNode` containing repository with current filters.
     * @param repo Repository loaded from settings.json
     */
    private checkAndReloadFilters(repoNode: EndevorNode, repo: Repository) {
        let filtersNode: EndevorBrowsingNode = <EndevorBrowsingNode>repoNode.children.find(child => (<EndevorBrowsingNode>child).isFiltersNode());
        if (!filtersNode) {
            return;
        }
        let newChildren: Map<string, EndevorNode> = new Map();
        repo.filters.forEach(filter => {
            let newNode: EndevorNode | undefined = filtersNode.findFilterNode(filter);
            if (newNode) {
                newNode.updateInfo();
                newNode.needReload = !newNode.hasChildren();
            } else {
                newNode = new FilterNode(filter);
            }
            newChildren.set(filter.getUri(), newNode);
        });
        filtersNode.children = Array.from(newChildren.values());
        filtersNode.needReload = false;
    }

    /**
     * Loads the repositories(hosts) from settings.json into the model. It uses the `id` to find out if the loaded repository
     * already exists in the model and then load information from config into the model otherwise keeping the Endevor metadata.
     * Afterwards, it check if filters have been changed and reloads them as well.
     * This function also turns on the `needReload` flag in the repository nodes (in case Endevor instance was changed), and also root
     * node in case number of repositories has changed, or if some repository have changed.
     * In case `id` is not present in the settings.json, function [updateIDs](#EndevorController.updateIDs) is used to determine it
     * and store in the settings.json.
     */
    // tslint:disable-next-line:member-ordering
    public loadRepositories() {
        const reposFromSettings: Repository[] = SettingsFacade.listRepositories();
        const updatedRepos: Map<string, Repository> = new Map();
        this.rootNode.needReload = false;
        if (this.rootNode.children.length !== this.repositories.size) {
            this.rootNode.needReload = true;
        }
        reposFromSettings.forEach(settingsRepo => {
            let repoNode: EndevorNode | undefined = EndevorController.instance.findNodeByRepoID(settingsRepo.id);
            let repoToKeep: Repository = settingsRepo;
            if (repoNode) {
                let modelRepo: Repository | undefined = repoNode.getRepository();
                if (modelRepo) {
                    if (!modelRepo.isEqual(settingsRepo)) {
                        this.rootNode.needReload = true;
                        if (modelRepo.isSameInstance(settingsRepo)) {
                            repoNode.needReload = !repoNode.hasChildren();
                        } else {
                            repoNode.needReload = true;
                        }
                        modelRepo.loadInfoFromConfig(settingsRepo);
                    }
                    repoToKeep = modelRepo;
                }
                this.checkAndReloadFilters(repoNode, repoToKeep);
                repoNode.updateInfo();
            } else {
                this.rootNode.needReload = true;
            }
            updatedRepos.set(repoToKeep.getName(), repoToKeep);
        });
        this.repositories = updatedRepos;
        this.updateIDs();
    }

    /**
     * In case `id` is not present in the settings.json, this function will determine it
     * and store in the settings.json.
     */
    private updateIDs() {
        let saveRepos: boolean = false;
        this.repositories.forEach(repo => {
            if (repo.id === undefined) {
                repo.id = EndevorController.instance.findNextId();
                saveRepos = true;
            }
        });
        if (saveRepos) {
            this.saveRepositories();
        }
    }

    public findRepoByName(name: string): Repository | undefined {
        return this.repositories.get(name);
    }

    public findNodeByRepoID(id: number | undefined): EndevorNode | undefined {
        if (id === undefined) {
            return undefined;
        }
        for (let node of this._rootNode.children) {
            let nodeRepo: Repository | undefined = node.getRepository();
            if (nodeRepo && nodeRepo.id === id) {
                return node;
            }
        }
    }

    /**
     * Function used to determine next available `id`.
     */
    private findNextId(): number {
        let iDArray: boolean[] = new Array(this.repositories.size);
        iDArray.fill(true);
        this.repositories.forEach(repo => {
            if (repo.id !== undefined) {
                iDArray[repo.id] = false;
            }
        });
        for (let i = 0; i < iDArray.length; i++) {
            if (iDArray[i]) {
                return i;
            }
        }
        return iDArray.length;
    }

}
