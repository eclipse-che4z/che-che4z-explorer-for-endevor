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
import { EndevorConfiguration } from '../store/_doc/v2/Store';
import { Service } from '@local/endevor/_doc/Endevor';
import { isError } from '../utils';
import { getEndevorReportContent } from '../view/endevorReportContentProvider';
import { toGenericReportUri } from '../uri/genericReportUri';

export const printEndevorReportCommand =
  (objectName: string) =>
  (configuration: EndevorConfiguration) =>
  (service: Service) =>
  async (reportId: string) => {
    logger.trace(`Print Endevor report command ${objectName} is called.`);
    const reportUri =
      toGenericReportUri(objectName)(configuration)(service)(reportId);
    if (isError(reportUri)) {
      const error = reportUri;
      logger.error(
        `Unable to print the Endevor report for ${objectName}.`,
        `Unable to print the Endevor report for ${objectName} because parsing of the reports URI failed with error:\n${error.message}.`
      );
      return error;
    }
    try {
      const reportContent = await getEndevorReportContent(reportUri);
      if (!reportContent.getText()) {
        return;
      }
      await showDocument(reportContent);
    } catch (error) {
      return error;
    }
  };
