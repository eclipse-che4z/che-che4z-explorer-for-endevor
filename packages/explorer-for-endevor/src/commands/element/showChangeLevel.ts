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

import { Uri } from 'vscode';
import { logger } from '../../globals';
import { HistoryViewModes } from '../../tree/providerChanges';
import { ChangeLevelNode } from '../../tree/_doc/ChangesTree';
import {
  fromElementChangeUri,
  toElementChangeUri,
} from '../../uri/elementHistoryUri';
import { isError } from '../../utils';

export const showChangeLevelCommand = async (
  refreshElementHistoryTree: (uri: Uri, mode: HistoryViewModes) => void,
  changeNode: ChangeLevelNode
) => {
  const uriParams = fromElementChangeUri(changeNode.uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to show change level ${changeNode.vvll}.`,
      `Unable to show change level ${changeNode.vvll} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const { serviceId, searchLocationId, element, fragment } = uriParams;
  logger.trace(
    `Show Change Level command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}, version ${changeNode.vvll}.`
  );
  const changeLvlUri = toElementChangeUri({
    serviceId,
    searchLocationId,
    element,
    vvll: changeNode.vvll,
  })(fragment);
  if (isError(changeLvlUri)) {
    const error = changeLvlUri;
    logger.error(
      `Unable to show change level ${changeNode.vvll}.`,
      `Unable to show change level ${changeNode.vvll} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  refreshElementHistoryTree(changeLvlUri, HistoryViewModes.SHOW_IN_EDITOR);
};
