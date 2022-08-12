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
import { signInElement } from '../endevor';
import { logger, reporter } from '../globals';
import { fromTreeElementUri } from '../uri/treeElementUri';
import { isError } from '../utils';
import { ElementNode } from '../tree/_doc/ElementTree';
import { Action, Actions } from '../store/_doc/Actions';
import {
  SignInElementCommandCompletedStatus,
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';

type SelectedElementNode = ElementNode;

export const signInElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementNode: SelectedElementNode
) => {
  logger.trace(`Signin command was called for ${elementNode.name}.`);
  const uriParams = fromTreeElementUri(elementNode.uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to sign in the element ${elementNode.name}.`,
      `Unable to sign in the element ${elementNode.name} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED,
    commandArguments: {
      type: TreeElementCommandArguments.SINGLE_ELEMENT,
    },
  });
  const { serviceId, searchLocationId, service, element } = uriParams;
  const signInResult = await withNotificationProgress(
    `Signing in the element: ${element.name}`
  )((progressReporter) => signInElement(progressReporter)(service)(element));
  if (isError(signInResult)) {
    const error = signInResult;
    logger.error(
      `Unable to sign in the element ${elementNode.name}.`,
      `${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED,
      status: SignInElementCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  dispatch({
    type: Actions.ELEMENT_SIGNED_IN,
    serviceId,
    searchLocationId,
    element,
  });
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED,
    status: SignInElementCommandCompletedStatus.SUCCESS,
  });
  logger.info(`Element ${element.name} was signed in successfully!`);
};
