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
  printElement,
  printListing,
  searchForFirstFoundElements,
  signInElement,
  updateElement,
  addElement,
  getAllEnvironmentStages,
  getAllSystems,
  getAllSubSystems,
  generateElementInPlace,
  generateElementWithCopyBack,
  retrieveElementWithFingerprint,
  retrieveElementWithDependenciesWithoutSignout,
  getApiVersion,
  getConfigurations,
  searchForAllElements,
  searchForElementsInPlace,
} from '../endevor';
import { mockEndpoint } from '../testUtils';
import {
  isConnectionError,
  isDuplicateElementError,
  isError,
  isFingerprintMismatchError,
  isProcessorStepMaxRcExceededError,
  isSignoutError,
  isWrongCredentialsError,
  toEndevorProtocol,
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
  ServiceApiVersion,
  Service,
  ServiceBasePath,
  UpdateStatus,
  ErrorUpdateResponse,
  EnvironmentStageMapPath,
} from '../_doc/Endevor';
import {
  ConnectionError,
  FingerprintMismatchError,
  WrongCredentialsError,
} from '../_doc/Error';
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
const nonExistingServerURL = 'http://127.0.0.1:1234/';

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

describe('endevor public API v2', () => {
  const basePath = ServiceBasePath.V2;
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

    it('should return v2 API version', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
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

      expect(actualApiVersion).toEqual(ServiceApiVersion.V2);
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

  describe('fetching configurations', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: `${basePath}/`,
      headers: {},
      body: null,
    };

    it('should return filtered configurations', async () => {
      // arrange
      const invalidConfigurationNames = ['INST3'];
      const invalidConfigurations = invalidConfigurationNames.map(
        (invalidConfigurationName) => ({
          naMe: invalidConfigurationName,
          description: 'invalid configuration',
        })
      );
      const validConfigurationNames = ['INST1', 'INST2'];
      const validConfigurations = validConfigurationNames.map(
        (validConfigurationName) => ({
          name: validConfigurationName,
          description: 'valid configuration',
        })
      );
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: [...validConfigurations, ...invalidConfigurations],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const actualConfigurations = await getConfigurations(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualConfigurations).toEqual(validConfigurations);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation = toServiceLocation(nonExistingServerURL);
      // act
      const actualConfigurations = await getConfigurations(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(isConnectionError(actualConfigurations)).toEqual(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: "I'm not sure it is real data, but I'm okay here",
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const actualConfigurations = await getConfigurations(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualConfigurations)).toEqual(true);
    });
  });

  describe('fetching all environment stages', () => {
    const configuration = 'TEST-CONFIG';
    const toRequestPath =
      (basePath: string) =>
      (configuration: string): string => {
        return join(
          basePath,
          configuration,
          'env',
          ANY_VALUE,
          'stgnum',
          ANY_VALUE
        );
      };

    it('should return filtered environment stages', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
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

    it('should return an error in case of an incorrect (nonexisting) configuration', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
            `EWS1101E Configuration ${configuration} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
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
      )(nonExistingService)(configuration)();
      // assert
      expect(isError(actualEnvironments)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isWrongCredentialsError(actualEnvironments)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualEnvironments = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualEnvironments)).toBe(true);
    });
  });

  describe('fetching all systems', () => {
    const configuration = 'TEST-CONFIG';
    const toRequestPath =
      (basePath: string) =>
      (configuration: string): string => {
        return join(
          basePath,
          configuration,
          'env',
          ANY_VALUE,
          'stgnum',
          ANY_VALUE,
          'sys',
          ANY_VALUE
        );
      };

    const toSpecificRequestPath =
      (basePath: string) =>
      (configuration: string) =>
      (environment: string) =>
      (stageNumber: string): string => {
        return join(
          basePath,
          configuration,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          ANY_VALUE
        );
      };

    it('should return the list of all filtered systems', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
                stgId: system.stageNumber,
                stgSeqNum: parseInt(system.stageNumber),
                nextSys: system.nextSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSystems.map((system: any) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgId: system.stageNumber,
                stgSeqNum: parseInt(system.stageNumber),
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
        configuration
      )();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSystems).toEqual(validSystems);
    });

    it('should return the list of all filtered systems searching with environment and stage number', async () => {
      // arrange
      const searchParams: Readonly<EnvironmentStageMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toSpecificRequestPath(basePath)(configuration)(
          searchParams.environment
        )(searchParams.stageNumber),
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
                stgId: system.stageNumber,
                stgSeqNum: parseInt(system.stageNumber),
                nextSys: system.nextSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSystems.map((system: any) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgId: system.stageNumber,
                stgSeqNum: parseInt(system.stageNumber),
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
        configuration
      )(searchParams);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSystems).toEqual(validSystems);
    });

    it('should return an error in case of incorrect (nonexisting) configuration', async () => {
      // arrange
      const nonExistingConfiguration = 'TEST';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(nonExistingConfiguration),
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
            `EWS1101E Configuration ${nonExistingConfiguration} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        nonExistingConfiguration
      )();
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
        path: toRequestPath(basePath)(configuration),
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
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSystems = await getAllSystems(logger)(progress)(service)(
        configuration
      )();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isWrongCredentialsError(actualSystems)).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const configurationName = 'TEST';
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualSystems = await getAllSystems(logger)(progress)(
        nonExistingService
      )(configurationName)();
      // assert
      expect(isError(actualSystems)).toBe(true);
    });

    it('should return an error if something went wrong on the Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
        configuration
      )();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualSystems)).toBe(true);
    });
  });

  describe('fetching all subsystems', () => {
    const configuration = 'TEST-CONFIG';
    const toRequestPath =
      (basePath: string) =>
      (configuration: string): string => {
        return join(
          basePath,
          configuration,
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

    const toSpecificRequestPath =
      (basePath: string) =>
      (configuration: string) =>
      (environment: string) =>
      (stageNumber: string): string => {
        return join(
          basePath,
          configuration,
          'env',
          environment,
          'stgnum',
          stageNumber,
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
        path: toRequestPath(basePath)(configuration),
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
                stgId: subsystem.stageNumber,
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
      )(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSubSystems).toEqual(validSubSystems);
    });

    it('should return the list of all filtered subsystems when searching with environment and stage number', async () => {
      // arrange
      const searchParams: Readonly<EnvironmentStageMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toSpecificRequestPath(basePath)(configuration)(
          searchParams.environment
        )(searchParams.stageNumber),
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
                stgId: subsystem.stageNumber,
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
      )(configuration)(searchParams);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualSubSystems).toEqual(validSubSystems);
    });

    it('should return an error in case of incorrect (nonexisting) configuration', async () => {
      // arrange
      const nonExistingConfiguration = 'TEST';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(nonExistingConfiguration),
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
            `EWS1101E Configuration ${nonExistingConfiguration} is not defined or is invalid`,
          ],
          data: null,
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(nonExistingConfiguration)();
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
        path: toRequestPath(basePath)(configuration),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isWrongCredentialsError(actualSubSystems)).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        nonExistingService
      )(configuration)();
      // assert
      expect(isError(actualSubSystems)).toBe(true);
    });

    it('should return an error if something went wrong on Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualSubSystems = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)();
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
        configuration,
        environment,
        stageNumber,
        system,
        subsystem,
        type,
        element,
      }: ElementSearchLocation): string => {
        return join(
          basePath,
          configuration,
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

    it('should return all filtered elements', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=ALL';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
          configuration: 'TEST-CONFIG',
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
          configuration: 'TEST-CONFIG',
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
                fullElmName: element.name,
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
      const actualElements = await searchForAllElements(logger)(progress)(
        service
      )(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return filtered elements in place', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=no&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
          configuration: 'TEST-CONFIG',
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
          configuration: 'TEST-CONFIG',
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
                fullElmName: element.name,
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
      const actualElements = await searchForElementsInPlace(logger)(progress)(
        service
      )(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return filtered first found elements', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
          configuration: 'TEST-CONFIG',
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
          configuration: 'TEST-CONFIG',
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
                fullElmName: element.name,
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
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(service)(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    it('should return filtered elements for partially specified search location', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        // system: 'TEST-SYS',
        // subsystem: 'TEST-SBS',
        // type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
          configuration: 'TEST-CONFIG',
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
          configuration: 'TEST-CONFIG',
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
                fullElmName: element.name,
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
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(service)(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualElements).toEqual(validElements);
    });

    // TODO
    // it('should return filtered elements for search location with any environment', async () => {});
    it('should return an error for incorrect search location', async () => {
      // arrange
      const wrongLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(wrongLocation),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(service)(wrongLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(nonExistingService)(searchLocation);
      // assert
      expect(isError(actualElements)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(service)(searchLocation);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isWrongCredentialsError(actualElements)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const searchLocation: ElementSearchLocation = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subsystem: 'TEST-SBS',
        type: 'TEST-TYPE',
      };
      const requestQuery = '?data=BAS&search=yes&return=FIR';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(searchLocation),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualElements = await searchForFirstFoundElements(logger)(
        progress
      )(service)(searchLocation);
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
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          configuration,
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
        configuration: 'TEST-CONFIG',
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(invalidElement),
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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

  describe('printing element listings', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          configuration,
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
      const element: Element = {
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printListing(logger)(progress)(service)(
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
        configuration: 'TEST-CONFIG',
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
      const actualContent = await printListing(logger)(progress)(
        nonExistingService
      )(element);
      // assert
      expect(isError(actualContent)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const element: Element = {
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printListing(logger)(progress)(service)(
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printListing(logger)(progress)(service)(
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(invalidElement),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printListing(logger)(progress)(service)(
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
        configuration: 'TEST-CONFIG',
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
        path: toRequestPath(basePath)(element),
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
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualContent = await printListing(logger)(progress)(service)(
        element
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isError(actualContent)).toBe(true);
    });
  });

  describe('signing in an element', () => {
    const element: ElementMapPath = {
      configuration: 'TEST-CONFIG',
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
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: ElementMapPath): string => {
        return join(
          basePath,
          configuration,
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
        configuration: 'TEST-CONFIG',
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
        configuration: 'TEST-CONFIG',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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

  describe('generating an element', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: ElementMapPath): string => {
        return join(
          basePath,
          configuration,
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
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(existingElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          service
        )(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(generateResult).toBeUndefined();
      });

      it('should return an error for incorrect connection details', async () => {
        // arrange
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
        const nonExistingService = toService(nonExistingServerURL);
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          nonExistingService
        )(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error for incorrect base credentials', async () => {
        // arrange
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(existingElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          service
        )(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error if the element location is incorrect', async () => {
        // arrange
        const incorrectElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(incorrectElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          service
        )(incorrectElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isError(generateResult)).toBe(true);
      });

      it('should return a signout error if the element is signed out to somebody else', async () => {
        // arrange
        const signedOutElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(signedOutElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          service
        )(signedOutElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isSignoutError(generateResult)).toBe(true);
      });

      it('should return a generate error in case of an incorrect element processor generation', async () => {
        // arrange
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(existingElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementInPlace(logger)(progress)(
          service
        )(existingElementLocation)(generateActionChangeControlValue)();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isProcessorStepMaxRcExceededError(generateResult)).toBe(true);
      });

      it('should return an error if something went wrong in Endevor side', async () => {
        // arrange
        mockServer.forAnyRequest().thenJson(
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
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
        const service = toService(mockServer.url);
        // act
        const updateResult = await generateElementInPlace(logger)(progress)(
          service
        )(existingElementLocation)(updateActionChangeControlValue)();
        // assert
        expect(isError(updateResult)).toBe(true);
      });
    });

    describe('generating an element with copy back', () => {
      it('should generate an element with copy back', async () => {
        // arrange
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
        const nonExistingService = toService(nonExistingServerURL);
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(nonExistingService)(targetElementLocation)(
          generateActionChangeControlValue
        )(generateWithCopyBackParams)();
        // assert
        expect(isError(generateResult)).toBe(true);
      });

      it('should return an error for incorrect base credentials', async () => {
        // arrange
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const incorrectTargetLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(incorrectTargetLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(incorrectTargetLocation)(generateActionChangeControlValue)(
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
        const nonExistingElementName = 'NONEXIST';
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        const targetElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
          path: toRequestPath(basePath)(targetElementLocation),
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
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(targetElementLocation)(generateActionChangeControlValue)(
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
        mockServer.forAnyRequest().thenJson(
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
        const existingElementLocation: ElementMapPath = {
          configuration: 'TEST-CONFIG',
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
        const service = toService(mockServer.url);
        // act
        const updateResult = await generateElementWithCopyBack(logger)(
          progress
        )(service)(existingElementLocation)(updateActionChangeControlValue)(
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
      const returnCode = 0;
      const messages: string[] = [];
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: [],
          messages,
          reports: [],
          returnCode,
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.OK,
        additionalDetails: {
          returnCode,
          message: ['', ...messages.map((message) => message.trim())].join(
            '\n'
          ),
        },
      });
    });

    it('should add a new element', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const returnCode = 0;
      const messages: string[] = [];
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: [],
          messages,
          reports: [],
          returnCode,
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const newContent = 'very important content';
      // TODO: investigate into fingerprint option into addElement, why we need it there???
      const nonUsedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: newContent,
        fingerprint: nonUsedFingerprint,
      };
      const newElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        newElementLocation
      )(addActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.OK,
        additionalDetails: {
          returnCode,
          message: ['', ...messages.map((message) => message.trim())].join(
            '\n'
          ),
        },
      });
    });

    it('should update an element even after change regression error', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = [
        'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC07435',
        '03:41:46 SMGR123C 99% PRIOR INSERTS DELETED AND/OR 01% PRIOR DELETES RE-INSERTED',
      ];
      const returnCode = 8;
      mockServer.forAnyRequest().thenJson(
        200,
        {
          returnCode,
          reasonCode: 0,
          reports: null,
          data: [],
          messages,
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.OK,
        additionalDetails: {
          returnCode,
          message: ['', ...messages.map((message) => message.trim())].join(
            '\n'
          ),
        },
      });
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const newContent = 'very important content';
      const nonUsedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: newContent,
        fingerprint: nonUsedFingerprint,
      };
      const newElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const updateResult = await updateElement(logger)(progress)(
        nonExistingService
      )(newElementLocation)(addActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          error: new ConnectionError(
            `connect ECONNREFUSED ${nonExistingService.location.hostname}:${nonExistingService.location.port}`
          ),
        },
      });
      expect(
        isConnectionError(
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (updateResult as ErrorUpdateResponse).additionalDetails.error
        )
      ).toBeTruthy();
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = ['API0034S INVALID USERID OR PASSWORD DETECTED'];
      const returnCode = 20;
      mockServer.forAnyRequest().thenJson(
        401,
        {
          returnCode,
          reasonCode: 34,
          reports: null,
          messages,
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          returnCode,
          error: new WrongCredentialsError(
            `${['', ...messages.map((message) => message.trim())].join('\n')}`
          ),
        },
      });
      expect(
        isWrongCredentialsError(
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (updateResult as ErrorUpdateResponse).additionalDetails.error
        )
      ).toBeTruthy();
    });

    it('should return an error for partially element location specified', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = ['EWS1232E Parameter system cannot be Wildcarded.'];
      const returnCode = 12;
      mockServer.forAnyRequest().thenJson(
        500,
        {
          returnCode,
          reasonCode: 34,
          reports: null,
          messages,
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          returnCode,
          error: new Error(
            `${['', ...messages.map((message) => message.trim())].join('\n')}`
          ),
        },
      });
    });

    it('should return an error for outdated fingerprint', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const returnCode = 12;
      const messages = [
        "C1G0410E  FINGERPRINT DOESN'T MATCH ELEMENT ALREADY PRESENTED IN THE MAP. ELEMENT SOURCE HAS BEEN UPDATED BEFORE.",
      ];
      mockServer.forAnyRequest().thenJson(
        500,
        {
          returnCode,
          reasonCode: 34,
          reports: null,
          messages,
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const outdatedFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: outdatedFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          returnCode,
          error: new FingerprintMismatchError(
            `${['', ...messages.map((message) => message.trim())].join('\n')}`
          ),
        },
      });
      expect(
        isFingerprintMismatchError(
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          (updateResult as ErrorUpdateResponse).additionalDetails.error
        )
      ).toBeTruthy();
    });

    it('should return update the element with empty content', async () => {
      // arrange
      const emptyContent = '';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: emptyContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'ELM',
      };
      const returnCode = 8;
      const messages: string[] = [
        '99% BASE STATEMENTS DELETED AND/OR NEW INSERTS EXCEED',
      ];
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: [],
          messages,
          reports: [],
          returnCode,
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toStrictEqual({
        status: UpdateStatus.OK,
        additionalDetails: {
          returnCode,
          message: ['', ...messages.map((message) => message.trim())].join(
            '\n'
          ),
        },
      });
    });

    it('may return an error for incorrect ccid&comment', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const returnCode = 12;
      const messages = [
        '11:33:28  C1G0142E  SYSTEM REQUIRES A CCID TO BE SPECIFIED - REQUEST NOT PERFORMED',
      ];
      mockServer.forAnyRequest().thenJson(
        400,
        {
          returnCode,
          reasonCode: 34,
          reports: null,
          messages,
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          returnCode,
          error: new Error(
            `${['', ...messages.map((message) => message.trim())].join('\n')}`
          ),
        },
      });
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const returnCode = 20;
      const messages = ['Something went really wrong....'];
      mockServer.forAnyRequest().thenJson(
        500,
        {
          returnCode,
          reasonCode: 34,
          reports: null,
          messages,
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const updatedContent = 'very important content';
      const existingFingerprint = '12345';
      const element: ElementWithFingerprint = {
        content: updatedContent,
        fingerprint: existingFingerprint,
      };
      const existingElementLocation: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        existingElementLocation
      )(updateActionChangeControlValue)(element);
      // assert
      expect(updateResult).toEqual({
        status: UpdateStatus.ERROR,
        additionalDetails: {
          returnCode,
          error: new Error(
            `${['', ...messages.map((message) => message.trim())].join('\n')}`
          ),
        },
      });
    });
  });

  describe('adding element', () => {
    const content = 'Very important addition!';

    it('should return void if everything is OK and an element is added', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: [],
          messages: [],
          reports: [],
          returnCode: 0,
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(addResult).toBeUndefined();
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const addResult = await addElement(logger)(progress)(nonExistingService)(
        element
      )(addActionChangeControlValue)(content);
      // assert
      expect(isConnectionError(addResult)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
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
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(isWrongCredentialsError(addResult)).toBe(true);
    });

    it('should return an error for partially element location specified', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
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
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for incorrect content', async () => {
      // arrange
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const addResult = await addElement(logger)(progress)(nonExistingService)(
        element
      )(addActionChangeControlValue)(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for incorrect ccid&comment', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
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
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });

    it('should return an error for duplicate element', async () => {
      // arrange
      const expectedMessage = 'C1G0024E  THE ELEMENT WAS ALREADY PRESENT.';
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
        500,
        {
          returnCode: 12,
          reasonCode: 34,
          reports: null,
          messages: [expectedMessage],
          data: [],
        },
        {
          'content-type': 'application/json',
          version: '2.5',
        }
      );
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(isDuplicateElementError(addResult)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
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
      const element: ElementMapPath = {
        configuration: 'TEST-CONFIG',
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
      const service = toService(mockServer.url);
      // act
      const addResult = await addElement(logger)(progress)(service)(element)(
        addActionChangeControlValue
      )(content);
      // assert
      expect(isError(addResult)).toBe(true);
    });
  });

  describe('retrieving an element with fingerprint', () => {
    const toRequestPath =
      (basePath: string) =>
      ({
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string =>
        join(
          basePath,
          configuration,
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

    it('should return an element content with a fingerprint', async () => {
      // arrange
      const element: Element = {
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
        query: `?ccid=${signoutChangeControlValue.ccid}&comment=${signoutChangeControlValue.comment}&oveSign=no&signout=yes&toFileDescription=via%20Zowe%20CLI%20command`,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
        query: `?ccid=${signoutChangeControlValue.ccid}&comment=${signoutChangeControlValue.comment}&oveSign=yes&signout=yes&toFileDescription=via%20Zowe%20CLI%20command`,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const response: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
        configuration: 'TEST-CONFIG',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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
        configuration: 'TEST-CONFIG',
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
          version: '2.5',
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

  describe('retrieving an element with dependencies', () => {
    // we do not test the requests queue
    const requestPoolMaxSize = 1;

    const toRequestPath =
      (basePath: string) =>
      ({
        configuration,
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        name,
      }: Element): string => {
        return join(
          basePath,
          configuration,
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
    it('should return an element with deps', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const mainElementContentResponse: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      const elementDepsRequest: MockRequest<unknown> = {
        method: 'GET',
        path: `${toRequestPath(basePath)(mainElement)}/acm`,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: '?excCirculars=yes&excIndirect=yes&excRelated=yes',
      };
      const elementDependency: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYP2',
        name: 'TEST-EL2',
        extension: 'ext',
      };
      const elementDepsResponse: MockResponse<unknown> = {
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
          data: [
            {
              components: [
                {
                  envName: elementDependency.environment,
                  stgNum: elementDependency.stageNumber,
                  sysName: elementDependency.system,
                  sbsName: elementDependency.subSystem,
                  typeName: elementDependency.type,
                  elmName: elementDependency.name,
                  fileExt: elementDependency.extension,
                  fullElmName: elementDependency.name,
                },
              ],
            },
          ],
        },
      };
      const elementDependenciesEndpoint = await mockEndpoint(
        elementDepsRequest,
        elementDepsResponse
      )(mockServer);
      const dependencyRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(elementDependency),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const dependencyContent = 'DEP CONTENT';
      const dependencyFingerprint = 'Dep Fingerprint';
      const dependencyContentResponse: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: dependencyFingerprint,
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(dependencyContent, 'utf-8'),
      };
      const retrieveDependencyEndpoint = await mockEndpoint(
        dependencyRetrieveRequest,
        dependencyContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      let seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);
      seenRequests = await elementDependenciesEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);
      seenRequests = await retrieveDependencyEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;

      expect(actualElement.content).toStrictEqual(elementContent);
      expect(actualElement.dependencies).toStrictEqual([
        [elementDependency, dependencyContent],
      ]);
    });
    it('should return an element without deps', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const mainElementContentResponse: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      const elementDepsRequest: MockRequest<unknown> = {
        method: 'GET',
        path: `${toRequestPath(basePath)(mainElement)}/acm`,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: '?excCirculars=yes&excIndirect=yes&excRelated=yes',
      };

      const elementDepsResponse: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          version: '2.5',
          'content-type': 'application/json',
        },
        data: {
          returnCode: '0004',
          reasonCode: '0014',
          reports: {},
          data: null,
          messages: [
            'API0000W  NO RELATIONSHIPS EXISTS FOR THIS ELEMENT OR THEY WERE FILTERED OUT',
          ],
        },
      };
      const elementDependenciesEndpoint = await mockEndpoint(
        elementDepsRequest,
        elementDepsResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      let seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);
      seenRequests = await elementDependenciesEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;

      expect(actualElement.content).toStrictEqual(elementContent);
      expect(actualElement.dependencies).toStrictEqual([]);
    });
    it('should return an element with no dependencies in case anything went wrong with the dependencies retrieving', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const elementContent = 'ELEMENT CONTENT';
      const elementFingerprint = 'Element Fingerprint';
      const mainElementContentResponse: MockResponse<Buffer> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          fingerprint: elementFingerprint,
          version: '2.5',
          'content-type': 'application/octet-stream;charset=UTF-8',
        },
        data: Buffer.from(elementContent, 'utf-8'),
      };
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      const elementDepsRequest: MockRequest<unknown> = {
        method: 'GET',
        path: `${toRequestPath(basePath)(mainElement)}/acm`,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: '?excCirculars=yes&excIndirect=yes&excRelated=yes',
      };
      const elementDependency: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYP2',
        name: 'TEST-EL2',
        extension: 'ext',
      };
      const elementDepsResponse: MockResponse<unknown> = {
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
          data: [
            {
              components: [
                {
                  envName: elementDependency.environment,
                  stgNum: elementDependency.stageNumber,
                  sysName: elementDependency.system,
                  sbsName: elementDependency.subSystem,
                  typeName: elementDependency.type,
                  elmName: elementDependency.name,
                  fileExt: elementDependency.extension,
                  fullElmName: elementDependency.name,
                },
              ],
            },
          ],
        },
      };
      const elementDependenciesEndpoint = await mockEndpoint(
        elementDepsRequest,
        elementDepsResponse
      )(mockServer);
      const dependencyRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(elementDependency),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const dependencyContentResponse: MockResponse<unknown> = {
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
      const retrieveDependencyEndpoint = await mockEndpoint(
        dependencyRetrieveRequest,
        dependencyContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      let seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);
      seenRequests = await elementDependenciesEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);
      seenRequests = await retrieveDependencyEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(false);
      if (isError(actualElement)) return;

      expect(actualElement.content).toStrictEqual(elementContent);
      expect(actualElement.dependencies.length).toStrictEqual(1);
      expect(actualElement.dependencies[0]?.[0]).toStrictEqual(
        elementDependency
      );
      expect(isError(actualElement.dependencies[0]?.[1])).toBe(true);
    });
    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      // act
      const nonExistingService = toService(nonExistingServerURL);
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service: nonExistingService,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      expect(isError(actualElement)).toBe(true);
    });
    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const mainElementContentResponse: MockResponse<unknown> = {
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
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      const seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(true);
    });
    it('should return an error in case of non existing element location', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const mainElementContentResponse: MockResponse<unknown> = {
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
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      const seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(true);
    });
    it('should return a signout error in case the element is signed out to somebody else', async () => {
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const mainElementContentResponse: MockResponse<unknown> = {
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
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      const seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isSignoutError(actualElement)).toBe(true);
    });
    it('should return an error in case of something went wrong on the Endevor side', async () => {
      //
      // arrange
      const credential: BaseCredential = {
        user: 'test',
        password: 'test',
        type: CredentialType.BASE,
      };
      const mainElement: Element = {
        configuration: 'TEST-CONFIG',
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        name: 'TEST-EL1',
        extension: 'ext',
      };
      const mainElementRetrieveRequest: MockRequest<unknown> = {
        method: 'GET',
        path: toRequestPath(basePath)(mainElement),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const mainElementContentResponse: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Internal server error',
        headers: {
          version: '2.5',
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
      const mainElementRetrieveEndpoint = await mockEndpoint(
        mainElementRetrieveRequest,
        mainElementContentResponse
      )(mockServer);
      // act
      const service = toService(
        mockServer.urlFor(toRequestPath(basePath)(mainElement))
      );
      const actualElement = await retrieveElementWithDependenciesWithoutSignout(
        logger
      )(progress)({
        service,
        requestPoolMaxSize,
      })(mainElement);
      // assert
      const seenRequests = await mainElementRetrieveEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(isError(actualElement)).toBe(true);
    });
  });
});
