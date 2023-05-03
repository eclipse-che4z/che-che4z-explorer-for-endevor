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

import { logger } from '../../globals';
import * as path from 'path';
import { showFileContent } from '@local/vscode-wrapper/window';
import { SourceControlResourceState } from 'vscode';
import { stringifyPretty } from '@local/endevor/utils';

export const openElementCommand = async (
  resourceStates: SourceControlResourceState[]
): Promise<void> => {
  logger.trace('Open element(s) command called.');
  if (!resourceStates) {
    logger.error(
      'Unable to open the element(s).',
      'Unable to open the element(s) because resource state(s) are undefined.'
    );
    return;
  }
  for (const resourceState of resourceStates) {
    const fileUri = resourceState.resourceUri;
    if (!fileUri) {
      logger.trace(
        `Unable to open the element because of a resource state incorrect format:\n${stringifyPretty(
          resourceState
        )}`
      );
      return;
    }
    const fileName = path.basename(fileUri.fsPath);
    try {
      await showFileContent(fileUri);
    } catch (error) {
      logger.warn(
        `Unable to open the element ${fileName}.`,
        `Unable to open the element ${fileName} because of error:\n${error.message}`
      );
    }
  }
};
