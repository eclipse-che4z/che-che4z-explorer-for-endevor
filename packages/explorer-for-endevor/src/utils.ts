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

import { ElementNode } from './tree/_doc/ElementTree';
import { Node } from './tree/_doc/ServiceLocationTree';
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
import { Id } from './store/storage/_doc/Storage';

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
  return nodes
    .map((node) => {
      if (isElementNode(node)) return node;
      return;
    })
    .filter(isDefined);
};

export const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const isEmpty = (value: string): boolean => {
  return value.trim().length === 0;
};

export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};

export const isTuple = <T>(value: Array<T> | unknown): value is Array<T> => {
  return value instanceof Array;
};

export const isString = (value: string | unknown): value is string => {
  return typeof value === 'string';
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

export const joinUri =
  (baseUri: vscode.Uri) =>
  (extraPath: string): vscode.Uri => {
    return vscode.Uri.file(path.join(baseUri.fsPath, extraPath));
  };

export const getEditFolderUri =
  (tempEditFolderUri: vscode.Uri) =>
  (serviceId: Id, searchLocationId: Id) =>
  (element: Element): vscode.Uri => {
    return joinUri(tempEditFolderUri)(
      path.join(
        serviceId.name,
        serviceId.source,
        searchLocationId.name,
        searchLocationId.source,
        element.system,
        element.subSystem,
        element.type
      )
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
  fullFileName: string;
} => {
  const parsedPath = path.parse(filePath);
  return {
    fileName: parsedPath.name,
    path: parsedPath.dir,
    fileExtension: parsedPath.ext || undefined,
    fullFileName: parsedPath.base,
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

export const byTypeAndNameOrder = (
  l: { name: string; type: string },
  r: { name: string; type: string }
): number => {
  return l.type.localeCompare(r.type) === -1
    ? l.type.localeCompare(r.type)
    : l.name.localeCompare(r.name);
};

export const getElementExtension = (element: {
  type: string;
  extension?: string;
}): string => (element.extension ? element.extension : element.type);
