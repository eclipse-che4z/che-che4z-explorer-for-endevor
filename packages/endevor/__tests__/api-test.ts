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

/* eslint-disable jest/no-commented-out-tests */
import { Logger } from '@local/extension/_doc/Logger';
import { getLocal } from 'mockttp';
import { join } from 'path';
import { URL } from 'url';
import { ANY_VALUE } from '../const';
import {
  getInstanceNames,
  printElement,
  printListing,
  searchForElements,
  signInElement,
  updateElement,
  addElement,
  getAllEnvironmentStages,
  getAllSystems,
  getAllSubSystems,
  generateElementInPlace,
  generateElementWithCopyBack,
} from '../endevor';
import { mockEndpoint } from '../testUtils';
import {
  isError,
  isProcessorStepMaxRcExceededError,
  isSignoutError,
  toEndevorProtocol,
  toVersion2Api,
} from '../utils';
import { BaseCredential, CredentialType } from '../_doc/Credential';
import {
  ActionChangeControlValue,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  ElementWithFingerprint,
  ServiceLocation,
  EnvironmentStage,
  SubSystem,
  System,
  GenerateWithCopyBackParams,
} from '../_doc/Endevor';
import { MockRequest, MockResponse } from '../_doc/MockServer';
import { ProgressReporter } from '../_doc/Progress';
import { Elements } from '../_ext/Endevor';

jest.mock('@zowe/imperative/lib/console/src/Console'); // disable imperative logging

// logging, progress bars and rejectUnauthorized are not covered in these tests
const logger: Logger = {
  trace: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; // disable logging

const progress: ProgressReporter = {
  report: jest.fn(),
}; // disable progress bar

// mock values
const rejectUnauthorized = false;
const basePath = '/EndevorService/rest/';

// set up mock server
const mockServer = getLocal();
beforeEach(async () => {
  await mockServer.start();
  mockServer.enableDebug();
});
afterEach(() => mockServer.stop());

const toBase64 = ({ user, password }: BaseCredential): string => {
  return Buffer.from(`${user}:${password}`, 'binary').toString('base64');
};

describe('endevor public API', () => {
  describe('fetching instances', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: toVersion2Api(basePath),
      headers: {},
      body: null,
    };

    it('should return filtered instances', async () => {
      // arrange
      const invalidInstances = ['INST3'];
      const validInstances = ['INST1', 'INST2'];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: [
          ...validInstances.map((instanceName) => {
            const repository = {
              name: instanceName,
            };
            return repository;
          }),
          ...invalidInstances.map((instanceName) => {
            const invalidRepo = {
              naMe: instanceName,
            };
            return invalidRepo;
          }),
        ],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port, pathname } = new URL(
        mockServer.urlFor(toVersion2Api(basePath))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: pathname,
      };
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualInstances).toEqual(validInstances);
    });

    it('should return filtered instances for v1 Endevor API base path', async () => {
      // arrange
      const invalidInstances = ['INST3'];
      const validInstances = ['INST1', 'INST2'];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: [
          ...validInstances.map((instanceName) => {
            const repository = {
              name: instanceName,
            };
            return repository;
          }),
          ...invalidInstances.map((instanceName) => {
            const invalidRepo = {
              naMe: instanceName,
            };
            return invalidRepo;
          }),
        ],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toVersion2Api(basePath))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualInstances).toEqual(validInstances);
    });

    it('should return empty list of instances for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath,
      };
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(actualInstances).toEqual([]);
    });

    it('should return empty list of instances if something went wrong in Endevor side', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          realData: ["I'm not sure it is real data, but I'm okay here"],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port, pathname } = new URL(
        mockServer.urlFor(toVersion2Api(basePath))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: pathname,
      };
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualInstances).toEqual([]);
    });
  });

  describe('fetching all systems', () => {
    const toRequestPath =
      (basePath: string) =>
      (instance: string): string => {
        return join(
          basePath,
          instance,
          'env',
          ANY_VALUE,
          'stgnum',
          ANY_VALUE,
          'sys',
          ANY_VALUE
        );
      };
    it('should return the list of all filtered systems', async () => {
      // arrange
      const instanceName = 'TEST';
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instanceName),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSystems: ReadonlyArray<System> = [
        {
          environment: 'TEST',
          stageNumber: '1',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST1',
          stageNumber: '1',
          system: 'TEST-SYS2',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const invalidSystems: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST1',
          stageNumber: '1',
          system: 'TEST-SYS2',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validSystems.map((system) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgSeqNum: system.stageNumber,
                nextSys: system.nextSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSystems.map((system: any) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgSeqNum: system.stageNumber,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(instanceName))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instanceName);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSystems).toEqual(validSystems);
    });
    it('should return the list of all filtered systems for v1 Endevor API base path', async () => {
      // arrange
      const instanceName = 'TEST';
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instanceName),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const expectedSystems: ReadonlyArray<System> = [
        {
          environment: 'TEST',
          stageNumber: '1',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST1',
          stageNumber: '1',
          system: 'TEST-SYS2',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...expectedSystems.map((system) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgSeqNum: system.stageNumber,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(instanceName))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instanceName);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSystems).toEqual(expectedSystems);
    });
    it('should return an error in case of incorrect (nonexisting) instance', async () => {
      // arrange
      const nonExistingInstance = 'TEST';
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(nonExistingInstance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal Server Error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 0,
          reports: null,
          messages: [
            `EWS1101E Configuration ${nonExistingInstance} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(nonExistingInstance))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(nonExistingInstance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });
    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const instanceName = 'TEST';
      const incorrectCredentials: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instanceName),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(incorrectCredentials)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(instanceName))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential: incorrectCredentials,
        location: serviceLocation,
        rejectUnauthorized,
      })(instanceName);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });
    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const instanceName = 'TEST';
      const credentials: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const nonExistingServiceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential: credentials,
        location: nonExistingServiceLocation,
        rejectUnauthorized,
      })(instanceName);
      // assert
      expect(isError(actualSystems)).toBe(true);
    });
    it('should return an error if something went wrong on the Endevor side', async () => {
      // arrange
      const instanceName = 'TEST';
      const credentials: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instanceName),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credentials)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 20,
          reports: null,
          messages: ['Very important Endevor error'],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(instanceName))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSystems = await getAllSystems(logger)(progress)({
        credential: credentials,
        location: serviceLocation,
        rejectUnauthorized,
      })(instanceName);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });
  });

  describe('fetching all subsystems', () => {
    const instance = 'TEST-INST';
    const toRequestPath =
      (basePath: string) =>
      (instance: string): string => {
        return join(
          basePath,
          instance,
          'env',
          ANY_VALUE,
          'stgnum',
          ANY_VALUE,
          'sys',
          ANY_VALUE,
          'subsys',
          ANY_VALUE
        );
      };

    it('should return the list of all filtered subsystems', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystem> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageNumber: '1',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const invalidSubSystems: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageNumber: '2',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validSubSystems.map((subsystem) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.subSystem,
                stgSeqNum: parseInt(subsystem.stageNumber),
                nextSbs: subsystem.nextSubSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSubSystems.map((subsystem: any) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.subSystem,
                stgSeqNum: parseInt(subsystem.stageNumber),
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(instance))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSubSystems).toEqual(validSubSystems);
    });

    it('should return the list of all filtered subsystems for v1 Endevor API base path', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystem> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageNumber: '1',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const invalidSubSystems: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageNumber: '2',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validSubSystems.map((subsystem) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.subSystem,
                stgSeqNum: parseInt(subsystem.stageNumber),
                nextSbs: subsystem.nextSubSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSubSystems.map((subsystem: any) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.name,
                stgSeqNum: parseInt(subsystem.stageNumber),
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(instance))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSubSystems).toEqual(validSubSystems);
    });

    it('should return an error in case of incorrect (nonexisting) instance', async () => {
      // arrange
      const nonExistingInstance = 'TEST';
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(nonExistingInstance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal Server Error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 0,
          reports: null,
          messages: [
            `EWS1101E Configuration ${nonExistingInstance} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(nonExistingInstance))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(nonExistingInstance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(instance))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const randomLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: randomLocation,
        rejectUnauthorized,
      })(instance);
      // assert
      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(instance),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const invalidResponse: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(instance))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });
  });

  describe('searching elements', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        instance,
        environment,
        stageNumber,
        system,
        subsystem,
        type,
        element,
      }: ElementSearchLocation): string => {
        return join(
          basePath,
          instance,
          'env',
          environment ?? ANY_VALUE,
          'stgnum',
          stageNumber ?? ANY_VALUE,
          'sys',
          system ?? ANY_VALUE,
          'subsys',
          subsystem ?? ANY_VALUE,
          'type',
          type ?? ANY_VALUE,
          'ele',
          element ?? ANY_VALUE
        );
      };

    it('should return filtered elements', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL1',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          instance: 'TEST-INST',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          instance: 'TEST-INST',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElements.map((element) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidElements.map((element: any) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return filtered elements for partially specified search location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        // system: 'TEST-SYS',
        // subsystem: 'TEST-SBS',
        // type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL1',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          instance: 'TEST-INST',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          instance: 'TEST-INST',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElements.map((element) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidElements.map((element: any) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return elements with proper extensions', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const elementsWithEndevorExtension: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL1',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'test-ext1',
          instance: 'TEST-INST',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'test-ext2',
          instance: 'TEST-INST',
        },
      ];
      const elementsWithTypeExtension: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL1',
          type: 'TEST-TYPE1',
          stageNumber: '1',
          extension: 'test-type1',
          instance: 'TEST-INST',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE2',
          stageNumber: '1',
          extension: 'test-type2',
          instance: 'TEST-INST',
        },
      ];
      const expectedElements = elementsWithEndevorExtension.concat(
        elementsWithTypeExtension
      );
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...elementsWithEndevorExtension.map((element) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension.toUpperCase(),
              };
            }),
            ...elementsWithTypeExtension.map((element) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(expectedElements);
    });

    // TODO
    // it('should return filtered elements for search location with any environment', async () => {});
    it('should return an error for incorrect search location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const wrongLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(wrongLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const emptyElementsList: Elements = [];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 4,
          reasonCode: 3,
          reports: {},
          messages: [],
          data: emptyElementsList,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(wrongLocation))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(wrongLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });

    it('should return filtered elements for v1 Endevor API base path', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL1',
          type: 'TEST-TYPE',
          stageNumber: '1',
          instance: 'TEST-INST',
          extension: 'test-type',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          instance: 'TEST-INST',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElements.map((element) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidElements.map((element: any) => {
              return {
                envName: element.environment,
                sysName: element.system,
                sbsName: element.subSystem,
                elmName: element.name,
                typeName: element.type,
                stgNum: element.stageNumber,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const randomLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: randomLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const invalidResponse: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });
  });

  describe('printing elements', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        instance,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          instance,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system,
          'subsys',
          subSystem,
          'type',
          type,
          'ele',
          name
        );
      };

    it('should return element content with history', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const content = 'very important content';
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return element content with history for v1 Endevor API base path', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const content = 'very important content';
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: v1BasePath,
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '20',
          reasonCode: '34',
          reports: null,
          data: [],
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for partially specified element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: [],
          messages: [
            'EWS1216E Wildcarded element name is not supported for this action',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const invalidElement: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        name: 'ELM',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(invalidElement),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '4',
          reasonCode: '0',
          reports: {
            C1MSGS1: '/reports/1621956951-160920989-C1MSGS1',
          },
          data: [],
          messages: [
            '11:35:51  C1G0208W  ELEMENT NOT FOUND FOR SYNTAX STATEMENT #1',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(invalidElement)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });
  });

  describe('printing element listings', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        instance,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          instance,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system,
          'subsys',
          subSystem,
          'type',
          type,
          'ele',
          name
        );
      };

    it('should return element listing', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const content = 'very important content';
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return element listing for v1 Endevor API base path', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const content = 'very important content';
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: v1BasePath,
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '20',
          reasonCode: '34',
          reports: null,
          data: [],
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for partially specified element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: [],
          messages: [
            'EWS1216E Wildcarded element name is not supported for this action',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const invalidElement: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        name: 'ELM',
        extension: 'ext',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(invalidElement),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '4',
          reasonCode: '0',
          reports: {
            C1MSGS1: '/reports/1621956951-160920989-C1MSGS1',
          },
          data: [],
          messages: [
            '11:35:51  C1G0208W  ELEMENT NOT FOUND FOR SYNTAX STATEMENT #1',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(invalidElement)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const requestQuery = '?print=LISTING';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualContent = await printListing(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });
  });

  describe('signing in an element', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        instance,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          instance,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system,
          'subsys',
          subSystem,
          'type',
          type,
          'ele',
          name
        );
      };

    it('should sign in an element', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0',
          reasonCode: '0',
          reports: {
            APIMSGS: '/reports/1631287369-1243603095386082-APIMSGS',
            C1MSGS1: '/reports/1631287369-1243603095386082-C1MSGS1',
          },
          data: [],
          messages: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(signInResponse).toBeUndefined();
    });

    it('should sign in an element for v1 Endevor API base path', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0',
          reasonCode: '0',
          reports: {
            APIMSGS: '/reports/1631287369-1243603095386082-APIMSGS',
            C1MSGS1: '/reports/1631287369-1243603095386082-C1MSGS1',
          },
          data: [],
          messages: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(signInResponse).toBeUndefined();
    });

    it('should return error for trying to sign in a not signed out element', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '4',
          reasonCode: '0',
          reports: {
            APIMSGS: '/reports/1631384702-0836720775451138-APIMSGS',
            C1MSGS1: '/reports/1631384702-0836720775451138-C1MSGS1',
          },
          data: [],
          messages: [
            'C1G0172W  EXPLICIT SIGN-IN NOT PERFORMED, ELEMENT IS CURRENTLY NOT SIGNED-OUT',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: v1BasePath,
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect base credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM1',
        extension: 'ext',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '20',
          reasonCode: '34',
          reports: null,
          data: [],
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for partially specified element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: [],
          messages: [
            'EWS1216E Wildcarded element name is not supported for this action',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const invalidElement: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        name: 'ELM',
        extension: 'ext',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(invalidElement),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '4',
          reasonCode: '0',
          reports: {
            C1MSGS1: '/reports/1621956951-160920989-C1MSGS1',
          },
          data: [],
          messages: ['C1G0208W  ELEMENT NOT FOUND FOR SYNTAX STATEMENT #1'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(invalidElement)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error if something goes wrong in Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
        extension: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(toVersion2Api(basePath))(element),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: { action: 'signin' },
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(toVersion2Api(basePath))(element))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const signInResponse = await signInElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });
  });

  describe('generating an element', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        instance,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: ElementMapPath): string => {
        return join(
          basePath,
          instance,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system,
          'subsys',
          subSystem,
          'type',
          type,
          'ele',
          name
        );
      };

    type GenerateRequestBody = {
      action: 'generate';
      ccid: string;
      comment: string;
      copyBack: 'yes' | 'no';
      search: 'yes' | 'no';
      noSource: 'yes' | 'no';
    };

    describe('generating an element in place', () => {
      it('should generate an element in place', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(existingElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(existingElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should generate an element for v1 Endevor API base path', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(existingElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(existingElementLocation)
          )
        );
        const v1BasePath = basePath;
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: v1BasePath,
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should return an error for incorrect connection details', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const randomLocation: ServiceLocation = {
          protocol: 'http',
          port: 1234,
          hostname: 'localhost',
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: randomLocation,
          rejectUnauthorized,
        })(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error for incorrect base credentials', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(existingElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 20,
            reasonCode: 34,
            reports: null,
            messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(existingElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error if the element location is incorrect', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const incorrectElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'NONEXIST',
          type: 'NONEXIST',
          name: 'NONEXIST',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(
            incorrectElementLocation
          ),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              '09:07:22  C1G0228E  UNABLE TO MATCH SUBSYSTEM NONEXIST IN SYSTEM TEST-SYS',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(incorrectElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(incorrectElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return a signout error if the element is signed out to somebody else', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const signedOutElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(
            signedOutElementLocation
          ),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              '09:13:02  C1G0167E  ELEMENT IS NOT AVAILABLE.  IT IS ALREADY "SIGNED-OUT" TO SOMEBODY',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(signedOutElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(signedOutElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isSignoutError(generateResult)).toBe(true);
      });

      it('should return a generate error in case of an incorrect element processor generation', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(existingElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'no',
          },
        };
        const incorrectGenerationResponse: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 20,
            reasonCode: 34,
            reports: null,
            messages: [
              'C1G0129E  STEP BLAH RC (0012) EXCEEDS THE MAX RC (0004) FOR THE PROCESSOR STEP.',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          incorrectGenerationResponse
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(existingElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementInPlace(logger)(progress)({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isProcessorStepMaxRcExceededError(generateResult)).toBe(true);
      });

      it('should return an error if something went wrong in Endevor side', async () => {
        // arrange
        mockServer.anyRequest().thenJson(
          500,
          {
            returnCode: 20,
            reasonCode: 34,
            reports: null,
            messages: ['Something went really wrong....'],
            data: [],
          },
          {
            'content-type': 'application/json',
            version: '2.5',
          }
        );
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const updateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const { protocol, hostname, port } = new URL(mockServer.url);
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const updateResult = await generateElementInPlace(logger)(progress)({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(existingElementLocation)(updateActionChangeControlValue)();
        // assert
        expect(isError(updateResult)).toBe(true);
      });
    });

    describe('generating an element with copy back', () => {
      it('should generate an element with copy back', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should generate an element with copy back even if the element exists in the target location', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const targetElementLocation = existingElementLocation;
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should generate an element with copy back and no source', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: true,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'no',
            search: 'no',
            noSource: 'yes',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should generate an element for v1 Endevor API base path', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {},
            messages: [],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const v1BasePath = basePath;
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: v1BasePath,
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should return an error for incorrect connection details', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const randomLocation: ServiceLocation = {
          protocol: 'http',
          port: 1234,
          hostname: 'localhost',
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: randomLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error for incorrect base credentials', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 20,
            reasonCode: 34,
            reports: null,
            messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return a signout error if the element is signed out to somebody else', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const elementAlreadySignedOutResponse: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              '09:13:02  C1G0167E  ELEMENT IS NOT AVAILABLE.  IT IS ALREADY "SIGNED-OUT" TO SOMEBODY',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          elementAlreadySignedOutResponse
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isSignoutError(generateResult)).toBe(true);
      });

      it('should return an error if the element target location does not exist', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const incorrectTargetLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'NONEXIST',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(incorrectTargetLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              '09:07:22  C1G0228E  UNABLE TO MATCH SUBSYSTEM NONEXIST IN SYSTEM TEST-SYS',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(incorrectTargetLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(incorrectTargetLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error if an element was not found up the map', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const nonExistingElementName = 'NONEXIST';
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: nonExistingElementName,
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const response: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              '11:35:51  C1G0208W  ELEMENT NOT FOUND FOR SYNTAX STATEMENT #1',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return a generate error in case of an incorrect element processor generation', async () => {
        // arrange
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const targetElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(toVersion2Api(basePath))(targetElementLocation),
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${toBase64(credential)}`,
          },
          body: {
            action: 'generate',
            ccid: generateActionChangeControlValue.ccid,
            comment: generateActionChangeControlValue.comment,
            copyBack: 'yes',
            search: 'yes',
            noSource: 'no',
          },
        };
        const incorrectGenerationResponse: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '2.5',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: null,
            messages: [
              'C1G0129E  STEP BLAH RC (0012) EXCEEDS THE MAX RC (0004) FOR THE PROCESSOR STEP.',
            ],
            data: [],
          },
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          incorrectGenerationResponse
        )(mockServer);
        const { protocol, hostname, port } = new URL(
          mockServer.urlFor(
            toRequestPath(toVersion2Api(basePath))(targetElementLocation)
          )
        );
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          credential,
          location: serviceLocation,
          rejectUnauthorized,
        })(targetElementLocation)(generateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isProcessorStepMaxRcExceededError(generateResult)).toBe(true);
      });

      it('should return an error if something went wrong in Endevor side', async () => {
        // arrange
        mockServer.anyRequest().thenJson(
          500,
          {
            returnCode: 20,
            reasonCode: 34,
            reports: null,
            messages: ['Something went really wrong....'],
            data: [],
          },
          {
            'content-type': 'application/json',
            version: '2.5',
          }
        );
        const credential: BaseCredential = {
          user: 'test',
          password: 'test',
          type: CredentialType.BASE,
        };
        const existingElementLocation: ElementMapPath = {
          instance: 'TEST-INST',
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          type: 'TEST-TYPE',
          name: 'ELM',
        };
        const updateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const generateWithCopyBackParams: GenerateWithCopyBackParams = {
          noSource: false,
        };
        const { protocol, hostname, port } = new URL(mockServer.url);
        const serviceLocation: ServiceLocation = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          protocol: toEndevorProtocol(protocol)!,
          port: parseInt(port),
          hostname,
          basePath: toVersion2Api(basePath),
        };
        // act
        const updateResult = await generateElementWithCopyBack(logger)(
          progress
        )({
          rejectUnauthorized,
          location: serviceLocation,
          credential,
        })(existingElementLocation)(updateActionChangeControlValue)(
          generateWithCopyBackParams
        )();
        // assert
        expect(isError(updateResult)).toBe(true);
      });
    });
  });

  describe('element updating', () => {
    it('should update an element', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        200,
        {
          data: [],
          messages: [],
          reports: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toBeUndefined();
    });

    it('should add a new element', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        200,
        {
          data: [],
          messages: [],
          reports: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const newContent = 'very important content';
      // TODO: investigate into fingerprint option into addElement, why we need it there???
      const nonUsedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: newContent,
        fingerprint: nonUsedFingerprint,
      };
      const newElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(newElementLocation)(addActionChangeControlValue)(element);
      // assert
      expect(updateResult).toBeUndefined();
    });

    it('should add/update an element with V1 base path', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        200,
        {
          data: [],
          messages: [],
          reports: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const newContent = 'very important content';
      const nonUsedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: newContent,
        fingerprint: nonUsedFingerprint,
      };
      const newElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(newElementLocation)(addActionChangeControlValue)(element);
      // assert
      expect(updateResult).toBeUndefined();
    });

    it('should update an element even after change regression error', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        200,
        {
          returnCode: 8,
          reasonCode: 0,
          reports: null,
          data: [],
          messages: [
            'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC07435',
            '03:41:46 SMGR123C 99% PRIOR INSERTS DELETED AND/OR 01% PRIOR DELETES RE-INSERTED',
          ],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toBeUndefined();
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const newContent = 'very important content';
      const nonUsedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: newContent,
        fingerprint: nonUsedFingerprint,
      };
      const newElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(newElementLocation)(addActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('should return an error for partially element location specified', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: ['EWS1232E Parameter system cannot be Wildcarded.'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('should return an error for outdated fingerprint', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: [
            "C1G0410E  FINGERPRINT DOESN'T MATCH ELEMENT ALREADY PRESENTED IN THE MAP. ELEMENT SOURCE HAS BEEN UPDATED BEFORE.",
          ],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const outdatedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: outdatedFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('should return an error for incorrect content', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const emptyContent = '';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: emptyContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('may return an error for incorrect ccid&comment', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: [
            '11:33:28  C1G0142E  SYSTEM REQUIRES A CCID TO BE SPECIFIED - REQUEST NOT PERFORMED',
          ],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['Something went really wrong....'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const updateResult = await updateElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(existingElementLocation)(updateActionChangeControlValue)(element);
      // assert
      expect(isError(updateResult)).toBe(true);
    });
  });

  describe('Adding element', () => {
    const content = 'Very important addition!';

    it('should return void if everything is OK and an element is added', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        200,
        {
          data: [],
          messages: [],
          reports: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(addResult).toBeUndefined();
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for partially element location specified', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: ['EWS1232E Parameter system cannot be Wildcarded.'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for incorrect content', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const serviceLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for incorrect ccid&comment', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: [
            '11:33:28  C1G0142E  SYSTEM REQUIRES A CCID TO BE SPECIFIED - REQUEST NOT PERFORMED',
          ],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: '',
        comment: '',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for duplicate element', async () => {
      // arrange
      const exptectedMessage = 'C1G0024E  THE ELEMENT WAS ALREADY PRESENT.';
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: [exptectedMessage],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.anyRequest().thenJson(
        500,
        {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['Something went really wrong....'],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const element: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const { protocol, hostname, port } = new URL(mockServer.url);
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const addResult = await addElement(logger)(progress)({
        rejectUnauthorized,
        location: serviceLocation,
        credential,
      })(element)(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });
  });

  describe('fetching all environment stages', () => {
    const searchLocation: ElementSearchLocation = {
      instance: 'TEST-INST',
    };
    const toRequestPath =
      (basePath: string) =>
      ({ instance }: ElementSearchLocation): string => {
        return join(basePath, instance, 'env', ANY_VALUE, 'stgnum', ANY_VALUE);
      };

    it('should return filtered environment stages', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validEnvironments = [
        {
          environment: 'TEST-ENV1',
          stageNumber: '1',
          nextEnvironment: 'FINAL-ENV',
          nextStageNumber: '1',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: null,
          nextStageNumber: null,
        },
      ];
      const invalidEnvironments = [
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: 'TEST-ENV2',
          nextStageNumber: 'TEST',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: 'TEST-ENV2',
          nextStageNumber: null,
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '2',
          nextEnvironment: null,
          nextStageNumber: '1',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validEnvironments.map((element) => {
              return {
                envName: element.environment,
                stgNum: element.stageNumber,
                nextEnv: element.nextEnvironment,
                nextStgNum: element.nextStageNumber,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidEnvironments.map((element: any) => {
              return {
                envName: element.environment,
                stgName: element.stageName,
                stgId: element.stageId,
                stgNum: element.stageNumber,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const expectedEnvironments: ReadonlyArray<EnvironmentStage> = [
        {
          environment: 'TEST-ENV1',
          stageNumber: '1',
          nextEnvironment: 'FINAL-ENV',
          nextStageNumber: '1',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
        },
      ];
      expect(actualEnvironments).toEqual(expectedEnvironments);
    });

    it('should return environment stages for V1 base path specified', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validEnvironments = [
        {
          environment: 'TEST-ENV1',
          stageNumber: '1',
          nextEnvironment: 'TEST-ENV2',
          nextStageNumber: '2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validEnvironments.map((element) => {
              return {
                envName: element.environment,
                stgNum: element.stageNumber,
                nextEnv: element.nextEnvironment,
                nextStgNum: element.nextStageNumber,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const v1BasePath = basePath;
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: v1BasePath,
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualEnvironments).toEqual(validEnvironments);
    });

    it('should return an error in case of an incorrect (nonexisting) instance', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal Server Error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 0,
          reports: null,
          messages: [
            `EWS1101E Configuration ${searchLocation.instance} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(toRequestPath(request.path)(searchLocation))
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const randomLocation: ServiceLocation = {
        protocol: 'http',
        port: 1234,
        hostname: 'localhost',
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: randomLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 20,
          reasonCode: 34,
          reports: null,
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          data: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(toVersion2Api(basePath))(searchLocation),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const invalidResponse: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const { protocol, hostname, port } = new URL(
        mockServer.urlFor(
          toRequestPath(toVersion2Api(basePath))(searchLocation)
        )
      );
      const serviceLocation: ServiceLocation = {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        protocol: toEndevorProtocol(protocol)!,
        port: parseInt(port),
        hostname,
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )({
        credential,
        location: serviceLocation,
        rejectUnauthorized,
      })(searchLocation.instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });
  });
});
