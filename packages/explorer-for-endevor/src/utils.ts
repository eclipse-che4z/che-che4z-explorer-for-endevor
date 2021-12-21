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
import * as vscode from 'vscode';
import { TimeoutError } from './_doc/Error';
import { Element } from '@local/endevor/_doc/Endevor';
import { DIFF_EDITOR_WHEN_CONTEXT_NAME } from './constants';

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
  (workspaceUri: vscode.Uri) =>
  (editFolderWorkspacePath: string) =>
  (serviceName: string, locationName: string) =>
  (element: Element): vscode.Uri => {
    return vscode.Uri.file(
      path.join(
        workspaceUri.fsPath,
        editFolderWorkspacePath,
        serviceName,
        locationName,
        element.system,
        element.subSystem,
        element.type
      )
    );
  };

export const getEditRootFolderUri =
  (workspaceUri: vscode.Uri) =>
  (editFolderWorkspacePath: string): vscode.Uri => {
    return vscode.Uri.file(
      path.join(workspaceUri.fsPath, editFolderWorkspacePath)
    );
  };

export const updateEditFoldersWhenContext = (() => {
  // use internal closure to store the edit folders between multiple calls
  const editFolders: string[] = [];
  // provide the function to append a new edit folder path to internal list
  return (newEditFolder: string): void => {
    // update the list and the context only if there is no such value yet
    if (editFolders.includes(newEditFolder)) return;
    editFolders.push(newEditFolder);
    vscode.commands.executeCommand(
      'setContext',
      DIFF_EDITOR_WHEN_CONTEXT_NAME,
      editFolders
    );
  };
})();

export const parseFilePath = (
  filePath: string
): {
  path: string;
  fileName: string;
  fileExtension?: string;
} => {
  const parsedPath = path.parse(filePath);
  return {
    fileName: parsedPath.name,
    path: parsedPath.dir,
    fileExtension: parsedPath.ext || undefined,
  };
};

export const isTimeoutError = <T>(
  value: T | TimeoutError
): value is TimeoutError => {
  return value instanceof TimeoutError;
};

export const toPromiseWithTimeout =
  (timeout: number) =>
  async <T>(inputPromise: Promise<T>): Promise<T | TimeoutError> => {
    return Promise.race([
      inputPromise,
      new Promise<TimeoutError>((resolve) =>
        setTimeout(() => resolve(new TimeoutError()), timeout)
      ),
    ]);
  };

export const replaceWith =
  <T>(initialSouce: ReadonlyArray<T>) =>
  (
    isReplacement: (t1: T, t2: T) => boolean,
    replacement: T
  ): ReadonlyArray<T> => {
    const accumulator: ReadonlyArray<T> = [];
    return initialSouce.reduce((accum, existingItem) => {
      if (isReplacement(existingItem, replacement)) {
        return [...accum, replacement];
      }
      return [...accum, existingItem];
    }, accumulator);
  };

type GroupedElementNodes = Readonly<{
  [searchLocationId: string]: ReadonlyArray<ElementNode>;
}>;

export const groupBySearchLocationId = (
  elementNodes: ReadonlyArray<ElementNode>
): GroupedElementNodes => {
  const accumulator: GroupedElementNodes = {};
  return elementNodes.reduce((accum, currentNode) => {
    const exisitingGroup = accum[currentNode.searchLocationId];
    if (!exisitingGroup) {
      return {
        ...accum,
        searchLocationId: [currentNode],
      };
    }
    return {
      ...accum,
      searchLocationId: [...exisitingGroup, currentNode],
    };
  }, accumulator);
};
