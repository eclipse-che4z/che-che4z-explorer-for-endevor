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
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { URI_SCHEME_ELEMENT, URI_SCHEME_LISTING } from './constants';

interface UriQuery {
  service: Service;
  element: Element;
  endevorSearchLocation: ElementSearchLocation;
}

export const toVirtualDocUri = (scheme: string) => ({
  service,
  element,
  endevorSearchLocation,
}: UriQuery): Uri => {
  if (scheme === URI_SCHEME_ELEMENT) {
    return Uri.parse('').with({
      scheme: `${URI_SCHEME_ELEMENT}`,
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
      scheme: `${URI_SCHEME_LISTING}`,
      // `path` is used to show nice file label in text editor
      path: `/${element.name}.${element.type.toLowerCase()}`,
      query: JSON.stringify({
        service,
        element,
      }),
    });
  }
};

export const fromVirtualDocUri = (uri: Uri): UriQuery => {
  return JSON.parse(uri.query);
};
