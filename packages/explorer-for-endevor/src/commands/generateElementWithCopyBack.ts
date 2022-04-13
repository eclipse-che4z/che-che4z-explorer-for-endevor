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
  dialogCancelled as changeControlDialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation,
  dialogCancelled as generateLocationCancelled,
} from '../dialogs/locations/endevorUploadLocationDialogs';
import { askToShowListing } from '../dialogs/listings/showListingDialogs';
import { generateElementWithCopyBack } from '../endevor';
import { logger, reporter } from '../globals';
import { fromTreeElementUri, toTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import { printListingCommand } from './printListing';
import { Action, Actions } from '../_doc/Actions';
import {
  Element,
  ElementSearchLocation,
  GenerateWithCopyBackParams,
  ActionChangeControlValue,
  ElementMapPath,
  SubSystemMapPath,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toSearchLocationId } from '../tree/endevor';
import {
  TelemetryEvents,
  GenerateWithCopyBackCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../_doc/telemetry/v2/Telemetry';
import { ANY_VALUE } from '@local/endevor/const';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';
import {
  isProcessorStepMaxRcExceededError,
  isSignoutError,
} from '@local/endevor/utils';

type SelectedElementNode = ElementNode;

export const generateElementWithCopyBackCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode,
  noSource: GenerateWithCopyBackParams['noSource']
) => {
  logger.trace(
    `Generate with copy back command was called for ${elementNode.name}.`
  );
  await generateSingleElementWithCopyBack(dispatch)(elementNode)(noSource);
};

const generateSingleElementWithCopyBack =
  (dispatch: (action: Action) => Promise<void>) =>
  (elementNode: ElementNode) =>
  async (noSource: GenerateWithCopyBackParams['noSource']) => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to generate with copying back the element ${elementNode.name}.`,
        `Unable to generate with copying back the element ${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
      noSource: noSource ? noSource : false,
    });
    const {
      serviceName,
      searchLocationName,
      service,
      element,
      searchLocation,
    } = uriParams;
    const generateWithCopyBackValues = await askForGenerateWithCopyBackValues(
      searchLocation,
      element
    );
    if (isError(generateWithCopyBackValues)) {
      const error = generateWithCopyBackValues;
      logger.error(`${error.message}.`);
      return;
    }
    const [targetLocation, actionChangeControlValue] =
      generateWithCopyBackValues;
    const copiedBackElement: Element = {
      ...targetLocation,
      extension: element.extension,
    };
    const treePath: SubSystemMapPath = {
      environment: targetLocation.environment,
      stageNumber: targetLocation.stageNumber,
      subSystem: elementNode.parent.parent.name,
      system: elementNode.parent.parent.parent.name,
    };
    let updatedElementUri = toTreeElementUri({
      serviceName,
      element: copiedBackElement,
      searchLocationName,
      service,
      searchLocation,
    })(Date.now().toString());
    if (isError(updatedElementUri)) {
      const error = updatedElementUri;
      logger.warn(
        `Unable to update the element ${elementNode.name} URI.`,
        `Unable to update the element ${elementNode.name} URI because of error ${error.message}.`
      );
      updatedElementUri = elementNode.uri;
    }
    const generatedElementNode: SelectedElementNode = {
      searchLocationId: toSearchLocationId(serviceName)(searchLocationName),
      type: isElementInSearchLocation(copiedBackElement)(treePath)
        ? 'ELEMENT_IN_PLACE'
        : 'ELEMENT_UP_THE_MAP',
      name: copiedBackElement.name,
      parent: elementNode.parent,
      uri: updatedElementUri,
    };
    const generateResult = await complexGenerateWithCopyBack(
      service,
      targetLocation
    )(element)(actionChangeControlValue)({ noSource });
    if (isProcessorStepMaxRcExceededError(generateResult)) {
      // consider errors in the element processing as a success too (a part of the expected developer workflow)
      const error = generateResult;
      logger.error(
        `The element ${elementNode.name} is generated unsuccessfully. Please review the listing.`,
        `${error.message}.`
      );
      if (isElementInSearchLocation(copiedBackElement)(treePath)) {
        await dispatch({
          type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
          fetchElementsArgs: { service, searchLocation },
          targetLocation,
          pathUpTheMap: element,
          treePath: {
            serviceName,
            searchLocationName,
            searchLocation: treePath,
          },
        });
        await printListingCommand(generatedElementNode);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
          status:
            GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION,
        });
      } else {
        await dispatch({
          type: Actions.ELEMENT_GENERATED_IN_PLACE,
          searchLocationName,
          serviceName,
          searchLocation,
          service,
          elements: [element],
        });
        await printListingCommand(generatedElementNode);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
          status:
            GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION,
        });
      }
      return;
    }
    if (isError(generateResult)) {
      const error = generateResult;
      logger.error(
        `Unable to generate with copying back the element ${elementNode.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        status: GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR,
        errorContext:
          TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
        error,
      });
      return;
    }
    if (isElementInSearchLocation(copiedBackElement)(treePath)) {
      await dispatch({
        type: Actions.ELEMENT_GENERATED_WITH_COPY_BACK,
        fetchElementsArgs: { service, searchLocation },
        targetLocation,
        pathUpTheMap: element,
        treePath: {
          serviceName,
          searchLocationName,
          searchLocation: treePath,
        },
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
        status:
          GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION,
      });
    } else {
      await dispatch({
        type: Actions.ELEMENT_GENERATED_IN_PLACE,
        searchLocationName,
        serviceName,
        searchLocation,
        service,
        elements: [element],
      });
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
        status:
          GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION,
      });
    }
    if (await askToShowListing([copiedBackElement.name])) {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL,
        context:
          TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED,
      });
      await printListingCommand(generatedElementNode);
    }
  };

const complexGenerateWithCopyBack =
  (service: Service, generateLocationValue: ElementMapPath) =>
  (element: Element) =>
  (actionChangeControlValue: ActionChangeControlValue) =>
  async (
    copyBackParams?: GenerateWithCopyBackParams
  ): Promise<void | Error> => {
    const generateResult = await withNotificationProgress(
      `Generating with copying back the element: ${generateLocationValue.name}`
    )((progressReporter) =>
      generateElementWithCopyBack(progressReporter)(service)(
        generateLocationValue
      )(actionChangeControlValue)(copyBackParams)()
    );
    if (isSignoutError(generateResult)) {
      logger.warn(
        `The element ${element.name} requires an override sign out action to generate the element.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
      });
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context:
            TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.CANCELLED,
        });
        return new Error(
          `The element ${element.name} is signed out to somebody else, an override signout action is not selected`
        );
      }
      const generateWithOverrideSignOut = withNotificationProgress(
        `Generating with copying back and override signout of the element: ${element.name}`
      )((progressReporter) =>
        generateElementWithCopyBack(progressReporter)(service)(element)(
          actionChangeControlValue
        )(copyBackParams)({ overrideSignOut: true })
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return generateWithOverrideSignOut;
    }
    return generateResult;
  };

const askForGenerateWithCopyBackValues = async (
  searchLocation: ElementSearchLocation,
  element: Element
): Promise<[ElementMapPath, ActionChangeControlValue] | Error> => {
  const type =
    searchLocation.type && searchLocation.type !== ANY_VALUE
      ? searchLocation.type
      : element.type;
  const generateLocation = await askForUploadLocation({
    environment: searchLocation.environment,
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system,
    subsystem: searchLocation.subsystem,
    type,
    element: element.name,
    instance: element.instance,
  });
  if (generateLocationCancelled(generateLocation)) {
    return new Error(
      `Target location must be specified to generate with copying back the element ${element.name}`
    );
  }
  const generateChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(generateChangeControlValue)) {
    return new Error(
      `CCID and Comment must be specified to generate with copying back the element ${generateLocation.name}`
    );
  }
  return [generateLocation, generateChangeControlValue];
};

const isElementInSearchLocation =
  (element: Element) =>
  (treePath: SubSystemMapPath): boolean => {
    return (
      element.environment === treePath.environment &&
      element.stageNumber === treePath.stageNumber &&
      element.subSystem === treePath.subSystem &&
      element.system === treePath.system
    );
  };
