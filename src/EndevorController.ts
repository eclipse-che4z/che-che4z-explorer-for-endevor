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

import { SettingsFacade } from './service/SettingsFacade';
import {
  EndevorNode,
  EndevorBrowsingNode,
  FilterNode,
} from './ui/tree/EndevorNodes';
import { Host } from './interface/IEndevorInstance';
import { Connection } from './entities/Connection';
import { IEndevorNode } from './interface/IEndevorNode';
import { IEndevorDataProvider } from './interface/dataProvider_controller';
import { IConnection, IRepository } from './interface/entities';

export class EndevorController {
  /**
   * EndevorController singleton instance.
   */
  private static _instance: EndevorController;

  /**
   * This is the root node of Explorer for Endevor view. It is derived from [TreeItem](#TreeItem).
   * Its children are repository nodes.
   */
  private _rootNode: IEndevorNode = new EndevorNode(undefined);

  private connections: Map<string, IConnection> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static get instance(): EndevorController {
    if (!this._instance) {
      this._instance = new EndevorController();
    }
    return this._instance;
  }

  public getRootNode(): IEndevorNode {
    return this._rootNode;
  }

  public setRootNode(value: IEndevorNode) {
    this._rootNode = value;
  }

  public addRepository(repo: IRepository, connectionLabel: string) {
    if (typeof repo.id === 'undefined') {
      repo.id = this.findNextId(connectionLabel);
    }
    const newRepoNode: IEndevorNode = new EndevorNode(repo);
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      conn.loadRepository(repo);
    }
    this._rootNode.getChildren().forEach((child) => {
      const entity = child.getEntity();
      if (entity && entity.getName() === connectionLabel) {
        child.getChildren().push(newRepoNode);
      }
    });
  }

  public getConnections(): IConnection[] {
    return Array.from(this.connections.values());
  }
  public addConnection(connection: Connection) {
    if (!connection.name) {
      connection.name = '';
    }
    this.connections.set(connection.name, connection);
    const newConnectionNode = new EndevorNode(connection);
    this._rootNode.getChildren().push(newConnectionNode);
  }

  public removeConnection(connectionName: string) {
    this.connections.delete(connectionName);
    this._rootNode.getChildren().forEach((connection, index) => {
      if (connection.label === connectionName) {
        this._rootNode.getChildren().splice(index, 1);
      }
    });
  }

  public removeRepository(repoName: string, connectionLabel: string) {
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      conn.getRepositoryMap().delete(repoName);
    }
    this._rootNode.getChildren().forEach((connection, index) => {
      if (connection.label === connectionLabel) {
        this._rootNode
          .getChildren()
          [index].setChildren(
            connection.getChildren().filter((repo) => repo.label !== repoName)
          );
      }
    });
  }

  public updateRepositoryName(
    oldRepoName: string,
    newRepoName: string,
    connectionLabel: string
  ) {
    const newMap = new Map();
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      conn.getRepositoryMap().forEach((repo, name) => {
        if (name === oldRepoName) {
          repo.setName(newRepoName);
          newMap.set(newRepoName, repo);
        } else {
          newMap.set(name, repo);
        }
      });
      conn.repositories = newMap;
    }
    const cnxIdx = this.getRootNode()
      .getChildren()
      .findIndex((node) => node.label === connectionLabel);
    const repoIdx = this.getRootNode()
      .getChildren()
      [cnxIdx].getChildren()
      .findIndex((repo) => repo.label === oldRepoName);
    this.getRootNode().getChildren()[cnxIdx].getChildren()[
      repoIdx
    ].label = newRepoName;
  }

  public updateSettings() {
    SettingsFacade.updateSettings(this.getConnections());
  }

  public updateNeedReloadInTree(
    parNeedReload: boolean,
    refreshTreeRoot: IEndevorNode
  ) {
    refreshTreeRoot.updateNeedReload(parNeedReload);
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
  public loadRepositories(endevorDataProvider: IEndevorDataProvider) {
    const connectionsFromSettings: Map<string, Host[]> = new Map();
    SettingsFacade.listConnections().forEach((conn) =>
      connectionsFromSettings.set(conn.name, conn.hosts)
    );
    this.getRootNode().setNeedReload(false);
    if (this.getRootNode().getChildren().length !== this.connections.size) {
      this.getRootNode().setNeedReload(true);
    }
    connectionsFromSettings.forEach((hostList, connName) => {
      const connNode = EndevorController.instance.findNodeByConnectionName(
        connName
      );
      if (connNode) {
        const reposFromSettings: IRepository[] = SettingsFacade.listRepositories(
          connName
        );
        const updatedRepos: Map<string, IRepository> = new Map();
        reposFromSettings.forEach((settingsRepo) => {
          const repoNode:
            | IEndevorNode
            | undefined = EndevorController.instance.findNodeByRepoID(
            settingsRepo.id,
            connName
          );
          let repoToKeep: IRepository = settingsRepo;
          if (repoNode) {
            const modelRepo: IRepository | undefined = repoNode.getRepository();
            if (modelRepo) {
              if (modelRepo.isEqual(settingsRepo)) {
                this.getRootNode().setNeedReload(true);
                if (!modelRepo.isSameInstance(settingsRepo)) {
                  repoNode.setNeedReload(!repoNode.hasChildren());
                } else {
                  repoNode.setNeedReload(true);
                }
                modelRepo.loadInfoFromConfig(settingsRepo);
              }
              repoToKeep = modelRepo;
            }
            this.checkAndReloadFilters(repoNode, repoToKeep);
            repoNode.updateInfo();
          } else {
            this.getRootNode().setNeedReload(true);
          }
          const repoName = repoToKeep.getName();
          if (repoName) {
            updatedRepos.set(repoName, repoToKeep);
          }
        });
        const currentRepos = updatedRepos;
        currentRepos.forEach((repo) => {
          let profileLabel = repo.getProfileLabel();
          if (!profileLabel) {
            profileLabel = '';
          }
          EndevorController.instance.addRepository(repo, profileLabel);
        });
        this.updateIDs(connName);
      } else {
        // const endevorDataProvider = new EndevorDataProvider(this);
        endevorDataProvider.addSession(connName);
      }
    });
  }

  public isRepoInConnection(
    repoName: string,
    connectionLabel: string
  ): boolean {
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      const repoMap = conn.getRepositoryMap();
      return repoMap.get(repoName) ? true : false;
    }
    return false;
  }

  public findNodeByRepoID(
    id: number | undefined,
    connectionLabel: string
  ): IEndevorNode | undefined {
    if (id === undefined) {
      return undefined;
    }
    const connection = this.findNodeByConnectionName(connectionLabel);
    if (connection) {
      for (const node of connection.getChildren()) {
        const nodeRepo: IRepository | undefined = node.getRepository();
        if (nodeRepo && nodeRepo.id === id) {
          return node;
        }
      }
    }
    return undefined;
  }

  public findNodeByConnectionName(name: string): IEndevorNode | undefined {
    if (!name) {
      return undefined;
    }
    for (const node of this._rootNode.getChildren()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (node.getEntity() && node.getEntity()!.getName() === name) {
        return node;
      }
    }
  }

  /**
   * Function used to determine next available `id`.
   */
  public findNextId(connectionLabel: string): number {
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      const repoMap = conn.getRepositoryMap();
      const iDArray: boolean[] = new Array(repoMap.size);
      iDArray.fill(true);
      repoMap.forEach((repo) => {
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
    return -1;
  }

  /**
   * In case `id` is not present in the settings.json, this function will determine it
   * and store in the settings.json.
   */
  private updateIDs(connectionLabel: string) {
    const conn = this.connections.get(connectionLabel);
    if (conn) {
      const repoMap = conn.getRepositoryMap();
      let saveRepos = false;
      repoMap.forEach((repo) => {
        if (repo.id === undefined) {
          repo.id = EndevorController.instance.findNextId(connectionLabel);
          saveRepos = true;
        }
      });
      if (saveRepos) {
        this.updateSettings();
      }
    }
  }

  /**
   * Checks if current filters of the repository node - `repoNode` are different from the loaded ones in `loadedRepo`.
   * Along with updating the filters in model (`Repository`), it also updates the tree.
   * @param repoNode `EndevorNode` containing repository with current filters.
   * @param repo Repository loaded from settings.json
   */
  private checkAndReloadFilters(repoNode: IEndevorNode, repo: IRepository) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const filtersNode: EndevorBrowsingNode = <EndevorBrowsingNode>(
      repoNode.getChildren().find((child) =>
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (<EndevorBrowsingNode>child).isFiltersNode()
      )
    );
    if (!filtersNode) {
      return;
    }
    const newChildren: Map<string, IEndevorNode> = new Map();
    const repoFilters = repo.getEndevorFilters();
    if (repoFilters) {
      repoFilters.forEach((filter) => {
        let newNode: IEndevorNode | undefined = filtersNode.findFilterNode(
          filter
        );
        if (newNode) {
          newNode.updateInfo();
          newNode.setNeedReload(!newNode.hasChildren());
        } else {
          newNode = new FilterNode(filter);
        }
        newChildren.set(filter.getUri(), newNode);
      });
      filtersNode.setChildren(Array.from(newChildren.values()));
      filtersNode.setNeedReload(false);
    }
  }
}
