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

import {
  ChangeControlValue,
  Element,
  ElementMapPath,
  SubSystemMapPath,
  UpdateParams,
} from '@local/endevor/_doc/Endevor';
import { Uri } from 'vscode';
import { EndevorId } from '../store/_doc/v2/Store';
import { ComparedElementUriQuery, QueryTypes, Schemas } from './_doc/Uri';

type SerializedValue = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  elementTreePath: SubSystemMapPath;
  element: Element;
  fingerprint: string;
  uploadChangeControlValue: ChangeControlValue;
  uploadParameters: UpdateParams;
  uploadTargetLocation: ElementMapPath;
  remoteVersionTempFilePath: string;
}> & {
  type: QueryTypes;
};

export const toComparedElementUri =
  (elementFileSystemPath: string) =>
  (uriQuery: ComparedElementUriQuery): Uri | Error => {
    try {
      const emptyUri = Uri.parse('');
      const query: SerializedValue = {
        type: QueryTypes.COMPARED_ELEMENT,
        serviceId: uriQuery.initialSearchContext.serviceId,
        searchLocationId: uriQuery.initialSearchContext.searchLocationId,
        element: uriQuery.element,
        fingerprint: uriQuery.fingerprint,
        uploadChangeControlValue: uriQuery.uploadChangeControlValue,
        uploadParameters: uriQuery.uploadParameters,
        uploadTargetLocation: uriQuery.uploadTargetLocation,
        elementTreePath: uriQuery.initialSearchContext.initialSearchLocation,
        remoteVersionTempFilePath: uriQuery.remoteVersionTempFilePath,
      };
      return emptyUri.with({
        scheme: Schemas.FILE,
        path: elementFileSystemPath,
        query: encodeURIComponent(JSON.stringify(query)),
      });
    } catch (e) {
      return e;
    }
  };

export const isComparedElementUri = (
  uri: Uri
): {
  valid: boolean;
  message?: string;
} => {
  const expectedScheme = Schemas.FILE;
  const expectedType = QueryTypes.COMPARED_ELEMENT;
  const actualScheme = uri.scheme;
  if (actualScheme === expectedScheme) {
    let parsedQuery: SerializedValue;
    const decodedQuery: string = decodeURIComponent(uri.query);
    try {
      parsedQuery = JSON.parse(decodedQuery);
    } catch (e) {
      return {
        valid: false,
        message: `Uri has no valid query for compared elements to parse: ${decodedQuery}`,
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
      message: `Uri query type is incorrect for compared elements: ${actualType}, but should be: ${expectedType}`,
    };
  }
  return {
    valid: false,
    message: `Uri scheme is incorrect for compared elements: ${actualScheme}, but should be: ${expectedScheme}`,
  };
};

export const fromComparedElementUri = (
  uri: Uri
): ComparedElementUriQuery | Error => {
  const uriValidationResult = isComparedElementUri(uri);
  if (uriValidationResult.valid) {
    const serializedValue: SerializedValue = JSON.parse(
      decodeURIComponent(uri.query)
    );
    return {
      element: serializedValue.element,
      fingerprint: serializedValue.fingerprint,
      remoteVersionTempFilePath: serializedValue.remoteVersionTempFilePath,
      uploadChangeControlValue: serializedValue.uploadChangeControlValue,
      uploadParameters: serializedValue.uploadParameters,
      uploadTargetLocation: serializedValue.uploadTargetLocation,
      initialSearchContext: {
        serviceId: serializedValue.serviceId,
        searchLocationId: serializedValue.searchLocationId,
        initialSearchLocation: serializedValue.elementTreePath,
      },
    };
  }
  return new Error(uriValidationResult.message);
};
