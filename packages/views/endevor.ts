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

import { isErrorEndevorResponse } from '@local/endevor/utils';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  Element,
  EndevorResponse,
  ErrorResponseType,
  Service,
} from '@local/endevor/_doc/Endevor';
import { formatWithNewLines } from './utils';
import { Logger } from '@local/extension/_doc/Logger';
import * as endevor from '@local/endevor/endevor';

export const getHistoryContent = async (
  logger: Logger,
  service: Service,
  configuration: string,
  element: Element,
  logActivity?: (
    actionName: string
  ) => <E extends ErrorResponseType | undefined, R>(
    response: EndevorResponse<E, R>
  ) => void
): Promise<string | void> => {
  const historyResponse = await withNotificationProgress(
    `Printing element: ${element.name} history content`
  )(async (progressReporter) => {
    return endevor.printHistory(logger)(progressReporter)(service)(
      configuration
    )(element);
  });
  if (logActivity) {
    logActivity('Printing a history for element')(historyResponse);
  }
  if (isErrorEndevorResponse(historyResponse)) {
    const errorMessage = `Unable to print history for the element 
    ${element.environment}/${element.stageNumber}/${element.system}/${
      element.subSystem
    }/${element.type}/${element.name} because of error:\n${formatWithNewLines(
      historyResponse.details.messages
    )}`;
    logger.error(
      `Unable to print history for the element ${element.name}.`,
      errorMessage
    );
    return;
  }
  if (historyResponse.details && historyResponse.details.returnCode >= 4) {
    logger.warn(
      `History for ${element.name} was printed with warnings.`,
      `History for ${element.environment}/${element.stageNumber}/${
        element.system
      }/${element.subSystem}/${element.type}/${
        element.name
      } was printed with warnings:\n${formatWithNewLines(
        historyResponse.details.messages
      )}`
    );
  }
  return historyResponse.result;
};
