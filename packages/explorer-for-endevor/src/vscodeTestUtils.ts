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

import * as vscode from 'vscode';
import { Extension } from '@local/extension/_doc/Extension';

// Test utilities that require `vscode` module

const extensionId = 'broadcomMFD.explorer-for-endevor';

export function getExtension(): vscode.Extension<Extension> {
  const ext = vscode.extensions.getExtension<Extension>(extensionId);
  if (!ext) {
    throw new Error('Extension was not found.');
  }
  return ext;
}
