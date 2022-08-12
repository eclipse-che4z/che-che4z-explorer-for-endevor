/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { logger, reporter } from '../globals';
import { Action, Actions } from '../store/_doc/Actions';
import { ServiceNode } from '../tree/_doc/ServiceLocationTree';
import { TelemetryEvents } from '../_doc/telemetry/v2/Telemetry';

export const hideService =
  (dispatch: (action: Action) => Promise<void>) =>
  async ({ name, source }: ServiceNode): Promise<void> => {
    logger.trace(`Hide ${source} Endevor connection ${name} called.`);
    dispatch({
      type: Actions.ENDEVOR_SERVICE_HIDDEN,
      serviceId: {
        name,
        source,
      },
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.SERVICE_HIDDEN,
      source,
    });
  };
