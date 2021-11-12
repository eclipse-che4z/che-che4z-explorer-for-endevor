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

import { Uri } from 'vscode';
import { ElementListingUriQuery, Schemas } from '../_doc/Uri';

export const toElementListingUri = ({
  element,
  service,
}: ElementListingUriQuery): Uri | Error => {
  try {
    const emptyUri = Uri.parse('');
    return emptyUri.with({
      scheme: Schemas.ELEMENT_LISTING,
      path: `${element.name}-LISTING`,
      query: JSON.stringify({
        service,
        element,
      }),
    });
  } catch (e) {
    return e;
  }
};

export const fromElementListingUri = (
  uri: Uri
): ElementListingUriQuery | Error => {
  // TODO: replace with validation in separated function
  const expectedScheme = Schemas.ELEMENT_LISTING;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    return JSON.parse(uri.query);
  }
  return new Error(
    `Uri scheme is incorrect: ${actualScheme}, but should be: ${expectedScheme}`
  );
};
