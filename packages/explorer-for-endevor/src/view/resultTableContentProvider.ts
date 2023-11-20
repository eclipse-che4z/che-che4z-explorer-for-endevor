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

import { withNotificationProgress } from '@local/vscode-wrapper/window';
import * as vscode from 'vscode';
import { downloadReportById } from '../api/endevor';
import { reporter } from '../globals';
import { fromActionReportUri } from '../uri/actionReportUri';
import { isDefined, isError } from '../utils';
import {
  ReportContentProviderCompletedStatus,
  TelemetryEvents,
} from '../telemetry/_doc/Telemetry';
import * as markDownTable from 'table';
import { Action, Actions } from '../store/_doc/Actions';
import { Element } from '@local/endevor/_doc/Endevor';
import { EndevorId } from '../store/_doc/v2/Store';
import { toEndevorStageNumber } from '@local/endevor/utils';
import { createEndevorLogger } from '../logger';
import { EndevorAuthorizedService, SearchLocation } from '../api/_doc/Endevor';

const logger = createEndevorLogger();

const failedStatus = '*FAILED*';

const tableHeaders = [
  'STATUS',
  'ACTION',
  'ELEMENT',
  'PROC RC',
  'NDVR RC',
  'ENVIRONMENT',
  'SYSTEM',
  'SUBSYSTEM',
  'TYPE',
  'STAGE',
  'TIME',
  'ACTION NUMBER',
  'STMT NUMBER',
  'SCL WRITTEN',
];

export const resultTableContentProvider = (
  dispatch: (action: Action) => Promise<void>,
  getConnectionConfiguration: (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) => Promise<
    | {
        service: EndevorAuthorizedService;
        searchLocation: SearchLocation;
      }
    | undefined
  >
): vscode.TextDocumentContentProvider => {
  return {
    async provideTextDocumentContent(
      uri: vscode.Uri,
      _token: vscode.CancellationToken
    ): Promise<string | undefined> {
      const uriParams = fromActionReportUri(uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.error(
          `Unable to print generate result table.`,
          `Unable to print generate result table because parsing of the URI failed with error:\n${error.message}.`
        );
        return;
      }
      const { serviceId, searchLocationId, reportId, ccid, objectName } =
        uriParams;
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) return;
      const { service } = connectionParams;
      logger.updateContext({ serviceId, searchLocationId });
      const retrieveReport = await withNotificationProgress(
        `Retrieving generate results for ${objectName} ...`
      )((progressReporter) =>
        downloadReportById(progressReporter)(service)(reportId)
      );
      if (!retrieveReport) {
        const error = new Error(
          `Unable to retrieve Endevor report for ${objectName}`
        );
        logger.errorWithDetails(`${error.message}.`);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALLED,
          status: ReportContentProviderCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.REPORT_CONTENT_PROVIDER_COMPLETED,
        context: TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALLED,
        status: ReportContentProviderCompletedStatus.SUCCESS,
      });
      return formatReportIntoResultTable(dispatch)(
        retrieveReport,
        serviceId,
        searchLocationId,
        ccid.toUpperCase()
      );
    },
  };
};
const formatReportIntoResultTable =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    reportDocument: string,
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    lastActionCcid: string
  ): string => {
    /* 
    Avoid unwanted issues by cleaning the string from clutter rows, empty lines and headers.
  */
    const cleanReport = reportDocument
      .toString()
      .replace(/.E N D E V O R {3}E X E C U T I O N {3}R E P O R T.*$/gm, '')
      .replace(
        /.*Copyright \(C\) .* {6}Broadcom\. All Rights Reserved\..*$/gm,
        ''
      )
      .replace(/^.REQUESTED BY: .*$/gm, '')
      .replace(/(^[ \t]*\n)/gm, '');

    /* 
    Get the final table from the report without any changes.
  */
    const finalTable = cleanReport
      .split('E N D E V O R   A C T I O N   S U M M A R Y   R E P O R T')
      .pop();

    if (!finalTable) {
      return cleanReport;
    }

    const elementsToUpdate: Array<Omit<Element, 'id'>> = [];
    /* 
    Use the lines of the table to populate the action object values.
    The actual Action type starts on the 11th position, preceeding characters are removed.
    Values are derived based on  their index in the string, changes to the report structure might not be supported
  */
    const parsedElements: Array<Array<string>> = finalTable
      .split(/\r?\n/)
      .map((str) => {
        const trimedString = str.trimStart();
        if (
          trimedString.length == 0 ||
          trimedString.startsWith('ACTION    ELEMENT') ||
          trimedString.startsWith('END OF EXECUTION') ||
          trimedString.match(
            /.*------------ {2}INVENTORY {2}INFORMATION {2}-----------.*$/
          )
        ) {
          return;
        }
        // Use a pattern to math to the table row string
        const rowPattern =
          '^\\s?(\\*FAILED\\*)?\\s+(\\S*)\\s+(\\S*)\\s+(\\S*\\s+\\d*)\\s+(\\S*)\\s+(\\S*)\\s+(\\S*)\\s+(\\S*)\\s+(\\S*)\\s+(\\S*)\\s+(\\d*)\\s+(\\d*)\\s*(\\d*)\\s*$';
        const matchedRow = str.match(rowPattern);
        if (matchedRow) {
          const rcArray = matchedRow[4]?.trim().split(/\s+/) || [];
          const [
            status,
            action,
            name,
            procRc,
            ndvrRc,
            environment,
            system,
            subSystem,
            type,
            stageNumber,
            time,
            actionNumber,
            stmtNumber,
            sclWritten,
          ] = [
            matchedRow[1]?.trim() === '*FAILED*' ? failedStatus : '',
            matchedRow[2] || '',
            matchedRow[3] || '',
            (rcArray.length > 1 ? rcArray[0] : '') || '',
            (rcArray.length > 1 ? rcArray[1] : rcArray[0]) || '',
            matchedRow[5] || '',
            matchedRow[6] || '',
            matchedRow[7] || '',
            matchedRow[8] || '',
            matchedRow[9] || '',
            matchedRow[10] || '',
            matchedRow[11] || '',
            matchedRow[12] || '',
            matchedRow[13] || '',
          ];
          /*
            If the Element name happens to be a longer than 8 characters 
            try to find the real name in the full report by its action # and stmt #
          */
          let realName = name;
          if (realName && realName.startsWith('{')) {
            const actionCoordinates = `ACTION #${actionNumber} / STMT #${stmtNumber}`;
            if (cleanReport.includes(actionCoordinates)) {
              const parsedLongName = cleanReport
                .split(actionCoordinates)
                .pop()
                ?.split(`${action} ELEMENT `)
                .pop()
                ?.split(/\r?\n/)
                .shift()
                ?.trim();
              if (parsedLongName) realName = parsedLongName;
            }
          }
          if (
            realName &&
            environment &&
            system &&
            subSystem &&
            type &&
            stageNumber
          ) {
            const realStageNumber = toEndevorStageNumber(stageNumber);
            if (realStageNumber)
              elementsToUpdate.push({
                name: realName,
                environment,
                system,
                subSystem,
                type,
                stageNumber: realStageNumber,
                lastActionCcid,
              });
          }
          return [
            status,
            action,
            realName,
            procRc,
            ndvrRc,
            environment,
            system,
            subSystem,
            type,
            stageNumber,
            time,
            actionNumber,
            stmtNumber,
            sclWritten,
          ];
        }
        return;
      })
      .filter(isDefined);

    updateTreeAfterUnsuccessfulGenerate(dispatch)(serviceId)(searchLocationId)({
      elements: elementsToUpdate,
    });
    const formattedTable = theTablenator(parsedElements);

    return `\n${formattedTable}`;
  };

/**
 * {@link resultTableContentProvider} will be called by VSCode
 *
 * @returns document with report or empty content
 */
export const getResultTableContent = async (
  uri: vscode.Uri
): Promise<vscode.TextDocument> => {
  return await vscode.workspace.openTextDocument(uri);
};

// The Tablenator is back from the future to destory the organic table resistance
const theTablenator = (actionElements: Array<Array<string>>): string => {
  const config = {
    columns: {
      2: { width: 30 },
    },
  };
  return markDownTable.table([tableHeaders, ...actionElements], config);
};

const updateTreeAfterUnsuccessfulGenerate =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  async (actionPayload: {
    elements: ReadonlyArray<Omit<Element, 'id'>>;
  }): Promise<void> => {
    await dispatch({
      type: Actions.SELECTED_ELEMENTS_UPDATED,
      serviceId,
      searchLocationId,
      ...actionPayload,
    });
  };
