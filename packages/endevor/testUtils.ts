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
    return mockRuleBuilder
      .withHeaders(req.headers)
      .thenReply(
        res.status,
        res.statusMessage,
        typeof res.data == 'string' ? res.data : JSON.stringify(res.data),
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
      return mockServer.get(absoluteUri);
    case 'PUT':
      return mockServer.put(absoluteUri);
    case 'POST':
      return mockServer.post(absoluteUri);
    default:
      throw new UnreachableCaseError(method);
  }
};
