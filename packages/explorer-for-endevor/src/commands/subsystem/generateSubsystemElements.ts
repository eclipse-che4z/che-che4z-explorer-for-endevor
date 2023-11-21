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

import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import { generateSubsystemElementsInPlaceAndLogActivity } from '../../api/endevor';
import { reporter } from '../../globals';
import { SubSystemNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import { SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import {
  GenerateSubsystemElementsInPlaceCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { EndevorId } from '../../store/_doc/v2/Store';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { printResultTableCommand } from '../printResultTable';
import { formatWithNewLines } from '../../utils';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { askForGenerateAllElements } from '../../dialogs/locations/endevorSubsystemDialogs';

type SelectedSubSystemNode = SubSystemNode;

export const generateSubsystemElementsCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async (subSystemNode: SelectedSubSystemNode) => {
    const logger = createEndevorLogger({
      serviceId: subSystemNode.serviceId,
      searchLocationId: subSystemNode.searchLocationId,
    });
    if (!(await askForGenerateAllElements(subSystemNode.name))) return;
    const connectionParams = await getConnectionConfiguration(
      subSystemNode.serviceId,
      subSystemNode.searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    logger.traceWithDetails(
      `Generate elements in subsystem command was called for ${subSystemNode.name}.`
    );
    await generateSubsystemElements(dispatch)(service)(searchLocation)(
      subSystemNode
    );
  };

const generateSubsystemElements =
  (dispatch: (action: Action) => Promise<void>) =>
  (service: EndevorAuthorizedService) =>
  (searchLocation: SearchLocation) =>
  async (subSystemNode: SelectedSubSystemNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId: subSystemNode.serviceId,
      searchLocationId: subSystemNode.searchLocationId,
    });
    const actionControlValue = await askForChangeControlValue({
      ccid: searchLocation?.ccid,
      comment: searchLocation?.comment,
    });
    if (dialogCancelled(actionControlValue)) {
      logger.error(
        `Elements in subsystem ${subSystemNode.name} could be generated only with CCID and Comment specified.`
      );
      return;
    }
    const generateResponse = await withNotificationProgress(
      `Generating elements in subsystem ${subSystemNode.name} ...`
    )((progressReporter) =>
      generateSubsystemElementsInPlaceAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId: subSystemNode.serviceId,
          searchLocationId: subSystemNode.searchLocationId,
        })
      )(progressReporter)(service)(subSystemNode.subSystemMapPath)(
        actionControlValue
      )()
    );
    if (isErrorEndevorResponse(generateResponse)) {
      const executionReportId = generateResponse.details.reportIds?.C1MSGS1;
      if (executionReportId) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALL,
          context:
            TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED,
        });
        await printResultTableCommand(
          subSystemNode.serviceId,
          subSystemNode.searchLocationId
        )(subSystemNode.name)(actionControlValue.ccid)(executionReportId);
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED,
        status: GenerateSubsystemElementsInPlaceCompletedStatus.GENERIC_ERROR,
      });
      return;
    }
    if (generateResponse.details && generateResponse.details.returnCode >= 4) {
      logger.warnWithDetails(
        `Elements in subsystem ${subSystemNode.name} were generated with warnings.`,
        `Elements in subsystem ${
          subSystemNode.name
        } were generated with warnings:\n${formatWithNewLines(
          generateResponse.details.messages
        )}`
      );
    } else {
      logger.infoWithDetails(
        `Elements in subsystem ${subSystemNode.name} are generated successfully.`
      );
    }
    updateTreeAfterGenerate(dispatch)(
      subSystemNode.serviceId,
      subSystemNode.searchLocationId,
      subSystemNode.subSystemMapPath,
      actionControlValue.ccid
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED,
      status: GenerateSubsystemElementsInPlaceCompletedStatus.SUCCESS,
    });
  };

const updateTreeAfterGenerate =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    subSystemMapPath: SubSystemMapPath,
    lastActionCcid: string
  ): Promise<void> => {
    dispatch({
      type: Actions.SUBSYSTEM_ELEMENTS_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      subSystemMapPath,
      lastActionCcid,
    });
  };
