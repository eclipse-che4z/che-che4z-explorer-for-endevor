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
import {
  Schemas,
  Extensions,
  ElementHistoryUriQuery,
  ElementChangeUriQuery,
  FragmentType,
} from '../_doc/Uri';

export const toElementHistoryUri =
  ({ serviceId, element, searchLocationId }: ElementHistoryUriQuery) =>
  (uniqueFragment: string): Uri | Error => {
    try {
      const elementFragment = { fragment: uniqueFragment };
      const emptyUri = Uri.parse('');
      return emptyUri.with({
        scheme: Schemas.ELEMENT_HISTORY,
        path: [element.name, Extensions.ELEMENT_HISTORY].join('.'),
        query: encodeURIComponent(
          JSON.stringify({
            serviceId,
            searchLocationId,
            element,
            elementFragment,
          })
        ),
        fragment: uniqueFragment,
      });
    } catch (e) {
      return e;
    }
  };

export const fromElementHistoryUri = (
  uri: Uri
): (ElementHistoryUriQuery & FragmentType) | Error => {
  const expectedScheme = Schemas.ELEMENT_HISTORY;
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

export const toElementChangeUri =
  ({ serviceId, element, searchLocationId, vvll }: ElementChangeUriQuery) =>
  (uniqueFragment: string): Uri | Error => {
    try {
      const emptyUri = Uri.parse('');
      return emptyUri.with({
        scheme: Schemas.ELEMENT_CHANGE_LVL,
        path: [element.name, vvll, Extensions.ELEMENT_CHANGE_LVL].join('.'),
        query: encodeURIComponent(
          JSON.stringify({
            serviceId,
            searchLocationId,
            element,
            vvll,
          })
        ),
        fragment: uniqueFragment,
      });
    } catch (e) {
      return e;
    }
  };

export const fromElementChangeUri = (
  uri: Uri
): (ElementChangeUriQuery & FragmentType) | Error => {
  // TODO: replace with validation in separated function
  const expectedScheme = Schemas.ELEMENT_CHANGE_LVL;
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
