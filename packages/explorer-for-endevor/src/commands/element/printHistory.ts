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

import { logger } from '../../globals';
import { Uri } from 'vscode';
import { isError } from '../../utils';
import { toElementChangeUri } from '../../uri/elementHistoryUri';
import { CURRENT_CHANGE_LEVEL } from '../../constants';
import { HistoryViewModes } from '../../tree/providerChanges';
import { BasicElementUriQuery } from '../../_doc/Uri';

export const printHistoryCommand = async (
  refreshElementHistoryTree: (uri: Uri, mode: HistoryViewModes) => void,
  uri: BasicElementUriQuery,
  mode: HistoryViewModes
) => {
  logger.trace(
    `Print History command was called for ${uri.element.environment}/${uri.element.stageNumber}/${uri.element.system}/${uri.element.subSystem}/${uri.element.type}/${uri.element.name}.`
  );

  const { serviceId, searchLocationId, element } = uri;
  const changeLvlUri = toElementChangeUri({
    serviceId,
    searchLocationId,
    element,
    vvll: CURRENT_CHANGE_LEVEL,
  })(Date.now().toString());
  if (isError(changeLvlUri)) {
    const error = changeLvlUri;
    logger.error(
      `Unable to print the element ${element.name} history.`,
      `Unable to print the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} history because parsing of the element's URI failed with error ${error.message}.`
    );
    return error;
  }
  refreshElementHistoryTree(changeLvlUri, mode);
  return;
};
