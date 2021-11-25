/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import { logger } from '../globals';
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

type SelectedElementNode = ElementNode;

export const signOutElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode
) => {
  if (elementNode) {
    logger.trace(`Signout element command was called for ${elementNode.name}`);
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
        `Unable to signout the element ${elementNode.name}.`,
        `Unable to signout the element ${elementNode.name}, because parsing of the element's URI failed with error: ${error.message}`
      );
      return;
    }
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
      logger.error('CCID and Comment must be specified to signout an element.');
      return;
    }
    const signOutResult = await withNotificationProgress(
      `Signing out the element: ${element.name}`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(element)(
        signoutChangeControlValue
      )
    );
    if (isError(signOutResult)) {
      const error = signOutResult;
      logger.error(error.message);
      return;
    }
    await updateTreeAfterSuccessfulSignout(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
    logger.info(`${element.name} was signed out successfully!`);
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
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
