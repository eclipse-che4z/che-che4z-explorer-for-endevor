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
import { ElementChangeUriQuery, FragmentType } from '../_doc/Uri';

export const toElementChangeUri =
  <T>(elementQuery: ElementChangeUriQuery<T>) =>
  (scheme: string) =>
  (uniqueFragment: string): Uri | Error => {
    try {
      const emptyUri = Uri.parse('');
      return emptyUri.with({
        scheme,
        path: [elementQuery.element.name, elementQuery.vvll, 'chng'].join('.'),
        query: encodeURIComponent(JSON.stringify(elementQuery)),
        fragment: uniqueFragment,
      });
    } catch (e) {
      return e;
    }
  };

export const fromElementChangeUri =
  <T>(uri: Uri) =>
  (scheme: string): (ElementChangeUriQuery<T> & FragmentType) | Error => {
    // TODO: replace with validation in separated function
    const expectedScheme = scheme;
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
