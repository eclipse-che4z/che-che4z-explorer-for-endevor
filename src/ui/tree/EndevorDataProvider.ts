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
import { EndevorNode, EndevorBrowsingNode, FilterNode, EndevorFilterPathNode, NewRepositoryNode } from './EndevorNodes';
import { EnvironmentNode, StageNode, SystemNode, SubsystemNode, TypeNode } from './EndevorNodes';
import { EndevorController } from '../../EndevorController';
import { Repository } from '../../model/Repository';

export class EndevorDataProvider implements vscode.TreeDataProvider<EndevorNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor() { }

    getTreeItem(element: EndevorNode): vscode.TreeItem {
        return element;
    }

    getChildren(node?: EndevorNode): Promise<EndevorNode[]> {
        if (!node) {
            const root: EndevorNode = EndevorController.instance.rootNode;
            if (!root.needReload) {
                return Promise.resolve([new NewRepositoryNode(), ...root.children]);
            }
            let repos: Repository[] = EndevorController.instance.getRepositories();
            let newChildren: EndevorNode[] = [];
            repos.forEach(repo => {
                let newRepoNode: EndevorNode = new EndevorNode(repo);
                let foundNode: EndevorNode | undefined = EndevorController.instance.findNodeByRepoID(repo.id);
                if (foundNode && !foundNode.needReload) {
                    newRepoNode.children = foundNode.children;
                    newRepoNode.needReload = false;
                    newRepoNode.collapsibleState = foundNode.collapsibleState;
                }
                newChildren.push(newRepoNode);
            });
            root.needReload = false;
            root.children = newChildren;
            return Promise.resolve([new NewRepositoryNode(), ...newChildren]);
        }
        switch (node.contextValue) {
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
}
