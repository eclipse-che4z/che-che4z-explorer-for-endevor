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
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { Schemas } from './_doc/Uri';

interface UriQuery {
  service: Service;
  element: Element;
  endevorSearchLocation: ElementSearchLocation;
}

/**
 * @deprecated
 * please, use more specific uri functions from uri folder instead
 */
export const toVirtualDocUri =
  (scheme: string) =>
  ({ service, element, endevorSearchLocation }: UriQuery): Uri => {
    if (scheme === Schemas.TREE_ELEMENT) {
      return Uri.parse('').with({
        scheme: `${Schemas.TREE_ELEMENT}`,
        // `path` is used to show nice file label in text editor
        path: `/${element.name}.${element.type.toLowerCase()}`,
        query: JSON.stringify({
          service,
          element,
          endevorSearchLocation,
        }),
      });
    } else {
      return Uri.parse('').with({
        scheme: `${Schemas.ELEMENT_LISTING}`,
        // `path` is used to show nice file label in text editor
        path: `/${element.name}.${element.type.toLowerCase()}`,
        query: JSON.stringify({
          service,
          element,
        }),
      });
    }
  };

/**
 * @deprecated
 * please, use more specific uri functions from uri folder instead
 */
export const fromVirtualDocUri = (uri: Uri): UriQuery => {
  return JSON.parse(uri.query);
};
