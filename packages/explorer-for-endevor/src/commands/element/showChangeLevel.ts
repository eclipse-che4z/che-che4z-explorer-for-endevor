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
import { logger, reporter } from '../../globals';
import { HistoryViewModes } from '../../tree/providerChanges';
import { ChangeLevelNode } from '../../tree/_doc/ChangesTree';
import {
  fromElementChangeUri,
  toElementChangeUri,
} from '../../uri/elementHistoryUri';
import { isError } from '../../utils';
import { TelemetryEvents } from '../../_doc/Telemetry';

export const showChangeLevelCommand = async (
  refreshElementHistoryTree: (uri: Uri, mode: HistoryViewModes) => void,
  changeNode: ChangeLevelNode
) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_SHOW_CHANGE_LEVEL_CALLED,
  });
  const uriParams = fromElementChangeUri(changeNode.uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to show change level ${changeNode.vvll}.`,
      `Unable to show change level ${changeNode.vvll} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  logger.trace(
    `Show Change Level command was called for ${uriParams.element.name}, version ${changeNode.vvll}.`
  );
  const { serviceId, searchLocationId, element, fragment } = uriParams;
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
