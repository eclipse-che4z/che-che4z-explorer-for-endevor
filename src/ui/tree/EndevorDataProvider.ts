/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
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
import {
  EndevorNode,
  EndevorBrowsingNode,
  FilterNode,
  EndevorFilterPathNode,
  ConnectionNode,
  NewConnectionButton,
  EnvironmentNode,
  StageNode,
  SystemNode,
  SubsystemNode,
  TypeNode,
} from './EndevorNodes';
import { Profiles } from '../../service/Profiles';
import { Logger, IProfileLoaded } from '@zowe/imperative';
import { logger } from '../../globals';
import { Connection } from '../../entities/Connection';
import { IEndevorNode } from '../../interface/IEndevorNode';
import { IEndevorEntity, IRepository } from '../../interface/entities';
import { IEndevorController } from '../../interface/dataProvider_controller';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createEndevorTree(
  log: Logger,
  controllerInstance: IEndevorController
) {
  const tree = new EndevorDataProvider(controllerInstance);
  await tree.addSession();
  return tree;
}
export class EndevorDataProvider
  implements vscode.TreeDataProvider<IEndevorNode> {
  public _sessionNodes: IEndevorNode[] = [];
  public _onDidChangeTreeData = new vscode.EventEmitter<IEndevorNode | null>();
  public controllerInstance: IEndevorController;
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(controllerInstance: IEndevorController) {
    this.controllerInstance = controllerInstance;
  }

  public getTreeItem(element: IEndevorNode): vscode.TreeItem {
    return element;
  }

  public addSession(sessionName?: string) {
    logger.trace(`Adding <${sessionName}> session to the tree.`);
    if (sessionName) {
      const endevorProfile = Profiles.getInstance().loadNamedProfile(
        sessionName
      );
      if (endevorProfile) {
        this.addSingleSession(endevorProfile);
      } else {
        logger.error(`Profile not found for session <${sessionName}>.`);
      }
    } else {
      const endevorProfiles = Profiles.getInstance().allProfiles;
      for (const endevorProfile of endevorProfiles) {
        if (
          this._sessionNodes.find(
            (tempNode) =>
              tempNode.label && tempNode.label.trim() === endevorProfile.name
          )
        ) {
          continue;
        }
      }
      const defaultProfile = Profiles.getInstance().defaultProfile;
      if (this._sessionNodes.length === 0 && defaultProfile) {
        this.addSingleSession(defaultProfile);
      }
    }
    this.refresh();
  }

  public getChildren(
    node?: IEndevorNode
  ): IEndevorNode[] | Promise<IEndevorNode[]> {
    if (!node) {
      const root: IEndevorNode = this.controllerInstance.getRootNode();
      if (!root.getNeedReload()) {
        return Promise.resolve([
          new NewConnectionButton(),
          ...root.getChildren(),
        ]);
      }
      const connections = this.controllerInstance.getConnections();
      const newChildren: IEndevorNode[] = [];
      connections.forEach((connection) => {
        const newConnectionNode: IEndevorNode = new EndevorNode(
          connection as IEndevorEntity
        );
        let foundConnection: IEndevorNode | undefined;
        const connectionName = connection.getName();
        if (connectionName) {
          foundConnection = this.controllerInstance.findNodeByConnectionName(
            connectionName
          );
        }
        if (foundConnection && foundConnection.getNeedReload()) {
          newConnectionNode.setChildren(foundConnection.getChildren());
          newConnectionNode.setNeedReload(false);
          newConnectionNode.collapsibleState = foundConnection.collapsibleState;
        }
        newChildren.push(newConnectionNode);
      });
      root.setNeedReload(false);
      root.setChildren(newChildren);
      return Promise.resolve([new NewConnectionButton(), ...newChildren]);
    }
    switch (node.contextValue) {
      case 'connection':
        return Promise.resolve((<ConnectionNode>node).getChildren());
      case 'repository':
        const repo: IRepository | undefined = this.getNodeRepository(node);
        if (!repo) {
          return Promise.resolve([]);
        }
        if (!node.getNeedReload()) {
          return Promise.resolve(node.getChildren());
        }
        return new Promise((resolve) => {
          const resultNodes: IEndevorNode[] = [];
          resultNodes.push(new EndevorBrowsingNode('Filters', repo));
          resultNodes.push(new EndevorBrowsingNode('Map', repo));
          node.setChildren(resultNodes);
          node.setNeedReload(false);
          resolve(resultNodes);
        });
      case 'filters':
      case 'map':
        return (<EndevorBrowsingNode>node).lazyLoadChildren();
      case 'filter':
        return (<FilterNode>node).lazyLoadChildren();
      case 'filterPathNode':
        return (<EndevorFilterPathNode>node).lazyLoadChildren();
      case 'environment':
        return (<EnvironmentNode>node).lazyLoadChildren();
      case 'stage':
        return (<StageNode>node).lazyLoadChildren();
      case 'system':
        return (<SystemNode>node).lazyLoadChildren();
      case 'subsystem':
        return (<SubsystemNode>node).lazyLoadChildren();
      case 'type':
        return (<TypeNode>node).lazyLoadChildren();
      default:
        return Promise.resolve([]);
    }
  }

  public refresh() {
    this._onDidChangeTreeData.fire(null);
  }

  private getNodeRepository(node: IEndevorNode): IRepository | undefined {
    let repo: IRepository | undefined = node.getRepository();
    if (node instanceof EndevorBrowsingNode) {
      repo = (<EndevorBrowsingNode>node).getRepository();
    }
    return repo;
  }

  private async addSingleSession(endevorProfile: IProfileLoaded) {
    logger.trace(`Loading profile <${endevorProfile.name}>.`);
    if (
      this._sessionNodes.find(
        (tempNode) =>
          tempNode.label && tempNode.label.trim() === endevorProfile.name
      )
    ) {
      return;
    }
    const session = await Profiles.getInstance().createBasicEndevorSession(
      endevorProfile.profile
    );
    logger.trace(`Session created: ${JSON.stringify(session)}`);
    const node = new ConnectionNode(session, endevorProfile.name);
    this.controllerInstance.addConnection(new Connection(endevorProfile));
    this._sessionNodes.push(node);
  }
}
