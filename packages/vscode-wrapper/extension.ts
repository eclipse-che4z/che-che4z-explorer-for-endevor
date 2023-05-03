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
import * as semver from 'semver';

export const getExtensionApi = <T>(
  id: string,
  requiredVersion?: string
): T | undefined => {
  const extension = vscode.extensions.getExtension(id);
  if (!extension) return undefined;
  if (requiredVersion) {
    const extensionVersion = extension.packageJSON.version;
    if (
      semver.valid(extensionVersion) &&
      semver.valid(requiredVersion) &&
      !semver.gte(extensionVersion, requiredVersion)
    ) {
      return undefined;
    }
  }
  return extension.exports;
};
