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

import { Uri } from 'vscode';
import { TreeElementUriQuery, Schemas } from '../_doc/Uri';

export const toTreeElementUri = ({
  element,
  service,
  searchLocation,
}: TreeElementUriQuery): Uri | Error => {
  try {
    const emptyUri = Uri.parse('');
    return emptyUri.with({
      scheme: Schemas.TREE_ELEMENT,
      path: `/${element.name}.${element.type.toLowerCase()}`,
      query: JSON.stringify({
        service,
        element,
        searchLocation,
      }),
    });
  } catch (e) {
    return e;
  }
};

export const fromTreeElementUri = (uri: Uri): TreeElementUriQuery | Error => {
  // TODO: replace with validation in separated function
  const expectedScheme = Schemas.TREE_ELEMENT;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    return JSON.parse(uri.query);
  }
  return new Error(
    `Uri scheme is incorrect: ${actualScheme}, but should be: ${expectedScheme}`
  );
};
