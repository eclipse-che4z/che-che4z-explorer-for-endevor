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

import { Service } from '@local/endevor/_doc/Endevor';
import { Uri } from 'vscode';
import { EndevorConfiguration } from '../store/_doc/v2/Store';
import { Schemas, Extensions, ActionReportUriQuery } from '../_doc/Uri';

export const toGenericReportUri =
  (objectName: string) =>
  (configuration: EndevorConfiguration) =>
  (service: Service) =>
  (reportId: string): Uri | Error => {
    try {
      const emptyUri = Uri.parse('');
      return emptyUri.with({
        scheme: Schemas.READ_ONLY_GENERIC_REPORT,
        path: [reportId, Extensions.ACTION_REPORT].join('.'),
        query: encodeURIComponent(
          JSON.stringify({
            objectName,
            configuration,
            service,
            reportId,
          })
        ),
      });
    } catch (e) {
      return e;
    }
  };

export const fromGenericReportUri = (
  uri: Uri
): ActionReportUriQuery | Error => {
  // TODO: replace with validation in separated function
  const expectedScheme = Schemas.READ_ONLY_GENERIC_REPORT;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    return JSON.parse(decodeURIComponent(uri.query));
  }
  return new Error(
    `Uri scheme is incorrect: ${actualScheme}, but should be: ${expectedScheme}`
  );
};
