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
import { generateElementInPlace } from '../endevor';
import { logger, reporter } from '../globals';
import { fromTreeElementUri, toTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../_doc/Actions';
import {
  ActionChangeControlValue,
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';
import { toSearchLocationId } from '../tree/endevor';
import {
  GenerateElementInPlaceCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../_doc/telemetry/v2/Telemetry';
import {
  isProcessorStepMaxRcExceededError,
  isSignoutError,
} from '@local/endevor/utils';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';

type SelectedElementNode = ElementNode;

export const generateElementInPlaceCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode
) => {
  logger.trace(`Generate command was called for ${elementNode.name}.`);
  await generateSingleElement(dispatch)(elementNode);
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
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
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
      searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
      type: elementNode.type,
      name: elementNode.name,
      parent: elementNode.parent,
      uri: newElementUri,
    };
    const generateResult = await complexGenerate(service)(element)(
      actionControlValue
    );
    if (isProcessorStepMaxRcExceededError(generateResult)) {
      const error = generateResult;
      logger.error(
        `The element ${elementNode.name} is generated unsuccessfully. Please review the listing.`,
        `${error.message}.`
      );
      await updateTreeAfterGenerate(dispatch)(
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        [element]
      );
      await printListingCommand(updatedElementNode);
      // consider errors in the element processing as a success too (a part of the expected developer workflow)
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
        status: GenerateElementInPlaceCommandCompletedStatus.SUCCESS,
      });
      return;
    }
    if (isError(generateResult)) {
      const error = generateResult;
      logger.error(
        `Unable to generate the element ${elementNode.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        status: GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR,
        errorContext: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
        error,
      });
      return;
    }
    await updateTreeAfterGenerate(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
    if (await askToShowListing([elementNode.name])) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      });
      await printListingCommand(updatedElementNode);
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED,
      status: GenerateElementInPlaceCommandCompletedStatus.SUCCESS,
    });
  };

const complexGenerate =
  (service: Service) =>
  (element: Element) =>
  async (
    actionChangeControlValue: ActionChangeControlValue
  ): Promise<void | Error> => {
    const generateResult = await withNotificationProgress(
      `Generating the element: ${element.name}`
    )((progressReporter) =>
      generateElementInPlace(progressReporter)(service)(element)(
        actionChangeControlValue
      )()
    );
    if (isSignoutError(generateResult)) {
      logger.warn(
        `The element ${element.name} requires an override sign out action to generate the element.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
      });
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
        });
        return new Error(
          `The element ${element.name} is signed out to somebody else, an override signout action is not selected`
        );
      }
      const generateWithOverrideSignOut = withNotificationProgress(
        `Generating with override signout of the element: ${element.name}`
      )((progressReporter) =>
        generateElementInPlace(progressReporter)(service)(element)(
          actionChangeControlValue
        )({ overrideSignOut: true })
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return generateWithOverrideSignOut;
    }
    return generateResult;
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
      type: Actions.ELEMENT_GENERATED_IN_PLACE,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
