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

import {
  EventEmitter,
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from 'vscode';
import { CommandId } from '../commands/id';
import {
  EndevorId,
  EndevorReport,
  ActivityRecords,
} from '../store/_doc/v2/Store';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { toActivityMessageTooltip } from './utils';
import { Element } from '@local/endevor/_doc/Endevor';

export type ReportNode = {
  type: 'report';
  name: string;
  id: string;
  objectName: string;
  parent: MessageNode;
  content?: string;
};

export type MessageNode = {
  type: 'message';
  time: number;
  actionName: string;
  searchLocationId?: EndevorId;
  serviceId?: EndevorId;
  element?: Element;
  messages?: ReadonlyArray<string>;
  returnCode?: number;
  reports?: ReadonlyArray<EndevorReport>;
  children?: Array<ReportNode>;
};

export const make =
  (getActivityRecords: () => ActivityRecords) =>
  (
    treeChangeEmitter: EventEmitter<ActivityNode | null>
  ): TreeDataProvider<ActivityNode> => {
    return {
      onDidChangeTreeData: treeChangeEmitter.event,
      getTreeItem(node: ActivityNode) {
        switch (node.type) {
          case 'message':
            return new MessageItem(node);
          case 'report':
            return new ReportItem(node);
          default:
            throw new UnreachableCaseError(node);
        }
      },
      async getChildren(node?: ActivityNode) {
        if (!node) {
          return getActivityRecords().map((entry) => {
            const logNode: MessageNode = {
              type: 'message',
              time: entry.time,
              actionName: entry.name,
              searchLocationId: entry.details?.searchLocationId,
              serviceId: entry.details?.serviceId,
              element: entry.details?.element,
              returnCode: entry.details?.returnCode,
              messages: entry.details?.messages,
            };
            logNode.children = entry.details?.reports?.map((report) => {
              return {
                type: 'report',
                name: report.name,
                id: report.id,
                objectName: report.objectName,
                content: report.content,
                parent: logNode,
              };
            });
            return logNode;
          });
        }
        if (node.type === 'message') {
          return node.children;
        }
        return;
      },
    };
  };

export type ActivityNode = ReportNode | MessageNode;

const toLocalTimestamp = (time: number): string => {
  const date = new Date(time);
  return `[${date.toLocaleDateString(undefined, {
    dateStyle: 'short',
  })} ${date.toLocaleTimeString(undefined, {
    hourCycle: 'h24',
    timeStyle: 'medium',
  })}]`;
};

class MessageItem extends TreeItem {
  constructor(node: MessageNode) {
    // TODO: this applies only to element actions, should be more universal
    const elementText = node.element ? ' ' + node.element.name : '';
    let message = `${node.actionName}${elementText} failed`;
    let icon = new ThemeIcon('error', new ThemeColor('testing.iconFailed'));
    let tooltip = node.messages?.length
      ? toActivityMessageTooltip(node.messages, 'Error')
      : undefined;
    if (node.returnCode !== undefined) {
      if (node.returnCode === 0) {
        message = `${node.actionName}${elementText} was successful`;
        icon = new ThemeIcon('check', new ThemeColor('testing.iconPassed'));
        tooltip = node.messages?.length
          ? toActivityMessageTooltip(node.messages, 'Informational')
          : undefined;
      } else if (node.returnCode <= 8) {
        message = `${node.actionName}${elementText} completed with warnings`;
        icon = new ThemeIcon('warning', new ThemeColor('testing.iconQueued'));
        tooltip = node.messages?.length
          ? toActivityMessageTooltip(node.messages, 'Warning')
          : undefined;
      }
    }
    super(
      toLocalTimestamp(node.time) + ' ⇒ ' + message,
      node.children?.length
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None
    );
    this.iconPath = icon;
    this.tooltip = tooltip;
    this.description = node.serviceId ? node.serviceId.name : undefined;
    if (this.description) {
      this.description += node.searchLocationId
        ? '/' + node.searchLocationId.name
        : '';
    }
  }
}

class ReportItem extends TreeItem {
  constructor(node: ReportNode) {
    super(node.name, TreeItemCollapsibleState.None);
    this.iconPath = new ThemeIcon('output');
    switch (node.name) {
      case 'C1MSGS1':
        this.description = 'Execution report';
        break;
      case 'APIMSGS':
        this.description = 'API report';
        break;
      default:
        break;
    }
    this.command = {
      title: 'Show Report',
      command: CommandId.SHOW_REPORT,
      tooltip: 'Show the Execution Report',
      arguments: [node],
    };
  }
}
