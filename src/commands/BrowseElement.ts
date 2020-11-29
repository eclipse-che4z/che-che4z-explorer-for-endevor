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
import { logger } from '../globals';

export async function browseElement(uri: vscode.Uri) {
  const keepExistingTabsInEditor = { preview: false };
  vscode.window.showTextDocument(uri, keepExistingTabsInEditor)
        .then(
          (_onSuccess: vscode.TextEditor) => {
              logger.info(`Browse command was submitted to content provider with uri: ${JSON.stringify(uri)}`);
          },
          (failureReason: string) => {
              logger.error(`Browse command was not submitted for reason: ${failureReason},
                please, see the output for uri: ${JSON.stringify(uri)}`);
            }
          );
}
