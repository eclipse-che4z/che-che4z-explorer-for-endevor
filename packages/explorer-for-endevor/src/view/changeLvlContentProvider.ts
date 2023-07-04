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

import {
  Uri,
  CancellationToken,
  TextDocumentContentProvider,
  workspace,
} from 'vscode';
import { logger } from '../globals';
import {
  fromElementChangeUri,
  toElementHistoryUri,
} from '../uri/elementHistoryUri';
import { isError } from '../utils';
import {
  CachedElement,
  ElementHistoryData,
  EndevorId,
} from '../store/_doc/v2/Store';
import { Action, Actions } from '../store/_doc/Actions';
import { HISTORY_LINE_PATTERN, parseHistory } from '../tree/endevor';
import { HistoryLine } from '../tree/_doc/ChangesTree';
import { CURRENT_CHANGE_LEVEL } from '../constants';
import { Element } from '@local/endevor/_doc/Endevor';
import { Id } from '../store/storage/_doc/Storage';

export const changeLvlContentProvider = (
  dispatch: (action: Action) => Promise<void>,
  getElement: (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => (element: Element) => CachedElement | undefined
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      uri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      const historyContent = await getHistoryContent(uri);
      if (isError(historyContent)) {
        const error = historyContent;
        logger.error(
          `Unable to show the element change level.`,
          `Unable to show the element change level because parsing of the element's URI failed with error ${error.message}.`
        );
        return;
      }
      return await getChangeLevelContent(
        dispatch,
        getElement,
        uri,
        historyContent
      );
    },
  };
};

export const getChangeLevelContent = async (
  dispatch: (action: Action) => Promise<void>,
  getElement: (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => (element: Element) => CachedElement | undefined,
  uri: Uri,
  historyContent: string
): Promise<string | undefined> => {
  const uriParams = fromElementChangeUri(uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to get content for element change level.`,
      `Unable to get content for element change level because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const { serviceId, searchLocationId, element, vvll } = uriParams;
  let vvllToUpdate = vvll;
  let historyData =
    getElement(serviceId)(searchLocationId)(element)?.historyData;
  if (
    !historyData ||
    !historyData.historyLines ||
    !historyData.changeLevels ||
    vvll === CURRENT_CHANGE_LEVEL
  ) {
    historyData = await updateHistoryData(
      dispatch,
      serviceId,
      element,
      searchLocationId,
      uri,
      historyContent
    );
    if (
      !historyData ||
      !historyData.changeLevels ||
      !historyData.historyLines
    ) {
      return historyContent;
    }
    vvllToUpdate =
      historyData.changeLevels[historyData.changeLevels.length - 1]?.vvll || '';
    if (vvllToUpdate === '') {
      return historyContent;
    }
  }
  if (!historyData || !historyData.changeLevels || !historyData.historyLines) {
    return historyContent;
  }
  const nodeToUpdate = historyData.changeLevels?.find(
    (changeNode) => changeNode.vvll === vvllToUpdate
  );
  if (!nodeToUpdate || !vvllToUpdate) {
    return;
  }
  const textLines = historyContent?.split(/\r?\n/);
  let textForChange = '';
  nodeToUpdate.lineNums = [];
  const addLine = (historyLine: HistoryLine): string => {
    let lineToAdd = '';
    if (textLines) {
      const lineMatcher =
        textLines[historyLine.line]?.match(HISTORY_LINE_PATTERN);
      lineToAdd = lineMatcher && lineMatcher[4] ? lineMatcher[4] : '';
    }
    return lineToAdd + '\n';
  };
  historyData.historyLines?.forEach((historyLine) => {
    let removedVersion = historyLine.removedVersion;
    if (historyLine.removedVersion > vvllToUpdate) {
      removedVersion = '';
    }
    if (!removedVersion || removedVersion == '') {
      if (historyLine.addedVersion > vvllToUpdate) {
        return;
      }
      if (historyLine.addedVersion <= vvllToUpdate) {
        nodeToUpdate.lineNums?.push(historyLine);
        textForChange += addLine(historyLine);
      }
    } else {
      if (removedVersion < vvllToUpdate) {
        return;
      }
      if (removedVersion === vvllToUpdate) {
        nodeToUpdate.lineNums?.push(historyLine);
        textForChange += addLine(historyLine);
      }
    }
  });
  return textForChange === '' ? undefined : textForChange;
};

export const updateHistoryData = async (
  dispatch: (action: Action) => Promise<void>,
  serviceId: Id,
  element: Element,
  searchLocationId: Id,
  uri: Uri,
  historyContent: string
): Promise<ElementHistoryData | undefined> => {
  const historyData = parseHistory(historyContent, uri);
  if (isError(historyData)) {
    const error = historyData;
    logger.error(
      `Unable to parse history for element ${element.name}.`,
      `Unable to parse history for element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} because parsing of the history failed with error ${error.message}.`
    );
    return;
  }
  await dispatch({
    type: Actions.ELEMENT_HISTORY_PRINTED,
    serviceId,
    element,
    searchLocationId,
    historyData,
    uri,
  });
  return historyData;
};

export const getHistoryContent = async (uri: Uri): Promise<string | Error> => {
  const uriParams = fromElementChangeUri(uri);
  if (isError(uriParams)) {
    return uriParams;
  }
  const historyUri = toElementHistoryUri(uriParams)(uriParams.fragment);
  if (isError(historyUri)) {
    return historyUri;
  }
  const historyDoc = await workspace.openTextDocument(historyUri);
  return historyDoc.getText();
};
