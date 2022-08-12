/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { askForServiceValue } from '../locations/endevorServiceDialogs';
import {
  mockAskForUrl,
  mockAskPassword,
  mockAskForUsername,
  mockAskForRejectUnauthorizedConnections,
} from '../_mocks/dialogs';
import {
  ServiceApiVersion,
  ServiceBasePath,
} from '@local/endevor/_doc/Endevor';
import * as sinon from 'sinon';

jest.mock('vscode', () => ({}), { virtual: true });
jest.mock(
  '../../globals',
  () => ({
    logger: {
      trace: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    reporter: {
      sendTelemetryEvent: jest.fn(),
    },
  }),
  { virtual: true }
);

describe('asking for service value', () => {
  // arrange
  const protocol = 'http';
  const hostname = 'test.com';
  const port = 22;
  const pathname = '/test/base/path/';
  const apiVersion = ServiceApiVersion.V2;
  const userName = 'fakeUser';
  // this isn't my mainframe password !!! DON'T TRY!
  const password = 'fakePass';

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
    jest.clearAllMocks();
  });

  it('should return proper location profile with base path provided by the user', async () => {
    // arrange
    const url = protocol + '://' + hostname + ':' + port + pathname;
    mockAskForRejectUnauthorizedConnections(false);
    mockAskForUrl(url);
    mockAskPassword(password);
    mockAskForUsername(userName);
    // act
    const result = await askForServiceValue(async () =>
      Promise.resolve(apiVersion)
    );
    // assert
    expect(result?.location.basePath).toEqual(pathname);
    expect(result?.location.port).toEqual(port);
    expect(result?.location.hostname).toEqual(hostname);
    expect(result?.location.protocol).toEqual(protocol);
  });

  it('should return proper location profile with default base path if none is provided by the user', async () => {
    // arrange
    const url = protocol + '://' + hostname + ':' + port;
    mockAskForRejectUnauthorizedConnections(false);
    mockAskForUrl(url);
    mockAskPassword(password);
    mockAskForUsername(userName);
    // act
    const result = await askForServiceValue(async () =>
      Promise.resolve(apiVersion)
    );
    // assert
    expect(result?.location.basePath).toEqual(ServiceBasePath.V2);
    expect(result?.location.port).toEqual(port);
    expect(result?.location.hostname).toEqual(hostname);
    expect(result?.location.protocol).toEqual(protocol);
  });
});
