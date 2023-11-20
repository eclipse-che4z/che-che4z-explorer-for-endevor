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

import { isErrorEndevorResponse } from '@local/endevor/utils';
import { withCancellableNotificationProgress } from '@local/vscode-wrapper/window';
import { getApiVersionAndLogActivity } from '../../api/endevor';
import { reporter } from '../../globals';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  EndevorConnection,
  EndevorConnectionStatus,
  EndevorId,
} from '../../store/_doc/v2/Store';
import { InvalidLocationNode } from '../../tree/_doc/ServiceLocationTree';
import { formatWithNewLines } from '../../utils';
import {
  TelemetryEvents,
  TestConnectionDetailsCommandCompletedStatus,
} from '../../telemetry/_doc/Telemetry';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';

export const testConnectionDetailsCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionDetails: (id: EndevorId) => EndevorConnection | undefined
  ) =>
  async (invalidLocationNode: InvalidLocationNode): Promise<void> => {
    const serviceId = {
      name: invalidLocationNode.serviceName,
      source: invalidLocationNode.serviceSource,
    };
    const logger = createEndevorLogger({ serviceId });
    logger.traceWithDetails('Test Endevor connection command was called.');
    const connectionDetails = getConnectionDetails(serviceId);
    if (!connectionDetails) return;
    const testResponse = await withCancellableNotificationProgress(
      'Testing Endevor connection ...'
    )((progressReporter) =>
      getApiVersionAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
        })
      )(progressReporter)({
        location: connectionDetails.value.location,
        rejectUnauthorized: connectionDetails.value.rejectUnauthorized,
      })
    );
    if (!testResponse) return;
    if (isErrorEndevorResponse(testResponse)) {
      const errorResponse = testResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to fetch Endevor Web Services API version because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.errorWithDetails(
        'Unable to connect to Endevor Web Services.',
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED,
        status: TestConnectionDetailsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED,
      status: TestConnectionDetailsCommandCompletedStatus.SUCCESS,
    });
    dispatch({
      type: Actions.ENDEVOR_CONNECTION_TESTED,
      connectionId: serviceId,
      status: {
        status: EndevorConnectionStatus.VALID,
        apiVersion: testResponse.result,
      },
    });
  };
