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

import { toSeveralTasksProgress } from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import { PromisePool } from 'promise-pool-tool';
import * as vscode from 'vscode';
import { MAX_PARALLEL_REQUESTS_DEFAULT } from '../../constants';
import { retrieveElementWithFingerprint } from '../../endevor';
import { logger } from '../../globals';
import { getMaxParallelRequests } from '../../settings/settings';
import { fromTreeElementUri } from '../../uri/treeElementUri';
import { isDefined, isError } from '../../utils';
import {
  saveIntoEditFolder,
  withUploadOptions,
  showElementToEdit,
} from './common';

export const editSingleElement = async (
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
  const elementUri = fromTreeElementUri(element.uri);
  if (isError(elementUri)) {
    const error = elementUri;
    logger.error(
      `Unable to edit element ${element.name}`,
      `Unable to edit element ${element.name}, because of ${error.message}`
    );
    return;
  }
  const retrieveResult = await withNotificationProgress(
    `Retrieving element: ${element.name}`
  )(async (progressReporter) => {
    return retrieveElementWithFingerprint(progressReporter)(elementUri.service)(
      elementUri.element
    )();
  });
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(error.message);
    return;
  }
  const saveResult = await saveIntoEditFolder(workspaceUri)(
    elementUri.serviceName,
    elementUri.searchLocationName
  )(elementUri.element, retrieveResult.content);
  if (isError(saveResult)) {
    const error = saveResult;
    logger.error(error.message);
    return;
  }
  const uploadableElementUri = withUploadOptions(saveResult)({
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

// TODO: think about pipe implementation or something like this
export const editMultipleElements = async (
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
  const elementUris = elements.map((element) => {
    const elementsUploadOptions = fromTreeElementUri(element.uri);
    if (isError(elementsUploadOptions)) {
      const error = elementsUploadOptions;
      logger.trace(
        `Unable to edit element ${element.name}, because of ${error.message}`
      );
      return new Error(`Unable to edit element ${element.name}`);
    }
    return elementsUploadOptions;
  });
  const elementsNumber = elements.length;
  const retrievedContents = await withNotificationProgress(
    `Retrieving elements: ${elements.map((element) => element.name).join(', ')}`
  )((progressReporter) => {
    return new PromisePool(
      elementUris.map((element) => {
        if (isError(element)) {
          const error = element;
          return () => Promise.resolve(error);
        }
        return async () =>
          retrieveElementWithFingerprint(
            toSeveralTasksProgress(progressReporter)(elementsNumber)
          )(element.service)(element.element)();
      }),
      {
        concurrency: endevorMaxRequestsNumber,
      }
    ).start();
  });
  const retrieveResults = elementUris.map((elementUri, index) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const retrievedContent = retrievedContents[index]!;
    if (isError(elementUri)) {
      const error = elementUri;
      return error;
    }
    if (isError(retrievedContent)) {
      const error = retrievedContent;
      return error;
    }
    return {
      element: elementUri,
      content: retrievedContent,
    };
  });
  const saveResults = await Promise.all(
    retrieveResults.map(async (result) => {
      if (isError(result)) {
        const error = result;
        return error;
      }
      const saveResult = await saveIntoEditFolder(workspaceUri)(
        result.element.serviceName,
        result.element.searchLocationName
      )(result.element.element, result.content.content);
      if (isError(saveResult)) {
        const error = saveResult;
        return error;
      }
      return withUploadOptions(saveResult)({
        ...result.element,
        fingerprint: result.content.fingerprint,
        serviceName: result.element.serviceName,
        searchLocationName: result.element.searchLocationName,
      });
    })
  );
  const showResults = await Promise.all(
    saveResults.map((saveResult) => {
      if (!isError(saveResult) && saveResult) {
        const savedElementUri = saveResult;
        return showElementToEdit(savedElementUri);
      }
      const error = saveResult;
      return error;
    })
  );
  const overallErrors = showResults
    .map((value) => {
      if (isError(value)) return value;
      return undefined;
    })
    .filter(isDefined);
  if (overallErrors.length) {
    logger.error(
      `There were some issues during editing elements: ${elements
        .map((element) => element.name)
        .join(', ')}: ${JSON.stringify(
        overallErrors.map((error) => error.message)
      )}`
    );
  }
};
