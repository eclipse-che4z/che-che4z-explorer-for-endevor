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

import * as vscode from 'vscode';
import { EndevorNode, EndevorBrowsingNode, FilterNode, EndevorFilterPathNode, NewRepositoryNode, ConnectionNode, NewConnectionButton } from './EndevorNodes';
import { EnvironmentNode, StageNode, SystemNode, SubsystemNode, TypeNode } from './EndevorNodes';
import { EndevorController } from '../../EndevorController';
import { Repository } from '../../model/Repository';
import { Profiles } from "../../service/Profiles";
import { Logger, IProfileLoaded } from "@zowe/imperative";
import { Connection } from '../../model/Connection';


export async function createEndevorTree(log: Logger) {
    const tree = new EndevorDataProvider();
    await tree.addSession();
    return tree;
}
export class EndevorDataProvider implements vscode.TreeDataProvider<EndevorNode> {
    public _sessionNodes: EndevorNode[] = [];
    public _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    // constructor() {}

    public getTreeItem(element: EndevorNode): vscode.TreeItem {
        return element;
    }

    public addSession(sessionName?: string) {
        if (sessionName) {
            const endevorProfile = Profiles.getInstance().loadNamedProfile(sessionName);
            if (endevorProfile) {
                this.addSingleSession(endevorProfile);
            }
        } else {
            const endevorProfiles = Profiles.getInstance().allProfiles;
            for (const endevorProfile of endevorProfiles) {
                if (this._sessionNodes.find(tempNode => tempNode.label.trim() === endevorProfile.name)) {
                    continue;
                }
            }
            if (this._sessionNodes.length === 0) {
                this.addSingleSession(Profiles.getInstance().defaultProfile);
            }
        }
        this.refresh();
    }

    public getChildren(node?: EndevorNode): EndevorNode[] | Promise<EndevorNode[]> {
        if (!node) {
            const root: EndevorNode = EndevorController.instance.rootNode;
            // 1st time, this is false (!true)
            if (!root.needReload) {
                return Promise.resolve([new NewConnectionButton(), ...root.children]);
            }
            const connections = EndevorController.instance.getConnections();
            const newChildren: EndevorNode[] = [];
            connections.forEach(connection => {
                const newConnectionNode: EndevorNode = new EndevorNode(connection);
                const foundConnection: EndevorNode | undefined = EndevorController.instance.findNodeByConnectionName(
                    connection.getName());
                // if (foundConnection && !foundConnection.needReload) {
                if (foundConnection && foundConnection.needReload) {
                    newConnectionNode.children = foundConnection.children;
                    newConnectionNode.needReload = false;
                    newConnectionNode.collapsibleState = foundConnection.collapsibleState;
                }
                newChildren.push(newConnectionNode);
            });
            root.needReload = false;
            root.children = newChildren;
            return Promise.resolve([new NewConnectionButton(), ...newChildren]);
        }
        switch (node.contextValue) {
            case "connection":
                return Promise.resolve((<ConnectionNode>node).children);
            case "repository":
                const repo: Repository | undefined = this.getNodeRepository(node);
                if (!repo) {
                    return Promise.resolve([]);
                }
                if (!node.needReload) {
                    return Promise.resolve(node.children);
                }
                return new Promise(resolve => {
                    let resultNodes: EndevorNode[] = [];
                    resultNodes.push(new EndevorBrowsingNode("Filters", repo));
                    resultNodes.push(new EndevorBrowsingNode("Map", repo));
                    node.children = resultNodes;
                    node.needReload = false;
                    resolve(resultNodes);
                });
            case "filters":
            case "map":
                return (<EndevorBrowsingNode>node).lazyLoadChildren();
            case "filter":
                return (<FilterNode>node).lazyLoadChildren();
            case "filterPathNode":
                return (<EndevorFilterPathNode>node).lazyLoadChildren();
            case "environment":
                return (<EnvironmentNode>node).lazyLoadChildren();
            case "stage":
                return (<StageNode>node).lazyLoadChildren();
            case "system":
                return (<SystemNode>node).lazyLoadChildren();
            case "subsystem":
                return (<SubsystemNode>node).lazyLoadChildren();
            case "type":
                return (<TypeNode>node).lazyLoadChildren();
            default:
                return Promise.resolve([]);
        }
    }

    public refresh() {
        this._onDidChangeTreeData.fire();
    }

    private getNodeRepository(node: EndevorNode): Repository | undefined {
        let repo: Repository | undefined = node.getRepository();
        if (node instanceof EndevorBrowsingNode) {
            repo = (<EndevorBrowsingNode>node).getRepository();
        }
        return repo;
    }

    private async addSingleSession(endevorProfile: IProfileLoaded) {
        if (this._sessionNodes.find(tempNode => tempNode.label.trim() === endevorProfile.name)) {
            return;
        }
        const session = await Profiles.getInstance().createBasicEndevorSession(endevorProfile.profile);
        const node = new ConnectionNode(session, endevorProfile.name);
        EndevorController.instance.addConnection(new Connection(endevorProfile));
        this._sessionNodes.push(node);

    }
}
