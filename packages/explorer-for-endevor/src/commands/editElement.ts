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
import { ElementNode, Node } from '../_doc/ElementTree';
import {
  filterElementNodes,
  isError,
  getEditFolderUri,
  isDefined,
} from '../utils';
import * as vscode from 'vscode';
import {
  createDirectory,
  getWorkspaceUri,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { retrieveElementWithFingerprint } from '../endevor';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import {
  getMaxParallelRequests,
  getTempEditFolder,
} from '../settings/settings';
import { showSavedElementContent } from '../workspace';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../constants';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { PromisePool } from 'promise-pool-tool';
import { toSeveralTasksProgress } from '@local/endevor/utils';
import { toEditedElementUri } from '../uri/editedElementUri';
import { fromVirtualDocUri } from '../uri';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const editElementCommand = async (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Edit command was called for ${elementNodes
        .map((node) => node.name)
        .join(',')}`
    );
    await editMultipleElements(elementNodes);
  } else if (elementNode) {
    logger.trace(`Edit command was called for ${elementNode.name}`);
    await editSingleElement(elementNode);
  }
};

const editSingleElement = async (
  element: Readonly<{
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
  const uploadableElementUri = withUploadOptions(
    retrieveResult.savedElementUri
  )({
    ...elementUri,
    fingerprint: retrieveResult.fingerprint,
  });
  if (!uploadableElementUri) return;
  const showResult = await showElementToEdit(uploadableElementUri);
  if (isError(showResult)) {
    const error = showResult;
    logger.error(error.message);
    return;
  }
};

const editMultipleElements = async (
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
  )((progressReporter) => {
    return new PromisePool(
      elements.map((element) => {
        const elementUploadOptions = fromVirtualDocUri(element.uri);
        return async () => {
          if (isError(elementUploadOptions)) return elementUploadOptions;
          const retrieveResult = await retrieveIntoWorkspace(
            toSeveralTasksProgress(progressReporter)(elementsNumber)
          )(workspaceUri)(elementUploadOptions);
          if (isError(retrieveResult)) return retrieveResult;
          return withUploadOptions(retrieveResult.savedElementUri)({
            ...elementUploadOptions,
            fingerprint: retrieveResult.fingerprint,
          });
        };
      }),
      {
        concurrency: endevorMaxRequestsNumber,
      }
    ).start();
  });
  const showedElements = retrievedElements.map((result) => {
    if (!isError(result) && result) {
      const savedElementUri = result;
      return showElementToEdit(savedElementUri);
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
      `There were some issues during editing elements: ${elements
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

const retrieveInto = (progress: ProgressReporter) => (
  consumer: ElementConsumer
) => async ({
  service,
  element,
}: RetrieveOptions): Promise<SaveIntoFolderResult | Error> => {
  const retrievedElement = await retrieveElementWithFingerprint(progress)(
    service
  )(element);
  if (!retrievedElement) {
    return new Error(
      `Element ${element.name} was not retrieved successfully from Endevor`
    );
  } else {
    const consumerResult = await consumer(element, retrievedElement.content);
    return isError(consumerResult)
      ? consumerResult
      : {
          savedElementUri: consumerResult,
          fingerprint: retrievedElement.fingerprint,
        };
  }
};

const retrieveIntoWorkspace = (progressReporter: ProgressReporter) => (
  workspaceUri: vscode.Uri
) => async (
  retrieveOptions: RetrieveOptions
): Promise<SaveIntoFolderResult | Error> => {
  return await retrieveInto(progressReporter)(saveIntoEditFolder(workspaceUri))(
    retrieveOptions
  );
};

type SaveIntoFolderResult = Readonly<{
  savedElementUri: vscode.Uri;
  fingerprint: string;
}>;

const saveIntoEditFolder = (workspaceUri: vscode.Uri) => async (
  element: {
    type: string;
    name: string;
    extension?: string;
  },
  elementContent: string
): Promise<vscode.Uri | Error> => {
  let editFolder: string;
  try {
    editFolder = getTempEditFolder();
  } catch (error) {
    logger.trace(`Error when reading settings: ${error}`);
    return new Error('Unable to get edit path from settings');
  }
  const editFolderUri = getEditFolderUri(workspaceUri)(editFolder);
  let saveLocationUri;
  try {
    saveLocationUri = await createDirectory(editFolderUri);
  } catch (e) {
    logger.trace(`Error while creating a temp directory: ${e.message}`);
    return new Error(
      `Unable to create required temp directory: ${editFolderUri.fsPath} for editing elements`
    );
  }
  const saveResult = await saveFileIntoWorkspaceFolder(saveLocationUri)(
    {
      fileName: element.name,
      fileExtension: element.extension,
    },
    elementContent
  );
  if (isError(saveResult)) {
    const error = saveResult;
    logger.trace(`Element: ${element.name} persisting error: ${error}`);
    const userMessage = `Element: ${element.name} was not saved into file system`;
    return new Error(userMessage);
  }
  return saveResult;
};

const showElementToEdit = async (
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

// TODO: needs to be refactored, we ruin our URI abstraction here,
// because now, we know, where the location and etc stored
const withUploadOptions = (fileUri: vscode.Uri) => (uploadOptions: {
  service: Service;
  element: Element;
  endevorSearchLocation: ElementSearchLocation;
  fingerprint: string;
}): vscode.Uri | undefined => {
  const elementUri = toEditedElementUri(fileUri.fsPath)({
    service: uploadOptions.service,
    element: uploadOptions.element,
    searchLocation: uploadOptions.endevorSearchLocation,
    fingerprint: uploadOptions.fingerprint,
  });
  if (!isError(elementUri)) {
    return fileUri.with({
      query: elementUri.query,
    });
  } else {
    logger.error(
      `Element ${uploadOptions.element.name} cannot be opened for editing. See log for more details.`,
      `Opening element ${uploadOptions.element.name} failed with error: ${elementUri.message}`
    );
    return;
  }
};
