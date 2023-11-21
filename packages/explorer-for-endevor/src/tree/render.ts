/*
 * © 2023 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import { toBasicElementUri } from '../uri/basicElementUri';
import { isError } from '../utils';
import { ElementNode, TypeNode } from './_doc/ElementTree';
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

class TypeItem extends vscode.TreeItem {
  constructor(node: TypeNode) {
    super(
      node.name,
      !node.elements.length && !node.map?.elements.length
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.contextValue = node.type;
  }
}

class ServiceLocationItem extends vscode.TreeItem {
  constructor(
    name: string,
    source: Source,
    type: string,
    duplicated: boolean,
    collapsable: boolean,
    tooltip?: vscode.MarkdownString | string
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

class ValidServiceLocationItem extends ServiceLocationItem {
  constructor(
    name: string,
    source: Source,
    type: string,
    duplicate: boolean,
    showEmptyTypes: boolean,
    collapsable: boolean,
    tooltip?: vscode.MarkdownString | string
  ) {
    super(name, source, type, duplicate, collapsable, tooltip);
    this.contextValue = `${type}${
      showEmptyTypes ? '/WITH_EMPTY_TYPES' : ''
    }/VALID`;
  }
}

class InvalidServiceLocationItem extends ServiceLocationItem {
  constructor(
    name: string,
    source: Source,
    type: string,
    duplicate: boolean,
    collapsable: boolean,
    tooltip?: vscode.MarkdownString | string,
    command?: vscode.Command
  ) {
    super(name, source, type, duplicate, collapsable, tooltip);
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
    const elementUri = toBasicElementUri(node)(node.timestamp);
    if (!isError(elementUri)) {
      this.resourceUri = elementUri;
    }
    this.contextValue = node.type;
    this.tooltip = node.tooltip;
    this.description = node.noSource ? 'no-source' : undefined;
    this.iconPath = node.outOfDate
      ? new vscode.ThemeIcon(
          'history',
          new vscode.ThemeColor('list.warningForeground')
        )
      : undefined;
    this.command = {
      title: 'Print Element',
      command: CommandId.PRINT_ELEMENT,
      tooltip: 'Print Element',
      arguments: [node],
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
    case 'SERVICE_PROFILE':
      return new ServiceLocationItem(
        node.name,
        node.source,
        node.type,
        node.duplicated,
        true,
        node.tooltip
      );
    case 'LOCATION':
    case 'LOCATION/WITH_MAP':
    case 'LOCATION_PROFILE':
    case 'LOCATION_PROFILE/WITH_MAP':
      return new ValidServiceLocationItem(
        node.name,
        node.source,
        node.type,
        node.duplicated,
        !!node.withEmptyTypes,
        true,
        node.tooltip
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
        node.duplicated,
        node.children.length > 0,
        node.tooltip
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
        node.duplicated,
        false,
        node.tooltip,
        node.command
      );
    case 'MAP':
    case 'SYS':
    case 'SUB':
      return new BasicItem(node.name, node.type);
    case 'TYPE':
      return new TypeItem(node);
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
