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

import { Uri, CancellationToken, TextDocumentContentProvider } from 'vscode';
import { isError } from '../utils';
import { Element } from '@local/endevor/_doc/Endevor';
import { Logger } from '@local/extension/_doc/Logger';
import { getHistoryContent } from '../endevor';
import { fromElementChangeUri } from '../uri/elementHistoryUri';
import {
  ChangeLevelNode,
  ChangeLevels,
  ElementHistoryData,
  HistoryLine,
  HistoryLines,
} from '../tree/_doc/ChangesTree';
import { CURRENT_CHANGE_LEVEL } from '../constants';
import { UriFunctions } from '../_doc/Uri';

export const changeLvlContentProvider = (
  { getConfigurations, getHistoryData, logActivity }: UriFunctions,
  refreshHistoryData: (
    elementHistory: ElementHistoryData,
    elementUri: Uri
  ) => Promise<void>,
  logger: Logger,
  uriScheme: string
): TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      uri: Uri,
      _token: CancellationToken
    ): Promise<string | undefined> {
      const elementQuery = fromElementChangeUri(uri)(uriScheme);
      if (isError(elementQuery)) {
        const error = elementQuery;
        logger.error(
          `Unable to show the element change level.`,
          `Unable to show the element change level because parsing of the element's URI failed with error ${error.message}.`
        );
        return;
      }
      const cachedHistoryContent = getHistoryData(uri)?.historyContent;
      if (cachedHistoryContent) {
        return await getChangeLevelContent(
          getHistoryData,
          refreshHistoryData,
          logger,
          elementQuery.element,
          elementQuery.vvll,
          uri,
          cachedHistoryContent
        );
      }
      const connectionParams = await getConfigurations(uri);
      if (!connectionParams) return;
      const historyContent = await getHistoryContent(
        logger,
        connectionParams.service,
        connectionParams.configuration,
        elementQuery.element,
        logActivity ? logActivity(uri) : undefined
      );
      if (!historyContent) {
        logger.error(`Unable to show the element change level.`);
        return;
      }
      return await getChangeLevelContent(
        getHistoryData,
        refreshHistoryData,
        logger,
        elementQuery.element,
        elementQuery.vvll,
        uri,
        historyContent
      );
    },
  };
};

export const getChangeLevelContent = async (
  getHistoryData: (elementUri: Uri) => ElementHistoryData | undefined,
  refreshHistoryData: (
    elementHistory: ElementHistoryData,
    elementUri: Uri
  ) => Promise<void>,
  logger: Logger,
  element: Element,
  vvll: string,
  uri: Uri,
  historyContent: string
): Promise<string | undefined> => {
  let vvllToUpdate = vvll;
  let historyData = getHistoryData(uri);
  if (
    !historyData ||
    !historyData.historyLines ||
    !historyData.changeLevels ||
    vvll === CURRENT_CHANGE_LEVEL
  ) {
    historyData = await updateHistoryData(
      refreshHistoryData,
      element,
      logger,
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
  return textForChange;
};
export const HISTORY_LINE_PATTERN =
  '^\\s*(%{0,1})\\+([0-9]{4})(?:-| )([0-9]{4}|\\s{4}) (.*)$';
const SOURCE_CHANGE_LINE_PATTERN =
  '^\\s*([0-9]{4})\\s+([A-Z]{0,1})\\s+(.{1,8})\\s+(\\S{7})' +
  '\\s+(\\S{5})\\s+([0-9]+) (.{1,12}) (.*)';
const SOURCE_CHANGE_LINE_HEADER =
  'VVLL SYNC USER     DATE    TIME     STMTS CCID         COMMENT';
export const parseHistory = (
  content: string,
  uri: Uri
):
  | {
      changeLevels: ChangeLevels;
      historyLines: HistoryLines;
      historyContent: string;
    }
  | Error => {
  const contentLines = content.split(/\r?\n/);
  const changeLevels = Array<ChangeLevelNode>();
  const historyLines = Array<HistoryLine>();

  let lineIndex = 0;
  let isHeader = contentLines[lineIndex]?.indexOf(SOURCE_CHANGE_LINE_HEADER);
  while (lineIndex < contentLines.length && isHeader && isHeader < 0) {
    lineIndex++;
    isHeader = contentLines[lineIndex]?.indexOf(SOURCE_CHANGE_LINE_HEADER);
  }
  if (!isHeader || isHeader < 0) {
    return new Error('History Change Level metadata header does not match.');
  }
  while (
    lineIndex < contentLines.length &&
    !contentLines[lineIndex]?.match(HISTORY_LINE_PATTERN)
  ) {
    const matcher = contentLines[lineIndex]?.match(SOURCE_CHANGE_LINE_PATTERN);
    if (matcher && matcher[1]) {
      const node = {
        uri,
        vvll: matcher[1].trim(),
        user: matcher[3]?.trim(),
        date: matcher[4]?.trim(),
        time: matcher[5]?.trim(),
        ccid: matcher[7]?.trim(),
        comment: matcher[8]?.trim(),
        lineNums: [],
      };
      changeLevels.push(node);
    }
    lineIndex++;
  }
  while (lineIndex < contentLines.length) {
    const matcher = contentLines[lineIndex]?.match(HISTORY_LINE_PATTERN);
    if (matcher) {
      const historyLine = {
        changed: matcher[1] === '%',
        addedVersion: matcher[2]?.trim() || '',
        removedVersion: matcher[3]?.trim() || '',
        line: lineIndex,
        lineLength: contentLines[lineIndex]?.length,
      };
      historyLines.push(historyLine);
    }
    lineIndex++;
  }
  if (!changeLevels || !historyLines) {
    return new Error('Could not find any history data');
  }
  return {
    changeLevels,
    historyLines,
    historyContent: content,
  };
};
export const updateHistoryData = async (
  refreshHistoryData: (
    elementHistory: ElementHistoryData,
    elementUri: Uri
  ) => Promise<void>,
  element: Element,
  logger: Logger,
  uri: Uri,
  historyContent: string
): Promise<ElementHistoryData | undefined> => {
  const historyData = parseHistory(historyContent, uri);
  if (isError(historyData)) {
    const error = historyData;
    logger.error(
      `Unable to parse history for element ${element.name}.`,
      `Unable to parse history for element ${element.name} because parsing of the history failed with error ${error.message}.`
    );
    return;
  }
  await refreshHistoryData(historyData, uri);
  return historyData;
};
