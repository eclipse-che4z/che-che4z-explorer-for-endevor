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

import { EndevorRestClient } from '@broadcom/endevor-for-zowe-cli/lib/api';
import { IMemberActionRequestOptions } from '@broadcom/endevor-for-zowe-cli/lib/api/elements/doc/IMemberActionRequestOptions';
import { ElementUtils } from '@broadcom/endevor-for-zowe-cli/lib/api/elements/ElementUtils';
import { RetrieveElement } from '@broadcom/endevor-for-zowe-cli/lib/api/elements/RetrieveElement';
import {
  ElmSpecDictionary,
  RetrieveElmDictionary,
} from '@broadcom/endevor-for-zowe-cli/lib/api/utils/doc/ActionArguments';
import { EndevorRestClientV1 } from '@broadcom/endevor-for-zowe-cli/lib/api/utils/EndevorRestClientV1';
import { EndevorRestUtils } from '@broadcom/endevor-for-zowe-cli/lib/api/utils/EndevorRestUtils';
import { Session } from '@zowe/imperative';
import { Value } from '../_doc/Endevor';

export class ProposedEndevorClient {
  /*
      TODO: Temporary code that uses directlly GET call for the Retrieve to 
      bypass error in the CLI compatibility layer that adds `noSignout`
      parameter for V1 based on the `signout` attribute.
      Should be removed once the bug is fixed in CLI
     */
  public static retrieveElement(session: Session) {
    return (configuration: Value) =>
      async (requestParams: ElmSpecDictionary & RetrieveElmDictionary) => {
        const elemDef = ElementUtils.setElementSpec(requestParams);
        /* eslint-disable  @typescript-eslint/no-explicit-any */
        const requestBody: any =
          RetrieveElement.setupRetrieveRequest(requestParams);
        if (EndevorRestUtils.isThisV1(session)) {
          if (EndevorRestClientV1.yesValues.includes(requestBody.signout))
            requestBody.noSignout = 'N';
          if (EndevorRestClientV1.noValues.includes(requestBody.signout))
            requestBody.noSignout = 'Y';
        }
        const response = await EndevorRestClient.getJSONtoQueryExpectSTREAM(
          session,
          ElementUtils.setElementRequestURI(configuration, elemDef),
          requestBody,
          '2.0'
        );
        return response;
      };
  }

  /*
      TODO: Temporary code that uses directlly GET call for the Retrieve to 
      bypass error in the CLI compatibility layer that adds `noSignout`
      parameter for V1 based on the `signout` attribute.
      Should be removed once the bug is fixed in CLI
     */
  public static listDirectory(session: Session) {
    return (configuration: Value) =>
      async (requestParams: IMemberActionRequestOptions) => {
        const response = await EndevorRestClient.getJSONtoQueryExpectJSON(
          session,
          configuration + '/directory',
          requestParams,
          '2.0'
        );
        return response;
      };
  }
}
