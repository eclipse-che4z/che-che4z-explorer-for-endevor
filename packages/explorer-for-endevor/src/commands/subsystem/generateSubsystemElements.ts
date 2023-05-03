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
import { generateSubsystemElementsInPlace } from '../../endevor';
import { logger, reporter } from '../../globals';
import { SubSystemNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import { Service, SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import {
  GenerateSubsystemElementsInPlaceCompletedStatus,
  TelemetryEvents,
} from '../../_doc/telemetry/v2/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { EndevorConfiguration, EndevorId } from '../../store/_doc/v2/Store';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { printResultTableCommand } from '../printResultTable';
import { formatWithNewLines } from '../../utils';
import { SearchLocation } from '../../_doc/Endevor';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';

type SelectedSubSystemNode = SubSystemNode;

export const generateSubsystemElementsCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    configurations: ConnectionConfigurations
  ) =>
  async (subSystemNode: SelectedSubSystemNode) => {
    const connectionParams = await getConnectionConfiguration(configurations)(
      subSystemNode.serviceId,
      subSystemNode.searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    logger.trace(
      `Generate elements in the subsystem command was called for ${subSystemNode.name}.`
    );
    await generateSubsystemElements(dispatch)(configuration)(service)(
      searchLocation
    )(subSystemNode);
  };

const generateSubsystemElements =
  (dispatch: (action: Action) => Promise<void>) =>
  (configuration: EndevorConfiguration) =>
  (service: Service) =>
  (searchLocation: SearchLocation) =>
  async (subSystemNode: SelectedSubSystemNode): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_CALLED,
    });
    const actionControlValue = await askForChangeControlValue({
      ccid: searchLocation?.ccid,
      comment: searchLocation?.comment,
    });
    if (dialogCancelled(actionControlValue)) {
      logger.error(
        `Elements is the subsystem ${subSystemNode.name} could be generated only with CCID and Comment specified.`
      );
      return;
    }
    const generateResponse = await withNotificationProgress(
      `Generating elements in the subsystem: ${subSystemNode.name}`
    )((progressReporter) =>
      generateSubsystemElementsInPlace(progressReporter)(service)(
        configuration
      )(subSystemNode.subSystemMapPath)(actionControlValue)()
    );
    if (isErrorEndevorResponse(generateResponse)) {
      const executionReportId =
        generateResponse.details.reportIds?.executionReportId;
      if (executionReportId) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALL,
          context:
            TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED,
        });
        await printResultTableCommand(subSystemNode.name)(configuration)(
          service
        )(subSystemNode.serviceId)(subSystemNode.searchLocationId)(
          actionControlValue.ccid
        )(executionReportId);
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED,
        status: GenerateSubsystemElementsInPlaceCompletedStatus.GENERIC_ERROR,
      });
      return;
    }
    if (generateResponse.details && generateResponse.details.returnCode >= 4) {
      logger.warn(
        `Elements in the subsystem ${subSystemNode.name} were generated with warnings.`,
        `Elements in the subsystem ${
          subSystemNode.name
        } were generated with warnings:\n${formatWithNewLines(
          generateResponse.details.messages
        )}`
      );
    } else {
      logger.info(
        `Elements in the subsystem ${subSystemNode.name} are generated successfully.`
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
