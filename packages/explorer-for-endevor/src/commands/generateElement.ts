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

import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import { askToShowListing } from '../dialogs/listings/showListingDialogs';
import { generateElement } from '../endevor';
import { logger, reporter } from '../globals';
import { fromTreeElementUri, toTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { ElementNode, Node } from '../_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../_doc/Actions';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';
import { toSearchLocationId } from '../../src/tree/endevor';
import {
  GenerateElementCommandCompletedStatus,
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const generateElementCommand =
  (dispatch: (action: Action) => Promise<void>) =>
  async (elementNode?: SelectedElementNode, nodes?: SelectedMultipleNodes) => {
    if (nodes) {
      logger.error(`Generate action currently supports single elements only.`);
    } else if (elementNode) {
      logger.trace(`Generate command was called for ${elementNode.name}.`);
      await generateSingleElement(dispatch)(elementNode);
    }
  };

const generateSingleElement =
  (dispatch: (action: Action) => Promise<void>) =>
  async (elementNode: ElementNode): Promise<void> => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to generate the element ${elementNode.name}.`,
        `Unable to generate the element ${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
    });
    const {
      serviceName,
      searchLocationName,
      service,
      element,
      searchLocation,
    } = uriParams;
    const actionControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(actionControlValue)) {
      logger.error(
        'Element can be generated only with CCID and Comment specified.'
      );
      return;
    }
    const generateResult = await withNotificationProgress(
      `Generating element: ${element.name}`
    )((progressReporter) =>
      generateElement(progressReporter)(service)(element)(actionControlValue)(
        false
      )
    );
    let newElementUri = toTreeElementUri({
      serviceName,
      element,
      searchLocationName,
      service,
      searchLocation,
    })(Date.now().toString());
    if (isError(newElementUri)) {
      const error = newElementUri;
      logger.warn(
        `Unable to update the element ${elementNode.name} URI.`,
        `Unable to update the element ${elementNode.name} URI because of error ${error.message}.`
      );
      newElementUri = elementNode.uri;
    }
    const updatedElementNode: SelectedElementNode = {
      id: elementNode.id,
      searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
      type: elementNode.type,
      name: elementNode.name,
      uri: newElementUri,
    };
    if (isError(generateResult)) {
      const error = generateResult;
      logger.error(
        `Unable to generate the element ${elementNode.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        status: GenerateElementCommandCompletedStatus.GENERIC_ERROR,
        errorContext: TelemetryEvents.COMMAND_GENERATE_ELEMENT_CALLED,
        error,
      });
      await printListingCommand(updatedElementNode);
    } else {
      logger.info('Generate successful!');
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_COMPLETED,
        status: GenerateElementCommandCompletedStatus.SUCCESS,
      });
      if (await askToShowListing()) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL,
          context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_COMPLETED,
        });
        await printListingCommand(updatedElementNode);
      }
    }
    await updateTreeAfterGenerate(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
  };

const updateTreeAfterGenerate =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    searchLocation: ElementSearchLocation,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_GENERATED,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
