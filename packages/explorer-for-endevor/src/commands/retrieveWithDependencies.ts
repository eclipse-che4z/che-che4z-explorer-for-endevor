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

import { logger } from '../globals';
import { filterElementNodes, isDefined, isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import * as vscode from 'vscode';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  saveElementIntoWorkspace,
  showSavedElementContent,
} from '../workspace';
import { Element, ServiceInstance } from '@local/endevor/_doc/Endevor';
import { retrieveElementWithDependencies } from '../endevor';
import { fromVirtualDocUri } from '../uri';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { PromisePool } from 'promise-pool-tool';
import { toSeveralTasksProgress } from '@local/endevor/utils';
import { getMaxParallelRequests } from '../settings/settings';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../constants';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveWithDependencies = async (
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
  const elementUri = fromVirtualDocUri(element.uri);
  const retrieveResult = await withNotificationProgress(
    `Retrieving element: ${element.name} with dependencies`
  )((progressReporter) =>
    retrieveIntoWorkspace(progressReporter)(workspaceUri)({
      serviceInstance: {
        service: elementUri.service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      },
      element: elementUri.element,
    })
  );
  if (retrieveResult) {
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
  const sequentialRetrieving = 1;
  const retrievedElements = await withNotificationProgress(
    `Retrieving elements: ${elements
      .map((element) => element.name)
      .join(', ')} with dependencies`
  )((progressReporter) => {
    return new PromisePool(
      elements
        .map((element) => fromVirtualDocUri(element.uri))
        .map((elementUri) => {
          return () =>
            retrieveIntoWorkspace(
              toSeveralTasksProgress(progressReporter)(elementsNumber)
            )(workspaceUri)({
              serviceInstance: {
                service: elementUri.service,
                requestPoolMaxSize: endevorMaxRequestsNumber,
              },
              element: elementUri.element,
            });
        }),
      {
        concurrency: sequentialRetrieving,
      }
    ).start();
  });
  const showedElements = retrievedElements.map((result) => {
    if (!isError(result)) {
      const savedElementUri = result;
      return showElementInEditor(savedElementUri);
    }
    return result;
  });
  const errors = showedElements
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
  serviceInstance: ServiceInstance;
  element: Element;
}>;

const retrieveInto =
  (progressReporter: ProgressReporter) =>
  (consumer: ElementConsumer) =>
  async ({
    serviceInstance,
    element,
  }: RetrieveOptions): Promise<vscode.Uri | Error> => {
    const elementWithDeps = await retrieveElementWithDependencies(
      progressReporter
    )(serviceInstance)(element);
    if (!elementWithDeps) {
      return new Error(
        `Element ${element.name} was not retrieved successfully from Endevor`
      );
    }
    const consumerResult = await consumer(element, elementWithDeps.content);
    if (isError(consumerResult)) {
      const error = consumerResult;
      return error;
    }
    type NotValidElement = undefined;
    const dependenciesConsumerResult = await Promise.all(
      elementWithDeps.dependencies.map((dependentElement) => {
        const [element, content] = dependentElement;
        if (content) {
          return consumer(element, content);
        }
        const result: NotValidElement = undefined;
        return result;
      })
    );
    const errors = dependenciesConsumerResult
      .map((value) => {
        if (isError(value)) return value;
        return undefined;
      })
      .filter(isDefined);
    if (errors.length) {
      logger.error(
        `There were some issues during retrieving element dependencies: ${elementWithDeps.dependencies
          .map((element) => element[0].name)
          .join(', ')}: ${JSON.stringify(errors.map((error) => error.message))}`
      );
    }
    const savedMainElementUri = consumerResult;
    return savedMainElementUri;
  };

const retrieveIntoWorkspace =
  (progressReporter: ProgressReporter) =>
  (workspaceUri: vscode.Uri) =>
  async (retrieveOptions: RetrieveOptions): Promise<vscode.Uri | Error> => {
    return await retrieveInto(progressReporter)(
      saveIntoWorkspace(workspaceUri)
    )(retrieveOptions);
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
