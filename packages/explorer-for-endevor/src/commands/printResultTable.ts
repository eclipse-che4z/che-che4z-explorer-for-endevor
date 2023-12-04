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

import { showDocument } from '@local/vscode-wrapper/window';
import { EndevorId } from '../store/_doc/v2/Store';
import { isError } from '../utils';
import { toActionReportUri } from '../uri/actionReportUri';
import { getResultTableContent } from '../view/resultTableContentProvider';
import { createEndevorLogger } from '../logger';

export const printResultTableCommand =
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (objectName: string) =>
  (ccid: string) =>
  async (reportId: string) => {
    const logger = createEndevorLogger({ serviceId, searchLocationId });
    logger.traceWithDetails(
      `Print result table command for ${objectName} is called.`
    );
    const reportUri = toActionReportUri(
      serviceId,
      searchLocationId
    )(objectName)(ccid)(reportId);
    if (isError(reportUri)) {
      const error = reportUri;
      logger.errorWithDetails(
        `Unable to print the result table for ${objectName}.`,
        `Unable to print the result table for ${objectName} because parsing of the reports URI failed with error:\n${error.message}.`
      );
      return error;
    }
    try {
      const reportContent = await getResultTableContent(reportUri);
      if (!reportContent.getText()) {
        return;
      }
      await showDocument(reportContent);
    } catch (error) {
      return error;
    }
  };
