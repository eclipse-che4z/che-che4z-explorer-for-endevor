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

import { logger, reporter } from '../../globals';
import { Uri } from 'vscode';
import { isError } from '../../utils';
import { toElementChangeUri } from '../../uri/elementHistoryUri';
import { TelemetryEvents } from '../../_doc/Telemetry';
import { CURRENT_CHANGE_LEVEL } from '../../constants';
import { HistoryViewModes } from '../../tree/providerChanges';
import { BasicElementUriQuery } from '../../_doc/Uri';

export const printHistoryCommand = async (
  refreshElementHistoryTree: (uri: Uri, mode: HistoryViewModes) => void,
  uri: BasicElementUriQuery,
  mode: HistoryViewModes
) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PRINT_HISTORY_CALLED,
  });
  logger.trace(`Print History command was called for ${uri.element.name}.`);

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
      `Unable to print the element ${element.name} history because parsing of the element's URI failed with error ${error.message}.`
    );
    return error;
  }
  refreshElementHistoryTree(changeLvlUri, mode);
  return;
};
