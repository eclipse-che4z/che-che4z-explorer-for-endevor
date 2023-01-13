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

import * as vscode from 'vscode';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { retrieveElementWithFingerprint } from '../../endevor';
import { logger, reporter } from '../../globals';
import { toEditedElementUri } from '../../uri/editedElementUri';
import { fromTreeElementUri } from '../../uri/treeElementUri';
import { isError } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import {
  EditElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../_doc/Telemetry';
import { saveIntoEditFolder, showElementToEdit } from './common';

export const editSingleElement =
  (getTempEditFolderUri: () => vscode.Uri) =>
  async (element: ElementNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
      autoSignOut: false,
    });
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to edit the element ${element.name}.`,
        `Unable to edit the element ${element.name} because of error ${error.message}.`
      );
      return;
    }
    const retrieveResult = await withNotificationProgress(
      `Retrieving element: ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithFingerprint(progressReporter)(
        elementUri.service
      )(elementUri.element)();
    });
    if (isError(retrieveResult)) {
      const error = retrieveResult;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const saveResult = await saveIntoEditFolder(getTempEditFolderUri())(
      elementUri.serviceId,
      elementUri.searchLocationId
    )(elementUri.element, retrieveResult.content);
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save the element ${element.name} into the file system.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const uploadableElementUri = toEditedElementUri(saveResult.fsPath)({
      element: elementUri.element,
      fingerprint: retrieveResult.fingerprint,
      endevorConnectionDetails: elementUri.service,
      searchContext: {
        serviceId: elementUri.serviceId,
        searchLocationId: elementUri.searchLocationId,
        overallSearchLocation: elementUri.searchLocation,
        initialSearchLocation: {
          subSystem: element.parent.parent.name,
          system: element.parent.parent.parent.name,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stageNumber: elementUri.searchLocation.stageNumber!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          environment: elementUri.searchLocation.environment!,
        },
      },
    });
    if (isError(uploadableElementUri)) {
      const error = uploadableElementUri;
      logger.error(
        `Unable to open the element ${element.name} for editing.`,
        `Unable to open the element ${element.name} because of error ${error.message}.`
      );
      return;
    }
    const showResult = await showElementToEdit(uploadableElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${element.name} for editing.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED,
        status: EditElementCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED,
      status: EditElementCommandCompletedStatus.SUCCESS,
    });
  };
