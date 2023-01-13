/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import * as vscode from 'vscode';
import { CommandId } from '../commands/id';
import { ZOWE_PROFILE_DESCRIPTION } from '../constants';
import { Source } from '../store/storage/_doc/Storage';
import { ElementNode } from './_doc/ElementTree';
import { FilteredNode, FilterNode, FilterValueNode } from './_doc/FilterTree';
import { AddNewSearchLocationNode, Node } from './_doc/ServiceLocationTree';

class ButtonItem extends vscode.TreeItem {
  constructor(node: AddNewSearchLocationNode) {
    super(node.label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = node.type;
    this.label = node.label;
    this.command = {
      command: node.command.command,
      title: node.command.title,
      arguments: node.command.argument ? [node.command.argument] : [],
    };
  }
}

class BasicItem extends vscode.TreeItem {
  constructor(name: string, type: string) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = type;
  }
}

class ServiceLocationItem extends vscode.TreeItem {
  constructor(
    name: string,
    source: Source,
    type: string,
    tooltip: string,
    duplicated: boolean,
    collapsable: boolean
  ) {
    super(
      name,
      collapsable
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = type;
    this.tooltip = tooltip;
    switch (source) {
      case Source.INTERNAL:
        break;
      case Source.SYNCHRONIZED:
        if (duplicated) this.description = ZOWE_PROFILE_DESCRIPTION;
        break;
      default:
        throw new UnreachableCaseError(source);
    }
  }
}

class InvalidServiceLocationItem extends ServiceLocationItem {
  constructor(
    name: string,
    source: Source,
    type: string,
    tooltip: string,
    duplicate: boolean,
    collapsable: boolean,
    command?: vscode.Command
  ) {
    super(name, source, type, tooltip, duplicate, collapsable);
    this.iconPath = new vscode.ThemeIcon('warning');
    this.command = command;
  }
}

class EmptyMapItem extends vscode.TreeItem {
  constructor() {
    super('No elements found.');
  }
}

class ElementItem extends vscode.TreeItem {
  constructor(node: ElementNode) {
    super(node.name, vscode.TreeItemCollapsibleState.None);
    this.resourceUri = node.uri;
    this.contextValue = node.type;
    this.tooltip = node.tooltip;
    this.command = {
      title: 'Print Element',
      command: CommandId.PRINT_ELEMENT,
      tooltip: 'Print Element',
      arguments: [this.resourceUri, node.name],
    };
  }
}

class FilterItem extends vscode.TreeItem {
  constructor(node: FilteredNode | FilterNode) {
    super(node.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = node.type;
    this.tooltip = node.tooltip;
    if (node.type === 'FILTERED')
      this.iconPath = new vscode.ThemeIcon('filter');
  }
}

class FilterValue extends vscode.TreeItem {
  constructor(node: FilterValueNode) {
    super(node.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = node.type;
  }
}

export const toTreeItem = (node: Node): vscode.TreeItem => {
  switch (node.type) {
    case 'BUTTON_ADD_SEARCH_LOCATION':
      return new ButtonItem(node);
    case 'SERVICE':
    case 'LOCATION':
    case 'LOCATION/WITH_MAP':
    case 'SERVICE_PROFILE':
    case 'LOCATION_PROFILE':
    case 'LOCATION_PROFILE/WITH_MAP':
      return new ServiceLocationItem(
        node.name,
        node.source,
        node.type,
        node.tooltip,
        node.duplicated,
        true
      );
    case 'SERVICE_PROFILE/NON_EXISTING':
    case 'SERVICE/NON_EXISTING':
    case 'SERVICE_PROFILE/INVALID_CONNECTION':
    case 'SERVICE/INVALID_CONNECTION':
    case 'SERVICE_PROFILE/INVALID_CREDENTIALS':
    case 'SERVICE/INVALID_CREDENTIALS':
      return new InvalidServiceLocationItem(
        node.name,
        node.source,
        node.type,
        node.tooltip,
        node.duplicated,
        node.children.length > 0
      );
    case 'LOCATION_PROFILE/NON_EXISTING':
    case 'LOCATION/NON_EXISTING':
    case 'LOCATION_PROFILE/INVALID_CONNECTION':
    case 'LOCATION/INVALID_CONNECTION':
    case 'LOCATION_PROFILE/INVALID_CREDENTIALS':
    case 'LOCATION/INVALID_CREDENTIALS':
      return new InvalidServiceLocationItem(
        node.name,
        node.source,
        node.type,
        node.tooltip,
        node.duplicated,
        false,
        node.command
      );
    case 'MAP':
    case 'SYS':
    case 'SUB':
    case 'TYPE':
      return new BasicItem(node.name, node.type);
    case 'EMPTY_MAP_NODE':
      return new EmptyMapItem();
    case 'FILTERED':
    case 'FILTER':
      return new FilterItem(node);
    case 'FILTER_VALUE':
      return new FilterValue(node);
    case 'ELEMENT_UP_THE_MAP':
    case 'ELEMENT_IN_PLACE':
      return new ElementItem(node);
    default:
      throw new UnreachableCaseError(node);
  }
};
