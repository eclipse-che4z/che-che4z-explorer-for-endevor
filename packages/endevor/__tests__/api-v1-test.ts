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
import { URL } from 'url';
import {
  getAllEnvironmentStages,
  getAllSubSystems,
  getAllSystems,
  getInstanceNames,
  printElement,
  getApiVersion,
  searchForElements,
  signInElement,
  retrieveElementWithFingerprint,
} from '../endevor';
import { mockEndpoint } from '../testUtils';
import { isError, toEndevorProtocol, isSignoutError } from '../utils';
import { MockRequest, MockResponse } from '../_doc/MockServer';
import { ProgressReporter } from '../_doc/Progress';
import { BaseCredential, CredentialType } from '../_doc/Credential';
import {
  Element,
  ElementSearchLocation,
  ServiceLocation,
  Service,
  ServiceApiVersion,
  ElementMapPath,
  EnvironmentStage,
  System,
  SubSystem,
  ServiceBasePath,
} from '../_doc/Endevor';
import { join } from 'path';
import { ANY_VALUE } from '../const';
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
const nonExistingServerURL = 'http://localhost:1234/';

// set up mock server
const mockServer = getLocal();
beforeEach(async () => {
  await mockServer.start();
  mockServer.enableDebug();
});
afterEach(() => mockServer.stop());

const toBase64 = ({ user, password }: BaseCredential): string =>
  Buffer.from(`${user}:${password}`, 'binary').toString('base64');

const toApiVersion = (basePath: string): ServiceApiVersion =>
  basePath.includes(ServiceBasePath.LEGACY) ||
  basePath.includes(ServiceBasePath.V1)
    ? ServiceApiVersion.V1
    : ServiceApiVersion.V2;

const makeServiceLocation =
  (basePath: string) =>
  (url: string): ServiceLocation => {
    const { protocol, hostname, port } = new URL(url);
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      protocol: toEndevorProtocol(protocol)!,
      port: parseInt(port),
      hostname,
      basePath,
    };
  };

const makeService =
  (basePath: string, credential: BaseCredential) =>
  (url: string): Service => ({
    location: makeServiceLocation(basePath)(url),
    credential,
    rejectUnauthorized,
    apiVersion: toApiVersion(basePath),
  });

describe('endevor public API v1', () => {
  const basePath = ServiceBasePath.LEGACY;
  const credential: BaseCredential = {
    user: 'test',
    password: 'test',
    type: CredentialType.BASE,
  };

  const toServiceLocation = makeServiceLocation(basePath);
  const toService = makeService(basePath, credential);

  describe('fetching API version', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: `${basePath}/`,
      headers: {},
      body: null,
    };

    it('should return v1 API version', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: [],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const actualApiVersion = await getApiVersion(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualApiVersion).toEqual(ServiceApiVersion.V1);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation = toServiceLocation(nonExistingServerURL);
      // act
      const actualApiVersion = await getApiVersion(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(isError(actualApiVersion)).toEqual(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'invalid-version-header': 'invalid version value',
          'content-type': 'application/json',
        },
        data: {},
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const actualApiVersion = await getApiVersion(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualApiVersion)).toEqual(true);
    });
  });

  describe('fetching instances', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: `${basePath}/`,
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
          'api-version': '1.1',
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
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
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

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation = toServiceLocation(nonExistingServerURL);
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(isError(actualInstances)).toEqual(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          realData: ["I'm not sure it is real data, but I'm okay here"],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const actualInstances = await getInstanceNames(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualInstances)).toEqual(true);
    });
  });

  describe('searching elements', () => {
    const toRequestPath = ({
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
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(searchLocation),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        searchLocation
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return filtered elements for partially specified search location', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        // system: 'TEST-SYS',
        // subsystem: 'TEST-SBS',
        // type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(searchLocation),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        searchLocation
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return elements with proper extensions', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(searchLocation),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        searchLocation
      );
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
      const wrongLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(wrongLocation),
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip,deflate',
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 4,
          reasonCode: 3,
          reports: {},
          messages: null,
          data: emptyElementsList,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        wrongLocation
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualElements = await searchForElements(logger)(progress)(
        nonExistingService
      )(searchLocation);
      // assert
      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(searchLocation),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        searchLocation
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=SEA&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(searchLocation),
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip,deflate',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const invalidResponse: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'api-version': '1.2',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForElements(logger)(progress)(service)(
        searchLocation
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);
      expect(isError(actualElements)).toBe(true);
    });
  });
  describe('printing elements', () => {
    const toRequestPath = ({
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
        path: toRequestPath(element),
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
          'api-version': '1.1',
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
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
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualContent = await printElement(logger)(progress)(
        nonExistingService
      )(element);
      // assert
      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
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
        path: toRequestPath(element),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for partially specified element location', async () => {
      // arrange
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
        path: toRequestPath(element),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect element location', async () => {
      // arrange
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
        path: toRequestPath(invalidElement),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printElement(logger)(progress)(service)(
        invalidElement
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
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
        path: toRequestPath(element),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });
  });
  describe('fetching all subsystems', () => {
    const instance = 'TEST-INST';
    const toRequestPath = (instance: string): string => {
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
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSubSystems).toEqual(validSubSystems);
    });

    it('should return an error in case of incorrect (nonexisting) instance', async () => {
      // arrange
      const nonExistingInstance = 'TEST';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(nonExistingInstance),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(nonExistingInstance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        nonExistingService
      )(instance);
      // assert
      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSubSystems)).toBe(true);
    });
  });
  describe('fetching all systems', () => {
    const instance = 'TEST-INST';
    const toRequestPath = (instance: string): string => {
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
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        instance
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSystems).toEqual(validSystems);
    });

    it('should return an error in case of incorrect (nonexisting) systems', async () => {
      // arrange
      const nonExistingInstance = 'TEST';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(nonExistingInstance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 0,
          reports: null,
          messages: [
            `API0000W  WARNING(S) DETECTED, PROCESSING COMPLETE`,
            `API0000W  WARNING -- NO RECORDS FOUND TO MATCH CRITERIA`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        nonExistingInstance
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });

    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        instance
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const instanceName = 'TEST';
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualSystems = await getAllSystems(logger)(progress)(
        nonExistingService
      )(instanceName);
      // assert
      expect(isError(actualSystems)).toBe(true);
    });

    it('should return an error if something went wrong on the Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        instance
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });
  });
  describe('fetching all environment stages', () => {
    const instance = 'TEST-INST';
    const toRequestPath = (instance: string): string => {
      return join(basePath, instance, 'env', ANY_VALUE, 'stgnum', ANY_VALUE);
    };

    it('should return filtered environment stages', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: null,
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(instance);
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

    it('should return an error in case of an incorrect (nonexisting) instance', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 16,
          reasonCode: 0,
          reports: null,
          messages: [
            `EWS1101E Configuration ${instance} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(nonExistingService)(instance);
      // assert
      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(instance),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Hmm, is it real data???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(instance);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });
  });
  describe('signing in an element', () => {
    const element: ElementMapPath = {
      instance: 'TEST-INST',
      environment: 'TEST-ENV',
      stageNumber: '1',
      system: 'TEST-SYS',
      subSystem: 'TEST-SBS',
      type: 'TEST-TYPE',
      name: 'ELM1',
    };
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

    it('should sign in an element', async () => {
      // arrange
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(element),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0000',
          reasonCode: '0000',
          reports: {
            APIMSGS: '/reports/1631287369-1243603095386082-APIMSGS',
            C1MSGS1: '/reports/1631287369-1243603095386082-C1MSGS1',
          },
          data: [],
          messages: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(signInResponse).toBeUndefined();
    });

    it('should return error for trying to sign in a not signed out element', async () => {
      // arrange
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(element),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0004',
          reasonCode: '0000',
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const signInResponse = await signInElement(logger)(progress)(
        nonExistingService
      )(element);
      // assert
      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect base credentials', async () => {
      // arrange
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(element),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0020',
          reasonCode: '0034',
          reports: null,
          data: [],
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for partially specified element location', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(invalidElementPath),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0012',
          reasonCode: '0000',
          reports: null,
          data: [],
          messages: [
            'EWS1216E Wildcarded element name is not supported for this action',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        invalidElementPath
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error for incorrect element location', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        name: 'ELM',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(invalidElementPath),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0004',
          reasonCode: '0000',
          reports: {
            C1MSGS1: '/reports/1621956951-160920989-C1MSGS1',
          },
          data: [],
          messages: ['C1G0208W  ELEMENT NOT FOUND FOR SYNTAX STATEMENT #1'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        invalidElementPath
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });

    it('should return error if something goes wrong in Endevor side', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        name: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(invalidElementPath),
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
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const signInResponse = await signInElement(logger)(progress)(service)(
        invalidElementPath
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(signInResponse)).toBe(true);
    });
  });
  describe('retrieving an element with fingerprint', () => {
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
    it('should return an element content with a fingerprint', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementFingerprint = 'Element Fingerprint';
      const elementContent = 'ELEMENT CONTENT';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          'api-version': '1.1',
          'content-type': 'application/octet-stream',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;
      expect(actualElement.fingerprint).toStrictEqual(elementFingerprint);
      expect(actualElement.content).toStrictEqual(elementContent);
    });
    it('should return an element up the map content with a fingerprint if the element in place is sourceless', async () => {
      // arrange
      const sourcelessElement: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(sourcelessElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementFingerprint = 'Element Fingerprint';
      const elementUpTheMapContent = 'ELEMENT CONTENT';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          'api-version': '1.1',
          'content-type': 'application/octet-stream',
        },
        data: Buffer.from(elementUpTheMapContent, 'utf-8'),
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(sourcelessElement)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;
      expect(actualElement.fingerprint).toStrictEqual(elementFingerprint);
      expect(actualElement.content).toStrictEqual(elementUpTheMapContent);
    });
    // this is a known bug
    it('should return an element content in UTF-8 encoding with a fingerprint', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementFingerprint = 'Element Fingerprint';
      const frenchElementContent = 'ELEMENTç CONTENT';
      const elementContentBuffer = Buffer.from(frenchElementContent, 'latin1');
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          'api-version': '1.1',
          'content-type': 'application/octet-stream;charset=ISO-8859-1',
        },
        data: elementContentBuffer,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;
      expect(actualElement.fingerprint).toStrictEqual(elementFingerprint);
      expect(actualElement.content).toStrictEqual(
        elementContentBuffer.toString('utf-8')
      );
    });
    it('should return an element content with a fingerprint with signout', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const signoutChangeControlValue = {
        ccid: 'test',
        comment: 'testComment',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: `?ccid=${signoutChangeControlValue.ccid}&comment=${signoutChangeControlValue.comment}&oveSign=no&signout=yes&toFileDescription=via%20Zowe%20CLI%20command&noSignout=N`,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          'api-version': '1.1',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)(signoutChangeControlValue);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;
      expect(actualElement.fingerprint).toStrictEqual(elementFingerprint);
      expect(actualElement.content).toStrictEqual(elementContent);
    });
    it('should return an element content with a fingerprint with override signout', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const signoutChangeControlValue = {
        ccid: 'test',
        comment: 'testComment',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: `?ccid=${signoutChangeControlValue.ccid}&comment=${signoutChangeControlValue.comment}&oveSign=yes&signout=yes&toFileDescription=via%20Zowe%20CLI%20command&noSignout=N`,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          'api-version': '1.1',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)(signoutChangeControlValue, true);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;
      expect(actualElement.fingerprint).toStrictEqual(elementFingerprint);
      expect(actualElement.content).toStrictEqual(elementContent);
    });
    it('should return an error if the element fingerprint is missing', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from('test', 'utf-8'),
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElement)).toBe(true);
    });
    it('should return an error for the incorrect credentials', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const incorrectCredentialsResponse: MockResponse<unknown> = {
        status: 500,
        statusMessage: 'Internal server error',
        headers: {
          'api-version': '1.1',
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
      const endevorEndpoint = await mockEndpoint(
        request,
        incorrectCredentialsResponse
      )(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElement)).toBe(true);
    });
    it('should return an error for the incorrect connection details', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(nonExistingService)(element)();
      // assert
      expect(isError(actualElement)).toBe(true);
    });
    it('should return an error if the element does not exist', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Bad request',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: null,
          messages: [
            'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC03229',
            '09:16:41  C1G0228E  UNABLE TO MATCH SUBSYSTEM TEST-SBS IN SYSTEM TEST-SYS',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(true);
    });
    it('should return a signout error for the element, signed out to somebody else', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Bad request',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: null,
          messages: [
            'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC03233',
            '09:30:29  C1G0167E  ELEMENT IS NOT AVAILABLE.  IT IS ALREADY "SIGNED-OUT" TO YOUR MANAGER',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isSignoutError(actualElement)).toBe(true);
    });
    it('should return an error if something went wrong on the Endevor side', async () => {
      // arrange
      const element: Element = {
        instance: 'TEST-INST',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const response: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Internal server error',
        headers: {
          'api-version': '1.1',
          'content-type': 'application/json',
        },
        data: {
          returnCode: 12,
          reasonCode: 20,
          reports: null,
          messages: ['Very important Endevor error'],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const actualElement = await retrieveElementWithFingerprint(logger)(
        progress
      )(service)(element)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElement)).toBe(true);
    });
  });
});
