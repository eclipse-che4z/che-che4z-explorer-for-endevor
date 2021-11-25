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

import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { signInElement } from '../endevor';
import { logger } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import { Action, Actions } from '../_doc/Actions';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

type SelectedElementNode = ElementNode;

export const signInElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode
) => {
  logger.trace(`Signin command was called for ${elementNode.name}`);
  await signInSingleElement(dispatch)(elementNode);
};

const signInSingleElement =
  (dispatch: (action: Action) => Promise<void>) =>
  async (elementNode: ElementNode): Promise<void> => {
    const uriParams = fromTreeElementUri(elementNode.uri);
    if (isError(uriParams)) {
      const error = uriParams;
      logger.error(
        `Unable to signin the element ${elementNode.name}.`,
        `Unable to signin the element ${elementNode.name}, because parsing of the element's URI failed with error: ${error.message}`
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
    const signInResult = await withNotificationProgress(
      `Signing in the element: ${element.name}`
    )((progressReporter) => signInElement(progressReporter)(service)(element));
    if (isError(signInResult)) {
      const error = signInResult;
      logger.error(error.message);
      return;
    }
    await updateTreeAfterSuccessfulSignin(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
    logger.info(`${element.name} was signed in successfully!`);
  };

const updateTreeAfterSuccessfulSignin =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    searchLocation: ElementSearchLocation,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNEDIN,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
