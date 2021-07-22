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
import { EditedElementUriQuery, QueryTypes, Schemas } from '../_doc/Uri';

type SerializedValue = EditedElementUriQuery & {
  type: QueryTypes;
};

export const toEditedElementUri = (elementFileSystemPath: string) => ({
  element,
  service,
  searchLocation,
  fingerprint,
}: EditedElementUriQuery): Uri | Error => {
  try {
    const emptyUri = Uri.parse('');
    const query: SerializedValue = {
      service,
      element,
      searchLocation,
      type: QueryTypes.EDITED_ELEMENT,
      fingerprint,
    };
    return emptyUri.with({
      scheme: Schemas.FILE,
      path: elementFileSystemPath,
      query: JSON.stringify(query),
    });
  } catch (e) {
    return e;
  }
};

export const isEditedElementUri = (
  uri: Uri
): {
  valid: boolean;
  message?: string;
} => {
  const expectedScheme = Schemas.FILE;
  const expectedType = QueryTypes.EDITED_ELEMENT;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    let parsedQuery: SerializedValue;
    try {
      parsedQuery = JSON.parse(uri.query);
    } catch (e) {
      return {
        valid: false,
        message: `Uri has no valid query for edited elements to parse: ${uri.query}`,
      };
    }
    const actualType = parsedQuery.type;
    if (actualType === expectedType) {
      return {
        valid: true,
      };
    }
    return {
      valid: false,
      message: `Uri query type is incorrect for edited elements: ${actualType}, but should be: ${expectedType}`,
    };
  }
  return {
    valid: false,
    message: `Uri scheme is incorrect for edited elements: ${actualScheme}, but should be: ${expectedScheme}`,
  };
};

export const fromEditedElementUri = (
  uri: Uri
): EditedElementUriQuery | Error => {
  const uriValidationResult = isEditedElementUri(uri);
  if (uriValidationResult.valid) {
    return JSON.parse(uri.query);
  }
  return new Error(uriValidationResult.message);
};
