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
import { Logger } from '@local/extension/_doc/Logger';
import { ChangeLevelNode, HistoryViewModes } from '../tree/_doc/ChangesTree';
import { isError } from '../utils';
import {
  fromElementChangeUri,
  toElementChangeUri,
} from '../uri/elementHistoryUri';

export const showChangeLevelCommand = async (
  logger: Logger,
  refreshElementHistoryTree: (uri: Uri, mode: HistoryViewModes) => void,
  changeNode: ChangeLevelNode,
  uriScheme: string
) => {
  const uriParams = fromElementChangeUri(changeNode.uri)(uriScheme);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to show change level ${changeNode.vvll}.`,
      `Unable to show change level ${changeNode.vvll} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const element = uriParams.element;
  logger.trace(
    `Show Change Level command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}, version ${changeNode.vvll}.`
  );
  const changeLvlUri = toElementChangeUri({
    ...uriParams,
    vvll: changeNode.vvll,
  })(uriScheme)(Date.now().toString());
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
