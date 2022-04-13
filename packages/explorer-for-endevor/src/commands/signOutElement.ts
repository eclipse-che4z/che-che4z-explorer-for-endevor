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

import { signOutElement } from '../endevor';
import { logger, reporter } from '../globals';
import { isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import { Action, Actions } from '../_doc/Actions';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';
import {
  SignOutElementCommandCompletedStatus,
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';
import { isSignoutError } from '@local/endevor/utils';

type SelectedElementNode = ElementNode;

export const signOutElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode
) => {
  if (elementNode) {
    logger.trace(`Signout element command was called for ${elementNode.name}.`);
    await signOutSingleElement(dispatch)(elementNode);
  }
};

const signOutSingleElement =
  (dispatch: (action: Action) => Promise<void>) =>
  async (elementNode: ElementNode): Promise<void> => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to sign out the element ${elementNode.name}.`,
        `Unable to sign out the element ${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
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
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        'CCID and Comment must be specified to sign out an element.'
      );
      return;
    }
    const signOutResult = await withNotificationProgress(
      `Signing out the element: ${element.name}`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(element)({
        signoutChangeControlValue,
      })
    );
    if (isError(signOutResult)) {
      const error = signOutResult;
      logger.error(
        `Unable to sign out the element ${element.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED,
        status: isSignoutError(signOutResult)
          ? SignOutElementCommandCompletedStatus.SIGN_OUT_ERROR
          : SignOutElementCommandCompletedStatus.GENERIC_ERROR,
        error: signOutResult,
      });
      return;
    }
    await updateTreeAfterSuccessfulSignout(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED,
      status: SignOutElementCommandCompletedStatus.SUCCESS,
    });
    logger.info(`Element ${element.name} was signed out successfully!`);
  };

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    searchLocation: ElementSearchLocation,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
