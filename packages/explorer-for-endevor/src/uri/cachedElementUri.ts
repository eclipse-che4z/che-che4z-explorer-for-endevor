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

import { Uri } from 'vscode';
import { Schemas } from '../_doc/Uri';

export const toCachedElementUri = (elementUri: Uri): Uri => {
  const uniqueFragment = Date.now().toString();
  return elementUri.with({
    scheme: Schemas.READ_ONLY_CACHED_ELEMENT,
    fragment: uniqueFragment,
  });
};
