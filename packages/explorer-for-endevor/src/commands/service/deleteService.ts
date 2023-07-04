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

import { askForServiceDeletion } from '../../dialogs/locations/endevorServiceDialogs';
import { logger, reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import { ServiceNode } from '../../tree/_doc/ServiceLocationTree';
import {
  CommandDeleteServiceCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/Telemetry';

export const deleteServiceCommand =
  (dispatch: (action: Action) => Promise<void>) =>
  async ({ name, source }: ServiceNode): Promise<void> => {
    logger.trace(`Delete ${source} Endevor connection ${name} called.`);
    if (await askForServiceDeletion(name)) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED,
        status: CommandDeleteServiceCompletedStatus.SUCCESS,
      });
      dispatch({
        type: Actions.ENDEVOR_SERVICE_DELETED,
        serviceId: { name, source },
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED,
      status: CommandDeleteServiceCompletedStatus.CANCELLED,
    });
  };
