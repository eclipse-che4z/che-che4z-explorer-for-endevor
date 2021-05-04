/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { logger } from '../globals';
import { fromVirtualDocUri } from '../uri';
import { isError } from '../utils';
import { ElementNode, Node } from '../_doc/ElementTree';
import { printListingCommand } from './printListing';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = Node[];

export const generateElementCommand = async (
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes) {
    logger.error(`Generate action currently supports single elements only.`);
  } else if (elementNode) {
    logger.trace(`Generate command was called for ${elementNode.name}`);
    await generateSingleElement(elementNode);
  }
};

const generateSingleElement = async (
  elementNode: ElementNode
): Promise<void> => {
  const { service, element, endevorSearchLocation } = fromVirtualDocUri(
    elementNode.uri
  );
  const actionControlValue = await askForChangeControlValue({
    ccid: endevorSearchLocation.ccid,
    comment: endevorSearchLocation.comment,
  });
  if (dialogCancelled(actionControlValue)) {
    logger.error(
      'Element can be generated only with CCID and Comment specified'
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
  if (isError(generateResult)) {
    const error = generateResult;
    logger.error(error.message);
    await printListingCommand(elementNode);
    return;
  } else {
    logger.info('Generate successful!');
    if (await askToShowListing()) {
      await printListingCommand(elementNode);
    }
  }
};
