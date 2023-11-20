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
  ResponseStatus,
  SuccessEndevorResponse as SuccessResponse,
} from '@local/endevor/_doc/Endevor';
import { ExternalConfigurationResponse } from './Configuration';

export const enum ErrorResponseType {
  GENERIC_ERROR = 'GENERIC_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR',
}
export type ErrorType = ErrorResponseType.GENERIC_ERROR;
export type ErrorResponse<E extends ErrorResponseType | undefined = undefined> =
  Readonly<{
    status: ResponseStatus.ERROR;
    type: (E extends undefined ? never : E) | ErrorType;
    details: Readonly<{
      messages: ReadonlyArray<string>;
    }>;
  }>;

export type Response<
  E extends ErrorResponseType | undefined = undefined,
  R = undefined
> = SuccessResponse<R> | ErrorResponse<E>;

export type ConfigurationResponse = Response<
  ErrorResponseType.IMPORT_ERROR,
  ExternalConfigurationResponse
>;
