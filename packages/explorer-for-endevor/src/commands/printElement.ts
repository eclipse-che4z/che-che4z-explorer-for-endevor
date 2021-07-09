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

import * as vscode from 'vscode';
import { showDocument as showElementContent } from '@local/vscode-wrapper/window';
import { getElementContent } from '../view/elementContentProvider';
import { logger } from '../globals';

export const printElement = async (elementUri: vscode.Uri) => {
  try {
    const elementContent = await getElementContent(elementUri);
    if (!elementContent.getText()) {
      return;
    }
    await showElementContent(elementContent);
  } catch (error) {
    logger.error(
      `Unable to print element ${elementUri.path} content`,
      `Unable to print element ${elementUri.path} content because of ${error.message}`
    );
    return;
  }
};
