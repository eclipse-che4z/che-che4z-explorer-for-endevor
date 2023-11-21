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

import { Logger } from '@local/extension/_doc/Logger';
import * as vscode from 'vscode';
import { CURRENT_CHANGE_LEVEL } from '../constants';
import { BasicElementUriQuery } from '../_doc/Uri';
import { isError } from '../utils';
import { HistoryViewModes } from '../tree/_doc/ChangesTree';
import { toElementChangeUri } from '../uri/elementHistoryUri';

export const printHistoryCommand = async <T>(
  logger: Logger,
  refreshElementHistoryTree: (uri: vscode.Uri, mode: HistoryViewModes) => void,
  uri: BasicElementUriQuery<T>,
  mode: HistoryViewModes,
  uriScheme: string
) => {
  logger.trace(`Print History command was called for ${uri.element.name}.`);

  const changeLvlUri = toElementChangeUri<T>({
    ...uri,
    vvll: CURRENT_CHANGE_LEVEL,
  })(uriScheme)(Date.now().toString());
  if (isError(changeLvlUri)) {
    const error = changeLvlUri;
    logger.error(
      `Unable to print the element ${uri.element.name} history.`,
      `Unable to print the element ${uri.element.name} history because parsing of the element's URI failed with error ${error.message}.`
    );
    return error;
  }
  refreshElementHistoryTree(changeLvlUri, mode);
  return;
};
