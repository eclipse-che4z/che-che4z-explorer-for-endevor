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

import { Uri } from 'vscode';
import { TreeElementUriQuery, Schemas, Extensions } from '../_doc/Uri';
import * as path from 'path';

export const toTreeElementUri =
  ({
    serviceId,
    element,
    searchLocationId,
    service,
    searchLocation,
  }: TreeElementUriQuery) =>
  (uniqueFragment: string): Uri | Error => {
    try {
      const emptyUri = Uri.parse('');
      return emptyUri.with({
        scheme: Schemas.TREE_ELEMENT,
        path: path.resolve(
          `/${[element.name, Extensions.TREE_ELEMENT].join('.')}`
        ),
        query: encodeURIComponent(
          JSON.stringify({
            serviceId,
            service,
            searchLocationId,
            element,
            searchLocation,
          })
        ),
        fragment: uniqueFragment,
      });
    } catch (e) {
      return e;
    }
  };
type FragmentType = {
  fragment: string;
};

export const withNewUniqueFragment =
  (treeElementUri: Uri) =>
  (uniqueFragment: string): Uri | Error => {
    // TODO: replace with validation in separated function
    const expectedScheme = Schemas.TREE_ELEMENT;
    const actualScheme = treeElementUri.scheme;
    if (actualScheme === expectedScheme) {
      return treeElementUri.with({
        fragment: uniqueFragment,
      });
    }
    return new Error(
      `Uri scheme is incorrect: ${actualScheme}, but should be: ${expectedScheme}`
    );
  };

export const fromTreeElementUri = (
  uri: Uri
): (TreeElementUriQuery & FragmentType) | Error => {
  // TODO: replace with validation in separated function
  const expectedScheme = Schemas.TREE_ELEMENT;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    return {
      ...JSON.parse(decodeURIComponent(uri.query)),
      fragment: uri.fragment,
    };
  }
  return new Error(
    `Uri scheme is incorrect: ${actualScheme}, but should be: ${expectedScheme}`
  );
};
