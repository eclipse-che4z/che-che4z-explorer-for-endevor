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

import { RequestInfo, RequestInit } from 'undici';
import { ExternalConfigurationResponse } from './Configuration';

export type LspConfigApi = {
  lspConfig: (
    request: {
      url: string;
      instance: string;
      environment: string;
      stage: number;
      system: string;
      subsystem: string;
      type: string;
      element: string;
      user: string;
      password: string;
      printProc: boolean;
      trace: boolean;
    },
    fetcher: {
      fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    }
  ) => Promise<ExternalConfigurationResponse>;
};
