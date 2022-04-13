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

import { ElementNode, Node } from './_doc/ElementTree';
import * as path from 'path';
import * as vscode from 'vscode';
import { TimeoutError } from './_doc/Error';
import {
  Element,
  ElementSearchLocation,
  IntermediateEnvironmentStage,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { DIFF_EDITOR_WHEN_CONTEXT_NAME } from './constants';
import { EnvironmentStage } from '../../endevor/_doc/Endevor';

const isElementNode = (node: Node): node is ElementNode => {
  switch (node.type) {
    case 'ELEMENT_IN_PLACE':
    case 'ELEMENT_UP_THE_MAP':
      return true;
    default:
      return false;
  }
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

export const isTuple = <T>(value: Array<T> | unknown): value is Array<T> => {
  return value instanceof Array;
};

export const isNotLastEnvStage = (
  value: EnvironmentStage
): value is IntermediateEnvironmentStage => {
  return (
    Object.keys(value).find((key) => key === 'nextEnvironment') !== undefined
  );
};

export const isUnique = <T>(
  value: T,
  index: number,
  self: ReadonlyArray<T>
): boolean => self.indexOf(value) == index;

// TODO: copy extra fields (if any) depending on error type
export const deepCopyError = (error: Error): Error => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const copyError = new (<typeof Error>error.constructor)(error.message);
  if (error.name) {
    copyError.name = error.name;
  }
  if (error.stack) {
    copyError.stack = error.stack;
  }
  return copyError;
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
  <T>(initialSource: ReadonlyArray<T>) =>
  (
    isReplacement: (t1: T, t2: T) => boolean,
    replacement: T
  ): ReadonlyArray<T> => {
    const accumulator: ReadonlyArray<T> = [];
    return initialSource.reduce((acc, existingItem) => {
      if (isReplacement(existingItem, replacement)) {
        return [...acc, replacement];
      }
      return [...acc, existingItem];
    }, accumulator);
  };

type GroupedElementNodes = Readonly<{
  [searchLocationId: string]: ReadonlyArray<ElementNode>;
}>;

export const groupBySearchLocationId = (
  elementNodes: ReadonlyArray<ElementNode>
): GroupedElementNodes => {
  const accumulator: GroupedElementNodes = {};
  return elementNodes.reduce(
    (acc, currentNode) => ({
      ...acc,
      [currentNode.searchLocationId]: [
        ...(acc[currentNode.searchLocationId] || []),
        currentNode,
      ],
    }),
    accumulator
  );
};

export const isElementUpTheMap =
  (elementsSearchLocation: ElementSearchLocation) => (element: Element) => {
    return (
      element.environment !== elementsSearchLocation.environment ||
      element.stageNumber !== elementsSearchLocation.stageNumber
    );
  };

export const isTheSameLocation =
  (firstLocation: SubSystemMapPath) =>
  (secondLocation: SubSystemMapPath): boolean => {
    return (
      firstLocation.environment === secondLocation.environment &&
      firstLocation.stageNumber === secondLocation.stageNumber &&
      firstLocation.subSystem === secondLocation.subSystem &&
      firstLocation.system === secondLocation.system
    );
  };
