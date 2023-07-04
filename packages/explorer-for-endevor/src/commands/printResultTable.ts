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

import { logger } from '../globals';
import { showDocument } from '@local/vscode-wrapper/window';
import { EndevorConfiguration, EndevorId } from '../store/_doc/v2/Store';
import { Service } from '@local/endevor/_doc/Endevor';
import { isError } from '../utils';
import { toActionReportUri } from '../uri/actionReportUri';
import { getResultTableContent } from '../view/resultTableContentProvider';

export const printResultTableCommand =
  (objectName: string) =>
  (configuration: EndevorConfiguration) =>
  (service: Service) =>
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (ccid: string) =>
  async (reportId: string) => {
    logger.trace(`Print result table command for ${objectName} is called.`);
    const reportUri =
      toActionReportUri(objectName)(configuration)(service)(serviceId)(
        searchLocationId
      )(ccid)(reportId);
    if (isError(reportUri)) {
      const error = reportUri;
      logger.error(
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
