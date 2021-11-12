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
  updateElement,
} from '../endevor';
import { mockEndpoint } from '../testUtils';
import { isError, toEndevorProtocol, toVersion2Api } from '../utils';
import { BaseCredential, CredentialType } from '../_doc/Credential';
import {
  ActionChangeControlValue,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  ElementWithFingerprint,
  ServiceLocation,
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
  // mockServer.enableDebug();
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
          extension: 'EXT',
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
          extension: 'EXT',
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
          extension: 'EXT',
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
          extension: 'EXT',
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

    // TODO
    // it('should return filtered elements for search location with any environment', async () => {});
    it('should return empty list of elements for incorrect search location', async () => {
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

      expect(actualElements).toEqual([]);
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

    it('should return empty list of elements for incorrect connection details', async () => {
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
        hostname: 'blahblah',
        basePath: toVersion2Api(basePath),
      };
      // act
      const actualElements = await searchForElements(logger)(progress)({
        credential,
        location: randomLocation,
        rejectUnauthorized,
      })(searchLocation);
      // assert
      expect(actualElements).toEqual([]);
    });

    it('should return empty list of elements for incorrect base credentials', async () => {
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

      expect(actualElements).toEqual([]);
    });

    it('should return empty list of elements if something went wrong in Endevor side', async () => {
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

      expect(actualElements).toEqual([]);
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

    it('should return nothing for incorrect connection details', async () => {
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
      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for incorrect base credentials', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for partially specified element location', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for incorrect element location', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing if something went wrong in Endevor side', async () => {
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

      expect(actualContent).toBeUndefined();
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

    it('should return nothing for incorrect connection details', async () => {
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
      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for incorrect base credentials', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for partially specified element location', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing for incorrect element location', async () => {
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

      expect(actualContent).toBeUndefined();
    });

    it('should return nothing if something went wrong in Endevor side', async () => {
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

      expect(actualContent).toBeUndefined();
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
      const elementLocationAsString = `${existingElementLocation.system}/${existingElementLocation.subSystem}/${existingElementLocation.type}/${existingElementLocation.name}`;
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
      let errorMessage;
      if (isError(updateResult)) {
        errorMessage = updateResult.message;
      }
      expect(errorMessage).toBe(
        `Unable to update element ${elementLocationAsString}. Fingerprint provided does not match record in Endevor.`
      );
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
});
