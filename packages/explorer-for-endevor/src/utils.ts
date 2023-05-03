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

import { ElementNode } from './tree/_doc/ElementTree';
import { Node } from './tree/_doc/ServiceLocationTree';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  Element,
  IntermediateEnvironmentStage,
  ServiceLocation,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { DIFF_EDITOR_WHEN_CONTEXT_NAME } from './constants';
import { EnvironmentStage } from '../../endevor/_doc/Endevor';
import { Id } from './store/storage/_doc/Storage';
import { setContextVariable } from '@local/vscode-wrapper/window';
import { ElementSearchLocation } from './_doc/Endevor';
import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import { ANY_VALUE } from '@local/endevor/const';

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

export const isPromise = <T>(
  value: Promise<T> | unknown
): value is Promise<T> => {
  return value instanceof Promise;
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
    setContextVariable(DIFF_EDITOR_WHEN_CONTEXT_NAME, editFolders);
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

export const replaceWith =
  <T>(initialSource: ReadonlyArray<T>) =>
  (
    isReplacement: (t1: T, t2: T) => boolean,
    replacement: T
  ): ReadonlyArray<T> => {
    return initialSource.reduce((acc: Array<T>, existingItem) => {
      acc.push(
        isReplacement(existingItem, replacement) ? replacement : existingItem
      );
      return acc;
    }, []);
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

export const byNameOrder = (
  l: { name: string },
  r: { name: string }
): number => {
  return l.name.localeCompare(r.name);
};

export const getElementExtension = (element: {
  type: string;
  extension?: string;
}): string => (element.extension ? element.extension : element.type);

export const formatWithNewLines = (lines: ReadonlyArray<string>): string =>
  ['', ...lines].join('\n');

export const toServiceUrl = (
  service: ServiceLocation,
  credential?: Credential
): string => {
  let basePath = service.basePath;
  if (basePath.startsWith('/')) basePath = basePath.slice(1);
  if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
  let user;
  if (credential) {
    switch (credential.type) {
      case CredentialType.BASE:
        user = credential.user;
        break;
    }
  }
  return `${service.protocol}://${user ? user + '@' : ''}${service.hostname}:${
    service.port
  }/${basePath}`;
};

export const toSearchLocationPath = (
  elementSearchLocation: ElementSearchLocation
): string => {
  const configuration = elementSearchLocation.configuration;
  const env = elementSearchLocation.environment;
  const stage = elementSearchLocation.stageNumber;
  const sys = elementSearchLocation.system;
  const subsys = elementSearchLocation.subsystem;
  const type = elementSearchLocation.type;
  return [
    configuration,
    env ? env : ANY_VALUE,
    stage ?? ANY_VALUE,
    sys ? sys : ANY_VALUE,
    subsys ? subsys : ANY_VALUE,
    type ? type : ANY_VALUE,
  ].join('/');
};

export const moveItemInFrontOfArray = <T>(array: T[], item?: T): Array<T> => {
  if (!item) {
    return array;
  }
  const foundIndex = array.findIndex((element) => element === item);
  array.splice(foundIndex, 1);
  array.unshift(item);
  return array;
};
