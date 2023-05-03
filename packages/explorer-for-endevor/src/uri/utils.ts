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
import { isError } from '../utils';
import { BasicElementUriQuery, Schemas } from '../_doc/Uri';
import { fromEditedElementUri } from './editedElementUri';
import {
  fromElementChangeUri,
  fromElementHistoryUri,
} from './elementHistoryUri';
import { fromElementListingUri } from './elementListingUri';
import { fromBasicElementUri } from './basicElementUri';

export const getElementParmsFromUri = (
  uri: Uri
): BasicElementUriQuery | Error => {
  switch (uri.scheme) {
    case Schemas.ELEMENT_LISTING:
      return fromElementListingUri(uri);
    case Schemas.ELEMENT_CHANGE_LVL:
      return fromElementChangeUri(uri);
    case Schemas.ELEMENT_HISTORY:
      return fromElementHistoryUri(uri);
    case Schemas.TREE_ELEMENT:
      return fromBasicElementUri(uri);
    case Schemas.FILE: {
      const uriParams = fromEditedElementUri(uri);
      if (isError(uriParams)) {
        return uriParams;
      }
      return {
        element: uriParams.element,
        serviceId: uriParams.searchContext.serviceId,
        searchLocationId: uriParams.searchContext.searchLocationId,
      };
    }
    default:
      break;
  }
  return new Error('Uri does not contain element data');
};
