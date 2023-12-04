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

import { MockedEndpoint, Mockttp } from 'mockttp';
import { UnreachableCaseError } from './typeHelpers';
import { MockRequest, MockResponse } from '@local/endevor/_doc/MockServer';
import { RequestRuleBuilder } from 'mockttp/dist/rules/requests/request-rule-builder';

// Test utilities

export const mockEndpoint =
  <T, U>(req: MockRequest<T>, res: MockResponse<U>) =>
  (mockServer: Mockttp): Promise<MockedEndpoint> => {
    const mockRuleBuilder = createMockBuilder(mockServer, req.path, req.method);
    if (req.query) mockRuleBuilder.withExactQuery(req.query);
    // check only specified body values, ignoring extra values (if any)
    if (req.body) mockRuleBuilder.withJsonBodyIncluding(req.body);
    return mockRuleBuilder
      .withHeaders(req.headers)
      .thenReply(
        res.status,
        res.statusMessage,
        typeof res.data == 'string' || Buffer.isBuffer(res.data)
          ? res.data
          : JSON.stringify(res.data),
        res.headers
      );
  };

const createMockBuilder = (
  mockServer: Mockttp,
  absoluteUri: string,
  method: 'GET' | 'PUT' | 'POST'
): RequestRuleBuilder => {
  switch (method) {
    case 'GET':
      return mockServer.forGet(absoluteUri);
    case 'PUT':
      return mockServer.forPut(absoluteUri);
    case 'POST':
      return mockServer.forPost(absoluteUri);
    default:
      throw new UnreachableCaseError(method);
  }
};
