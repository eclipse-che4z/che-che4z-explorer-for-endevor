/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Broadcom, Inc. - initial API and implementation
 */

import * as vscode from 'vscode';
import { Connection } from '../entities/Connection';
import { IConnection, IRepository } from './entities';
import { IEndevorNode } from './IEndevorNode';

export interface IEndevorController {
  getRootNode: () => IEndevorNode;
  setRootNode: (node: IEndevorNode) => void;
  addRepository: (repo: IRepository, connectionLabel: string) => void;
  getConnections: () => IConnection[];
  addConnection: (connection: Connection) => void;
  removeConnection: (connectionName: string) => void;
  removeRepository: (repoName: string, connectionLabel: string) => void;
  updateRepositoryName: (
    oldRepoName: string,
    newRepoName: string,
    connectionLabel: string
  ) => void;
  updateSettings: () => void;
  updateNeedReloadInTree: (
    parNeedReload: boolean,
    refreshTreeRoot: IEndevorNode
  ) => void;
  loadRepositories: (endevorDataProvider: IEndevorDataProvider) => void;
  isRepoInConnection: (repoName: string, connectionLabel: string) => boolean;
  findNodeByRepoID: (
    id: number | undefined,
    connectionLabel: string
  ) => IEndevorNode | undefined;
  findNodeByConnectionName: (name: string) => IEndevorNode | undefined;
  findNextId: (connectionLabel: string) => number;
}

export interface IEndevorDataProvider {
  _sessionNodes: IEndevorNode[];
  _onDidChangeTreeData: vscode.EventEmitter<IEndevorNode | null>;
  controllerInstance: IEndevorController;
  onDidChangeTreeData: vscode.Event<IEndevorNode | null>;
  getTreeItem: (element: IEndevorNode) => vscode.TreeItem;
  addSession: (sessionName?: string) => void;
  getChildren: (
    node?: IEndevorNode
  ) => IEndevorNode[] | Promise<IEndevorNode[]>;
  refresh: () => void;
}
