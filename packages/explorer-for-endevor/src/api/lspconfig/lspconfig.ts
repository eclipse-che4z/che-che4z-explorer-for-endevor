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

import { isError, toUrl } from '../../utils';
import { make as makeLspConfigApi } from './wasmapi';
import { RequestInfo, RequestInit, fetch } from 'undici';
import { EndevorAuthorizedService } from '../_doc/Endevor';
import { ElementMapPath, ResponseStatus } from '@local/endevor/_doc/Endevor';
import { ProgressReporter } from '@local/vscode-wrapper/_doc/window';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { ConfigurationResponse, ErrorResponseType } from './_doc/Endevor';

export const getConfiguration =
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (configParams: ElementMapPath) =>
  async (
    printProc: boolean = true,
    trace: boolean = false
  ): Promise<ConfigurationResponse> => {
    const wasmApi = await makeLspConfigApi();
    if (isError(wasmApi)) {
      const error = wasmApi;
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.IMPORT_ERROR,
        details: {
          messages: [error.message],
        },
      };
    }
    let fetcher = {
      fetch,
    };
    let user;
    let password;
    if (service.credential.type !== CredentialType.BASE) {
      const tokenValue = service.credential.tokenValue;
      (user = ''), (password = '');
      fetcher = {
        fetch: (input: RequestInfo, init?: RequestInit) => {
          return fetch(input, {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: 'Bearer ' + tokenValue,
            },
          });
        },
      };
    } else {
      user = service.credential.user;
      password = service.credential.password;
    }

    progress.report({ increment: 30 });
    let response;
    try {
      response = await wasmApi.lspConfig(
        {
          url: toUrl(service.location),
          instance: service.configuration,
          environment: configParams.environment,
          stage: Number(configParams.stageNumber),
          system: configParams.system,
          subsystem: configParams.subSystem,
          type: configParams.type,
          element: configParams.id,
          user,
          password,
          printProc,
          trace,
        },
        fetcher
      );
    } catch (error) {
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: [error.message],
        },
      };
    }
    progress.report({ increment: 100 });
    return {
      status: ResponseStatus.OK,
      result: response,
    };
  };
