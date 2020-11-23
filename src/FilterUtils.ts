/*
 * Copyright (c) 2020 Broadcom.
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
import { IElement } from './interface/IElement';
import { IRepository } from './interface/IRepository';
import { EndevorFilterPathNode, EmptyNode } from './ui/tree/EndevorNodes';

/**
 * Validates a string based on the filter string conventions.
 * @param host
 * @param value
 * @return If the string passes the validation undefined is returned. If it fails an appropriate message is returned.
 */
export function filterStringValidator(
  repo: IRepository,
  value: string
): string | undefined {
  const count = (value.match(/\//g) || []).length;
  const splitString = value.split('/');
  let invalidInputMessage;
  switch (count) {
    case 0:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      return 'Valid Enviroment, type "/" to move to Stage Number';
    case 1:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      return 'Valid Stage Number, type "/" to move to System';
    case 2:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      return 'Valid System, type "/" to move to SubSystem';
    case 3:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      return 'Valid SubSystem, type "/" to move to Type';
    case 4:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      return 'Valid Type, type "/" to move to Element';
    case 5:
      invalidInputMessage = checkForInvalidInput(splitString);
      if (invalidInputMessage) {
        return invalidInputMessage;
      }
      if (duplicateFilterString(repo, value)) {
        return 'This filter string already exists for host: ' + repo.getName();
      }
      return undefined;
    default:
      return 'There are no more arguments';
  }
}
/**
 * Validates an entire filter string in the form of a string array and returns an appropriate message.
 * @param arrayString
 */
function checkForInvalidInput(arrayString: string[]): string | undefined {
  for (let i = 0; i < arrayString.length; i++) {
    if (validateLocation(arrayString[i], i) === false) {
      switch (i) {
        case 0:
          return 'Invalid Environment';
        case 1:
          return 'Invalid Stage Number';
        case 2:
          return 'Invalid System';
        case 3:
          return 'Invalid SubSystem';
        case 4:
          return 'Invalid Type';
        case 5:
          return 'Invalid Element';
      }
    }
  }
}

/**
 * Validates the filter location entered by the user.
 * The index i passed as an argument, to distiguinsh between stgnum, element name and all other cases.
 * @param location
 * @param index
 */
function validateLocation(location: string, index: number): boolean {
  // for element name '^([_-.@ $#*A-Za-z0-9]{1,255}|[*]{1})$'
  if (index === 1) {
    const stageNumberRegex = new RegExp('^([1-2]{1}|[*]{1})$');
    const valid = stageNumberRegex.test(location);
    return valid;
  }
  if (index === 5) {
    const elementRegex = new RegExp('^([_\\-.@ $#*A-Za-z0-9]{1,255}|[*]{1})$');
    const valid = elementRegex.test(location);
    return valid;
  }
  const locationRegex = new RegExp('^([@$#*A-Za-z0-9]{1,8})$');
  const valid = locationRegex.test(location);
  return valid;
}

/**
 * Loops through all the filter of the provided host to check for duplicate filter.
 * @param repo
 * @param value
 * @return True or False based on whether a duplicate filter is found.
 */
function duplicateFilterString(repo: IRepository, value: string): boolean {
  if (repo.filters) {
    for (let i = 0; i < repo.filters.length; i++) {
      if (repo.filters[i].getUri() === value) {
        return true;
      }
    }
  }
  return false;
}

export function createPathNodes(
  elements: IElement[],
  repo: IRepository
): EndevorFilterPathNode[] {
  const pathNodes: EndevorFilterPathNode[] = [];
  const pathNames: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const tempPath =
      elements[i].envName +
      '/' +
      elements[i].stgNum +
      '/' +
      elements[i].sysName +
      '/' +
      elements[i].sbsName +
      '/' +
      elements[i].typeName;
    if (!pathNames.includes(tempPath)) {
      pathNames.push(tempPath);
    }
  }
  for (let i = 0; i < pathNames.length; i++) {
    const elements: IElement[] = [];
    pathNodes.push(new EndevorFilterPathNode(pathNames[i], repo, elements));
  }
  for (let i = 0; i < pathNames.length; i++) {
    for (let j = 0; j < elements.length; j++) {
      const tempPath =
        elements[j].envName +
        '/' +
        elements[j].stgNum +
        '/' +
        elements[j].sysName +
        '/' +
        elements[j].sbsName +
        '/' +
        elements[j].typeName;
      if (pathNames[i] === tempPath) {
        pathNodes[i].getElements().push(elements[j]);
      }
    }
  }
  return pathNodes;
}

export function createEmptyNode(
  repo: IRepository,
  label: string,
  message: string
): EmptyNode {
  const pathName = label;
  const pathNode = new EmptyNode(pathName, repo, message);
  pathNode.collapsibleState = vscode.TreeItemCollapsibleState.None;
  return pathNode;
}
