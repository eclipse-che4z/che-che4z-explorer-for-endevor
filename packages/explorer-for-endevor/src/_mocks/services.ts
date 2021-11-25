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

import * as services from '../services/services';
import * as sinon from 'sinon';
import { Service } from '@local/endevor/_doc/Endevor';
import { Credential } from '@local/endevor/_doc/Credential';

type GetEndevorServiceByNameStub = sinon.SinonStub<
  [
    name: string,
    resolveCredential: (
      credential: Credential | undefined
    ) => Promise<Credential | undefined>
  ],
  Promise<Service | undefined>
>;

export const mockGetEndevorServiceByName =
  (name: string) =>
  (mockResult: Service): GetEndevorServiceByNameStub => {
    return sinon
      .stub(services, 'getEndevorServiceByName')
      .withArgs(name, sinon.match.any)
      .resolves(mockResult);
  };
