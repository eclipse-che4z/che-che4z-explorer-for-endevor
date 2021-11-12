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

import { retrieveElement } from '../endevor';
import { logger } from '../globals';
import { filterElementNodes, isDefined, isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import * as vscode from 'vscode';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  saveElementIntoWorkspace,
  showSavedElementContent,
} from '../workspace';
import { Element, Service } from '@local/endevor/_doc/Endevor';
import { fromVirtualDocUri } from '../uri';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { PromisePool } from 'promise-pool-tool';
import { getMaxParallelRequests } from '../settings/settings';
import { toSeveralTasksProgress } from '@local/endevor/utils';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../constants';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveElementCommand = async (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Retrieve element command was called for ${elementNodes
        .map((node) => node.name)
        .join(',')}`
    );
    await retrieveMultipleElements(elementNodes);
  } else if (elementNode) {
    logger.trace(`Retrieve element command was called for ${elementNode.name}`);
    await retrieveSingleElement(elementNode);
  }
};

const retrieveSingleElement = async (
  element: Readonly<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  const workspaceUri = await getWorkspaceUri();
  if (!workspaceUri) {
    logger.error(
      'At least one workspace in this project should be opened to retrieve elements'
    );
    return;
  }
  const elementUri = fromVirtualDocUri(element.uri);
  const retrieveResult = await withNotificationProgress(
    `Retrieving element: ${element.name}`
  )((progressReporter) =>
    retrieveIntoWorkspace(progressReporter)(workspaceUri)(elementUri)
  );
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(error.message);
    return;
  }
  const savedElementUri = retrieveResult;
  const showResult = await showElementInEditor(savedElementUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.error(error.message);
    return;
  }
};

const retrieveMultipleElements = async (
  elements: ReadonlyArray<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  const workspaceUri = await getWorkspaceUri();
  if (!workspaceUri) {
    logger.error(
      'At least one workspace in this project should be opened to edit elements'
    );
    return;
  }
  let endevorMaxRequestsNumber: number;
  try {
    endevorMaxRequestsNumber = getMaxParallelRequests();
  } catch (e) {
    logger.warn(
      `Cannot read settings value for endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead`,
      `Reading settings error: ${e.message}`
    );
    endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
  }
  const elementsNumber = elements.length;
  const retrievedElements = await withNotificationProgress(
    `Retrieving elements: ${elements.map((element) => element.name).join(', ')}`
  )((progress) => {
    return new PromisePool(
      elements
        .map((element) => fromVirtualDocUri(element.uri))
        .map((elementUri) => {
          return () =>
            retrieveIntoWorkspace(
              toSeveralTasksProgress(progress)(elementsNumber)
            )(workspaceUri)(elementUri);
        }),
      {
        concurrency: endevorMaxRequestsNumber,
      }
    ).start();
  });
  const operationResult = retrievedElements.map((result) => {
    if (!isError(result)) {
      const savedElementUri = result;
      return showElementInEditor(savedElementUri);
    }
    return result;
  });
  const errors = operationResult
    .map((value) => {
      if (isError(value)) return value;
      return undefined;
    })
    .filter(isDefined);
  if (errors.length) {
    logger.error(
      `There were some issues during retrieving elements: ${elements
        .map((element) => element.name)
        .join(', ')}: ${JSON.stringify(errors.map((error) => error.message))}`
    );
  }
};

type ElementConsumer = (
  element: {
    type: string;
    name: string;
    extension?: string;
  },
  elementContent: string
) => Promise<vscode.Uri | Error>;

type RetrieveOptions = Readonly<{
  service: Service;
  element: Element;
}>;

const retrieveInto =
  (progress: ProgressReporter) =>
  (consumer: ElementConsumer) =>
  async ({
    service,
    element,
  }: RetrieveOptions): Promise<vscode.Uri | Error> => {
    const elementContent = await retrieveElement(progress)(service)(element);
    if (!elementContent) {
      return new Error(
        `Element ${element.name} was not retrieved successfully from Endevor`
      );
    }
    return consumer(element, elementContent);
  };

const retrieveIntoWorkspace =
  (progress: ProgressReporter) =>
  (workspaceUri: vscode.Uri) =>
  async (retrieveOptions: RetrieveOptions): Promise<vscode.Uri | Error> => {
    return await retrieveInto(progress)(saveIntoWorkspace(workspaceUri))(
      retrieveOptions
    );
  };

const saveIntoWorkspace =
  (workspaceUri: vscode.Uri) =>
  async (
    element: {
      type: string;
      name: string;
      extension?: string;
    },
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    const saveResult = await saveElementIntoWorkspace(workspaceUri)(
      element,
      elementContent
    );
    if (isError(saveResult)) {
      const error = saveResult;
      logger.trace(`Element: ${element.name} persisting error: ${error}`);
      const userMessage = `Element: ${element.name} was not saved into file system`;
      return new Error(userMessage);
    }
    const savedFileUri = saveResult;
    return savedFileUri;
  };

const showElementInEditor = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  const showResult = await showSavedElementContent(fileUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.trace(
      `Element ${fileUri.fsPath} cannot be opened because of: ${error}.`
    );
    return new Error(`Element ${fileUri.fsPath} cannot be opened.`);
  }
};
