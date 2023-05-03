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

// eventually replace this with Request and Response format of `fetch` API
export interface MockRequest<T> {
  method: 'GET' | 'PUT' | 'POST';
  path: string;
  query?: string;
  headers: {
    [key: string]: string;
  };
  params?: {
    [key: string]: string;
  };
  body: T;
}
export interface MockResponse<T> {
  status: number;
  statusMessage: string;
  headers: {
    [key: string]: string;
  };
  data: T;
}

export interface EndevorResponseData {
  returnCode: number;
  reasonCode: number;
  reports: Record<string, unknown>;
  data: Array<unknown>;
  messages: string[];
}
