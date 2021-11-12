/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { ElementNode, Node } from './_doc/ElementTree';
import * as path from 'path';
import { Uri } from 'vscode';

const isElementNode = (node: Node): node is ElementNode => {
  return node.type === 'ELEMENT';
};

export const filterElementNodes = (nodes: Node[]): ElementNode[] => {
  return nodes.filter(isElementNode);
};

export const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};

export const getEditFolderUri =
  (workspaceUri: Uri) =>
  (editFolderWorkspacePath: string): Uri => {
    return Uri.file(path.join(workspaceUri.fsPath, editFolderWorkspacePath));
  };

export const splitIntoPathAndFileName = (
  filePath: string
): {
  path: string;
  fileName: string;
} => {
  const parsedPath = path.parse(filePath);
  return {
    fileName: parsedPath.name,
    path: parsedPath.dir,
  };
};
