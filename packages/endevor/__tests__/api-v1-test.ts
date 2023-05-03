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

/* eslint-disable jest/no-commented-out-tests */
import { Logger } from '@local/extension/_doc/Logger';
import { getLocal } from 'mockttp';
import { URL } from 'url';
import {
  getAllEnvironmentStages,
  getAllSubSystems,
  getAllSystems,
  getAllElementTypes,
  printElement,
  getApiVersion,
  searchForFirstFoundElements,
  signInElement,
  retrieveElementWithoutSignout,
  retrieveElementWithSignout,
  getConfigurations,
  searchForAllElements,
  searchForElementsInPlace,
  updateElement,
  printListing,
  generateSubSystemElementsInPlace,
  getAuthenticationToken,
  downloadReportById,
} from '../endevor';
import { mockEndpoint } from '../testUtils';
import { toEndevorProtocol, isErrorEndevorResponse, isDefined } from '../utils';
import { MockRequest, MockResponse } from '../_doc/MockServer';
import { ProgressReporter } from '../_doc/Progress';
import { BaseCredential, CredentialType } from '../_doc/Credential';
import {
  Element,
  ElementDataWithFingerprint,
  ServiceLocation,
  Service,
  ServiceApiVersion,
  ElementMapPath,
  SystemResponseObject,
  SubSystemResponseObject,
  ServiceBasePath,
  ActionChangeControlValue,
  ResponseStatus,
  EnvironmentStageMapPath,
  SystemMapPath,
  SubSystemMapPath,
  ElementTypeResponseObject,
  ElementTypeMapPath,
  SearchStrategies,
  Value,
  ErrorResponseType,
} from '../_doc/Endevor';
import { join } from 'path';
import { ANY_VALUE } from '../const';
import * as fs from 'fs';
import assert = require('assert');

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
const credential: BaseCredential = {
  user: 'test',
  password: 'test',
  type: CredentialType.BASE,
};
const configuration = 'TEST-CONFIG';

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
  });

const makeListQuery =
  (basePath: string) =>
  ({
    data,
    search,
    firstFound,
  }: {
    search: boolean;
    firstFound: boolean;
    data?: 'ALL' | 'BAS' | 'ELE' | 'COMP';
  }): string => {
    const apiVersion = toApiVersion(basePath);
    let searchParam: 'yes' | 'no' | 'SEA' | 'NOS';
    switch (apiVersion) {
      case ServiceApiVersion.V1:
        searchParam = search ? 'SEA' : 'NOS';
        break;
      case ServiceApiVersion.V2:
        searchParam = search ? 'yes' : 'no';
        break;
    }
    return `?${data ? `data=${data}&` : ''}search=${searchParam}&return=${
      firstFound ? 'FIR' : 'ALL'
    }`;
  };

const makeRetrieveQuery =
  (basePath: string) =>
  ({
    ccid,
    comment,
    search,
    signout,
    overrideSignout,
  }: {
    comment: string;
    ccid: string;
    search: boolean;
    signout: boolean;
    overrideSignout: boolean;
  }): string => {
    const apiVersion = toApiVersion(basePath);
    const searchParam = search ? 'yes' : 'no';
    const signOutParam = signout ? 'yes' : 'no';
    const overrideSignOutParam = overrideSignout ? 'yes' : 'no';
    let query;
    switch (apiVersion) {
      case ServiceApiVersion.V1:
        query = `?ccid=${ccid}&comment=${comment}&oveSign=${overrideSignOutParam}&signout=${signOutParam}&search=${searchParam}&toFileDescription=via%20Zowe%20CLI%20command&noSignout=N`;
        break;
      case ServiceApiVersion.V2:
        query = `?ccid=${ccid}&comment=${comment}&oveSign=${overrideSignOutParam}&signout=${signOutParam}&search=${searchParam}&toFileDescription=via%20Zowe%20CLI%20command`;
        break;
    }
    return query;
  };

describe('endevor public api v1', () => {
  const basePath = ServiceBasePath.LEGACY;

  // server mock helpers
  const toServiceLocation = makeServiceLocation(basePath);
  const toService = makeService(basePath, credential);
  const toListQuery = makeListQuery(basePath);
  const toRetrieveQuery = makeRetrieveQuery(basePath);

  // generic Endevor response mocks
  const responseHeaders = {
    'api-version': '1.1',
    'content-type': 'application/json',
  };
  const nonExistingConfigurationResponse: MockResponse<unknown> = {
    status: 500,
    statusMessage: 'Internal Server Error',
    headers: responseHeaders,
    data: {
      returnCode: '0016',
      reasonCode: '0000',
      reports: null,
      messages: [
        `EWS1101E Configuration ${configuration} is not defined or is invalid`,
      ],
      data: null,
    },
  };
  const wrongCredentialsResponse: MockResponse<unknown> = {
    status: 500,
    statusMessage: 'Internal Server Error',
    headers: responseHeaders,
    data: {
      returnCode: '0020',
      reasonCode: '0034',
      reports: null,
      messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
      data: null,
    },
  };
  const invalidFormatResponse: MockResponse<unknown> = {
    status: 200,
    statusMessage: 'OK',
    headers: responseHeaders,
    data: {
      returnCode: 'some unexpected Endevor response data',
      reasonCode: '0000',
      reports: null,
      data: null,
      messages: null,
    },
  };
  const unauthorizedResponse: MockResponse<unknown> = {
    status: 401,
    statusMessage: 'Unauthorized',
    headers: responseHeaders,
    data: '<html>401 - Unauthorized</html>',
  };
  const criticalFailureResponse: MockResponse<unknown> = {
    status: 500,
    statusMessage: 'Internal Server Error',
    headers: responseHeaders,
    data: 'some server failure info',
  };

  describe('fetching an api version', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: `${basePath}/`,
      headers: {},
      body: null,
    };

    it('should return a proper api version', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: [],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const apiVersionResponse = await getApiVersion(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        !isErrorEndevorResponse(apiVersionResponse) &&
          apiVersionResponse.result === toApiVersion(basePath)
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: {
          'invalid-version-header': 'invalid version value',
        },
        data: "doesn't matter in this case",
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const apiVersionResponse = await getApiVersion(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(apiVersionResponse) &&
          apiVersionResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation = toServiceLocation(nonExistingServerURL);
      // act
      const apiVersionResponse = await getApiVersion(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(
        isErrorEndevorResponse(apiVersionResponse) &&
          apiVersionResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const apiVersionResponse = await getApiVersion(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(apiVersionResponse) &&
          apiVersionResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
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
        headers: responseHeaders,
        data: [...validConfigurations, ...invalidConfigurations],
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const configurationsResponse = await getConfigurations(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(configurationsResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : configurationsResponse.result
      ).toEqual(validConfigurations);
    });

    it('should return an error if response data parsing failed', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const configurationsResponse = await getConfigurations(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(configurationsResponse) &&
          configurationsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const incorrectServiceLocation = toServiceLocation(nonExistingServerURL);
      // act
      const configurationsResponse = await getConfigurations(logger)(progress)(
        incorrectServiceLocation
      )(rejectUnauthorized);
      // assert
      expect(
        isErrorEndevorResponse(configurationsResponse) &&
          configurationsResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const serviceLocation = toServiceLocation(
        mockServer.urlFor(request.path)
      );
      // act
      const configurationsResponse = await getConfigurations(logger)(progress)(
        serviceLocation
      )(rejectUnauthorized);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(configurationsResponse) &&
          configurationsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('getting an authentication token', () => {
    const request: MockRequest<null> = {
      method: 'GET',
      path: join(basePath, configuration, 'auth'),
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${toBase64(credential)}`,
      },
      body: null,
    };

    it('should fetch an authentication token', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: '0000',
          reasonCode: '0000',
          token: 'secured-a-lot',
          tokenCreatedOn: '2022/12/12 22:22:22',
          tokenValidFor: '10',
          messages: '',
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        !isErrorEndevorResponse(actualResponse) &&
          isDefined(actualResponse.result) &&
          actualResponse.result !== null
      ).toBe(true);
    });

    it('should return null if tokens are not configured', async () => {
      // arrange
      const response: MockResponse<unknown> = {
        status: 206,
        statusMessage: 'Partial Content',
        headers: responseHeaders,
        data: {
          returnCode: '0008',
          reasonCode: '0025',
          token: null,
          tokenCreatedOn: null,
          tokenValidFor: null,
          messages: 'Token not generated. Passticket Service is not set.',
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        !isErrorEndevorResponse(actualResponse) &&
          isDefined(actualResponse.result) &&
          actualResponse.result == null
      ).toBe(true);
    });

    it('should return an error in case of an incorrect (nonexisting) configuration', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        nonExistingConfigurationResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        nonExistingService
      )(configuration);
      // assert
      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
      // arrange
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await getAuthenticationToken(logger)(progress)(
        service
      )(configuration);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('fetching all environment stages', () => {
    const toRequestPath =
      (basePath: string) =>
      (
        configuration: string,
        environment: string = ANY_VALUE,
        stageNumber: string = ANY_VALUE
      ): string => {
        return join(
          basePath,
          configuration,
          'env',
          environment,
          'stgnum',
          stageNumber
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
          stgId: '1',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: null,
          nextStageNumber: null,
          stgId: '1',
        },
      ];
      const expectedEnvironmentStages = validEnvironments.map((env) => {
        if (env.nextEnvironment && env.nextStageNumber) {
          return {
            environment: env.environment,
            stageId: env.stgId,
            stageNumber: env.stageNumber,
            nextEnvironment: env.nextEnvironment,
            nextStageNumber: env.nextStageNumber,
          };
        }
        return {
          environment: env.environment,
          stageId: env.stgId,
          stageNumber: env.stageNumber,
        };
      });
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
        headers: responseHeaders,
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
                stgId: element.stgId,
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
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(environmentStagesResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : environmentStagesResponse.result
      ).toEqual(expectedEnvironmentStages);
    });

    it('should return filtered environment stages from specific stage', async () => {
      // arrange
      const searchParams: EnvironmentStageMapPath = {
        environment: 'TEST-ENV1',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: true, firstFound: false }),
        body: null,
      };
      const validEnvironments = [
        {
          environment: 'TEST-ENV1',
          stageNumber: '1',
          nextEnvironment: 'FINAL-ENV',
          nextStageNumber: '1',
          stgId: '1',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: null,
          nextStageNumber: null,
          stgId: '1',
        },
      ];
      const expectedEnvironmentStages = validEnvironments.map((env) => {
        if (env.nextEnvironment && env.nextStageNumber) {
          return {
            environment: env.environment,
            stageId: env.stgId,
            stageNumber: env.stageNumber,
            nextEnvironment: env.nextEnvironment,
            nextStageNumber: env.nextStageNumber,
          };
        }
        return {
          environment: env.environment,
          stageId: env.stgId,
          stageNumber: env.stageNumber,
        };
      });
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
        headers: responseHeaders,
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
                stgId: element.stgId,
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
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)(searchParams);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(environmentStagesResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : environmentStagesResponse.result
      ).toEqual(expectedEnvironmentStages);
    });

    it('should return all environment stages across all the environment stages', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: false, firstFound: false }),
        body: null,
      };
      const validEnvironments = [
        {
          environment: 'TEST-ENV1',
          stageNumber: '1',
          stgId: '1',
          nextEnvironment: 'FINAL-ENV',
          nextStageNumber: '1',
        },
        {
          environment: 'FINAL-ENV',
          stageNumber: '1',
          nextEnvironment: null,
          nextStageNumber: null,
          stgId: '1',
        },
      ];
      const expectedEnvironmentStages = validEnvironments.map((env) => {
        if (env.nextEnvironment && env.nextStageNumber) {
          return {
            environment: env.environment,
            stageId: env.stgId,
            stageNumber: env.stageNumber,
            nextEnvironment: env.nextEnvironment,
            nextStageNumber: env.nextStageNumber,
          };
        }
        return {
          environment: env.environment,
          stageId: env.stgId,
          stageNumber: env.stageNumber,
        };
      });
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: element.stgId,
                nextEnv: element.nextEnvironment,
                nextStgNum: element.nextStageNumber,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(environmentStagesResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : environmentStagesResponse.result
      ).toEqual(expectedEnvironmentStages);
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
      const endevorEndpoint = await mockEndpoint(
        request,
        nonExistingConfigurationResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
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
      const endevorEndpoint = await mockEndpoint(
        request,
        wrongCredentialsResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type ===
            ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(nonExistingService)(configuration)();
      // assert
      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const environmentStagesResponse = await getAllEnvironmentStages(logger)(
        progress
      )(service)(configuration)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(environmentStagesResponse) &&
          environmentStagesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('fetching systems', () => {
    const toRequestPath =
      (basePath: string) =>
      (
        configuration: string,
        environment: string = ANY_VALUE,
        stageNumber: string = ANY_VALUE,
        system: string = ANY_VALUE
      ): string => {
        return join(
          basePath,
          configuration,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system
        );
      };

    it('should return the list of filtered systems', async () => {
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
      const validSystems: ReadonlyArray<SystemResponseObject> = [
        {
          environment: 'TEST',
          stageId: 'P',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST',
          stageId: '2',
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
        headers: responseHeaders,
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
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSystems.map((system: any) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(systemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : systemsResponse.result).toEqual(
        validSystems
      );
    });

    it('should return the list of all systems searching in the specific environment stage', async () => {
      // arrange
      const searchParams: EnvironmentStageMapPath = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: true, firstFound: false }),
        body: null,
      };
      const validSystems: ReadonlyArray<SystemResponseObject> = [
        {
          environment: 'TEST',
          stageId: 'P',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST',
          stageId: '2',
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
        headers: responseHeaders,
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
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSystems.map((system: any) => {
              return {
                envName: system.environment,
                sysName: system.system,
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(systemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : systemsResponse.result).toEqual(
        validSystems
      );
    });

    it('should return the list of all systems searching across all environment stages', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
        query: toListQuery({ search: false, firstFound: true }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSystems: ReadonlyArray<SystemResponseObject> = [
        {
          environment: 'TEST',
          stageId: '1',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS',
        },
        {
          environment: 'TEST1',
          stageId: '2',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST2',
          stageId: '2',
          system: 'TEST-SYS2',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(systemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : systemsResponse.result).toEqual(
        validSystems
      );
    });

    it('should return the list of systems in the specific environment stage', async () => {
      // arrange
      const searchParams: EnvironmentStageMapPath = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        query: toListQuery({ search: false, firstFound: true }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSystems: ReadonlyArray<SystemResponseObject> = [
        {
          environment: 'TEST',
          stageId: '1',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS',
        },
        {
          environment: 'TEST1',
          stageId: '2',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )(searchParams)(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(systemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : systemsResponse.result).toEqual(
        validSystems
      );
    });

    it('should return the route for a system searching from specific environment stage', async () => {
      // arrange
      const searchParams: SystemMapPath = {
        environment: 'TEST',
        stageNumber: '1',
        system: 'TEST-SYS',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber,
          searchParams.system
        ),
        query: toListQuery({ search: true, firstFound: false }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSystems: ReadonlyArray<SystemResponseObject> = [
        {
          environment: searchParams.environment,
          stageId: searchParams.stageNumber,
          system: searchParams.system,
          nextSystem: 'TEST-SYS',
        },
        {
          environment: 'TEST',
          stageId: '2',
          system: 'TEST-SYS',
          nextSystem: 'TEST-SYS2',
        },
        {
          environment: 'TEST2',
          stageId: '2',
          system: 'TEST-SYS2',
          nextSystem: 'TEST-SYS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: system.stageId,
                nextSys: system.nextSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(systemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : systemsResponse.result).toEqual(
        validSystems
      );
    });

    it('should return an error in case of incorrect (nonexisting) configuration', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        nonExistingConfigurationResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
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
      const endevorEndpoint = await mockEndpoint(
        request,
        wrongCredentialsResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type === ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const configurationName = 'TEST';
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(
        nonExistingService
      )(configurationName)({})(SearchStrategies.ALL);
      // assert
      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const systemsResponse = await getAllSystems(logger)(progress)(service)(
        configuration
      )({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(systemsResponse) &&
          systemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('fetching subsystems', () => {
    const toRequestPath =
      (basePath: string) =>
      (
        configuration: string,
        environment: string = ANY_VALUE,
        stageNumber: string = ANY_VALUE,
        system: string = ANY_VALUE,
        subsystem: string = ANY_VALUE
      ): string => {
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
          subsystem
        );
      };

    it('should return the list of filtered subsystems', async () => {
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
      const validSubSystems: ReadonlyArray<SubSystemResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '1',
          nextSubSystem: 'TEST-SBS1',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '2',
          nextSubSystem: 'TEST-SBS2',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageId: '1',
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
        headers: responseHeaders,
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
                stgId: subsystem.stageId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSubSystems.map((subsystem: any) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.subSystem,
                stgId: subsystem.stgId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(subSystemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : subSystemsResponse.result).toEqual(
        validSubSystems
      );
    });

    it('should return the list of all subsystems when searching from specific environment stage', async () => {
      // arrange
      const searchParams: EnvironmentStageMapPath = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        query: toListQuery({ search: true, firstFound: false }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystemResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '1',
          nextSubSystem: 'TEST-SBS1',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '2',
          nextSubSystem: 'TEST-SBS2',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageId: '1',
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
        headers: responseHeaders,
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
                stgId: subsystem.stageId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidSubSystems.map((subsystem: any) => {
              return {
                envName: subsystem.environment,
                sysName: subsystem.system,
                sbsName: subsystem.subSystem,
                stgId: subsystem.stgId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(subSystemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : subSystemsResponse.result).toEqual(
        validSubSystems
      );
    });

    it('should return the route for a subsystem searching from specific environment stage', async () => {
      // arrange
      const searchParams: SubSystemMapPath = {
        environment: 'TEST',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber,
          searchParams.system,
          searchParams.subSystem
        ),
        query: toListQuery({ search: true, firstFound: false }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystemResponseObject> = [
        {
          environment: searchParams.environment,
          system: searchParams.system,
          subSystem: searchParams.subSystem,
          stageId: searchParams.stageNumber,
          nextSubSystem: 'TEST-SBS1',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '2',
          nextSubSystem: 'TEST-SBS2',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageId: '1',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: subsystem.stageId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(subSystemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : subSystemsResponse.result).toEqual(
        validSubSystems
      );
    });

    it('should return the list of all subsystems searching across all the environments', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration),
        query: toListQuery({ search: false, firstFound: true }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystemResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '1',
          nextSubSystem: 'TEST-SBS1',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '2',
          nextSubSystem: 'TEST-SBS2',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS2',
          stageId: '1',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: subsystem.stageId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(subSystemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : subSystemsResponse.result).toEqual(
        validSubSystems
      );
    });

    it('should return the list of all subsystems in the specific environment stage', async () => {
      // arrange
      const searchParams: EnvironmentStageMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        query: toListQuery({ search: false, firstFound: true }),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const validSubSystems: ReadonlyArray<SubSystemResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '1',
          nextSubSystem: 'TEST-SBS1',
        },
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS1',
          stageId: '2',
          nextSubSystem: 'TEST-SBS2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                stgId: subsystem.stageId,
                nextSbs: subsystem.nextSubSystem,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(subSystemsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : subSystemsResponse.result).toEqual(
        validSubSystems
      );
    });

    it('should return an error in case of incorrect (nonexisting) configuration', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        nonExistingConfigurationResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
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
      const endevorEndpoint = await mockEndpoint(
        request,
        wrongCredentialsResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type ===
            ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        nonExistingService
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor side', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const subSystemsResponse = await getAllSubSystems(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(subSystemsResponse) &&
          subSystemsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('fetching element types', () => {
    const toRequestPath =
      (basePath: string) =>
      (
        configuration: string,
        environment: string = ANY_VALUE,
        stageNumber: string = ANY_VALUE,
        system: string = ANY_VALUE,
        type: string = ANY_VALUE
      ): string => {
        return join(
          basePath,
          configuration,
          'env',
          environment,
          'stgnum',
          stageNumber,
          'sys',
          system,
          'type',
          type
        );
      };

    it('should return the list of filtered element types', async () => {
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
      const validElementTypes: ReadonlyArray<ElementTypeResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageId: '1',
          type: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
      ];
      const invalidElementTypes: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageNumber: '2',
          typeName: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElementTypes.map((elementType) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.type,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidElementTypes.map((elementType: any) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.typeName,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementTypesResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementTypesResponse.result).toEqual(
        validElementTypes
      );
    });

    it('should return the list of all element types searching from specific environment stage', async () => {
      // arrange
      const searchParams: Readonly<EnvironmentStageMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: true, firstFound: false }),
        body: null,
      };
      const validElementTypes: ReadonlyArray<ElementTypeResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageId: '1',
          type: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
      ];
      const invalidElementTypes: ReadonlyArray<unknown> = [
        {
          // environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageNumber: '2',
          typeName: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElementTypes.map((elementType) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.type,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...invalidElementTypes.map((elementType: any) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.typeName,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementTypesResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementTypesResponse.result).toEqual(
        validElementTypes
      );
    });

    it('should return the list of all element types searching across all environment stages', async () => {
      // arrange
      const searchParams: Readonly<EnvironmentStageMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: false, firstFound: true }),
        body: null,
      };
      const validElementTypes: ReadonlyArray<ElementTypeResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageId: '1',
          type: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
        {
          environment: 'TEST-ENV1',
          system: 'TEST-SYS1',
          stageId: '2',
          type: 'TYPE1',
          nextType: 'NEXT_TYPE1',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS2',
          stageId: '2',
          type: 'TYPE2',
          nextType: 'NEXT_TYPE2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElementTypes.map((elementType) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.type,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementTypesResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementTypesResponse.result).toEqual(
        validElementTypes
      );
    });

    it('should return the route for element types searching from specific environment stage', async () => {
      // arrange
      const searchParams: Readonly<ElementTypeMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
        system: 'TEST-SYS',
        type: 'TEST-TYPE',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber,
          searchParams.system,
          searchParams.type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: true, firstFound: false }),
        body: null,
      };
      const validElementTypes: ReadonlyArray<ElementTypeResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageId: '1',
          type: 'TYPE',
          nextType: 'NEXT_TYPE',
        },
        {
          environment: 'TEST-ENV1',
          system: 'TEST-SYS1',
          stageId: '2',
          type: 'TYPE1',
          nextType: 'NEXT_TYPE1',
        },
        {
          environment: 'TEST-ENV2',
          system: 'TEST-SYS2',
          stageId: '2',
          type: 'TYPE2',
          nextType: 'NEXT_TYPE2',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElementTypes.map((elementType) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.type,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementTypesResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementTypesResponse.result).toEqual(
        validElementTypes
      );
    });

    it('should return element types searching in place', async () => {
      // arrange
      const searchParams: Readonly<ElementTypeMapPath> = {
        environment: 'TEST',
        stageNumber: '1',
        system: 'TEST-SYS',
        type: 'TEST-TYPE',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          searchParams.environment,
          searchParams.stageNumber,
          searchParams.system,
          searchParams.type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        query: toListQuery({ search: false, firstFound: true }),
        body: null,
      };
      const validElementTypes: ReadonlyArray<ElementTypeResponseObject> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          stageId: '1',
          type: 'TEST-TYPE',
          nextType: 'NEXT_TYPE',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 0,
          reasonCode: 0,
          reports: {},
          messages: [],
          data: [
            ...validElementTypes.map((elementType) => {
              return {
                envName: elementType.environment,
                sysName: elementType.system,
                typeName: elementType.type,
                stgId: elementType.stageId,
                nextType: elementType.nextType,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)(searchParams)(SearchStrategies.IN_PLACE);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementTypesResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementTypesResponse.result).toEqual(
        validElementTypes
      );
    });

    it('should return an error in case of incorrect (nonexisting) configuration', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        nonExistingConfigurationResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
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
      const endevorEndpoint = await mockEndpoint(
        request,
        wrongCredentialsResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type ===
            ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error in case of incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        nonExistingService
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor sides', async () => {
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
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementTypesResponse = await getAllElementTypes(logger)(progress)(
        service
      )(configuration)({})(SearchStrategies.ALL);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementTypesResponse) &&
          elementTypesResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('searching elements', () => {
    const toRequestPath =
      (basePath: string) =>
      (
        configuration: string,
        environment: string = ANY_VALUE,
        stageNumber: string = ANY_VALUE,
        system: string = ANY_VALUE,
        subsystem: string = ANY_VALUE,
        type: string = ANY_VALUE,
        element: string = ANY_VALUE
      ): string => {
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
          subsystem,
          'type',
          type,
          'ele',
          element
        );
      };

    const dataQuery = 'ALL';
    const environmentStageLocation: EnvironmentStageMapPath = {
      environment: 'TEST-ENV',
      stageNumber: '1',
    };
    const system = 'TEST-SYS';
    const subsystem = 'TEST-SBS';
    const type = 'TEST-TYPE';

    it('should return all filtered elements', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toListQuery({
          data: dataQuery,
          search: true,
          firstFound: false,
        }),
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          id: 'TEST-EL1',
          name: 'TEST-EL1',
          noSource: false,
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          configuration: 'TEST-CONFIG',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                elmName: element.id,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
                fullElmName: element.name,
                lastActCcid: element.lastActionCcid,
                nosource: element.noSource ? 'Y' : 'N',
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
                lastActCcid: element.lastActionCcid,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForAllElements(logger)(progress)(
        service
      )(configuration)(environmentStageLocation)(system, subsystem, type);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementsResponse.result).toEqual(
        validElements
      );
    });

    it('should return filtered elements in place', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toListQuery({
          data: dataQuery,
          search: false,
          firstFound: true,
        }),
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          id: 'TEST-EL1',
          name: 'TEST-EL1',
          noSource: false,
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          configuration: 'TEST-CONFIG',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                elmName: element.id,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
                fullElmName: element.name,
                lastActCcid: element.lastActionCcid,
                nosource: element.noSource ? 'Y' : 'N',
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
                lastActCcid: element.lastActionCcid,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForElementsInPlace(logger)(progress)(
        service
      )(configuration)(environmentStageLocation)(system, subsystem, type);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementsResponse.result).toEqual(
        validElements
      );
    });

    it('should return filtered first found elements', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toListQuery({
          data: dataQuery,
          search: true,
          firstFound: true,
        }),
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          id: 'TEST-EL1',
          name: 'TEST-EL1',
          noSource: false,
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          configuration: 'TEST-CONFIG',
          lastActionCcid: 'TEST-CCID',
          nosource: false,
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                elmName: element.id,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
                fullElmName: element.name,
                lastActCcid: element.lastActionCcid,
                nosource: element.noSource ? 'Y' : 'N',
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
                lastActCcid: element.lastActionCcid,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementsResponse.result).toEqual(
        validElements
      );
    });

    it('should return filtered elements for partially specified search location', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toListQuery({
          data: dataQuery,
          search: true,
          firstFound: true,
        }),
      };
      const validElements: ReadonlyArray<Element> = [
        {
          environment: 'TEST-ENV',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          id: 'TEST-EL1',
          name: 'TEST-EL1',
          noSource: false,
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const invalidElements: ReadonlyArray<unknown> = [
        {
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
          name: 'TEST-EL2',
          type: 'TEST-TYPE',
          stageNumber: '1',
          extension: 'ext',
          configuration: 'TEST-CONFIG',
          lastActionCcid: 'TEST-CCID',
        },
      ];
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
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
                elmName: element.id,
                typeName: element.type,
                stgNum: element.stageNumber,
                fileExt: element.extension,
                fullElmName: element.name,
                lastActCcid: element.lastActionCcid,
                nosource: element.noSource ? 'Y' : 'N',
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
                lastActCcid: element.lastActionCcid,
              };
            }),
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)();
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      const isErrorResponse = isErrorEndevorResponse(elementsResponse);
      expect(isErrorResponse).toBe(false);
      expect(isErrorResponse ? undefined : elementsResponse.result).toEqual(
        validElements
      );
    });

    // TODO
    // it('should return filtered elements for search location with any environment', async () => {});

    // TODO this case requires extra discussions
    it.skip('should return an error for incorrect search location', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toListQuery({
          data: dataQuery,
          search: true,
          firstFound: true,
        }),
      };
      const response: MockResponse<unknown> = {
        status: 200,
        statusMessage: 'OK',
        headers: responseHeaders,
        data: {
          returnCode: 4,
          reasonCode: 3,
          reports: {},
          messages: [],
          data: [],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error in case of incorrect credentials', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        wrongCredentialsResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error if response data parsing failed', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        invalidFormatResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });

    it('should return an error for unauthorized request', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        unauthorizedResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type === ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
      ).toBe(true);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(nonExistingService)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
    });

    it('should return an error in case of critical failure on Endevor sides', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(
          configuration,
          environmentStageLocation.environment,
          environmentStageLocation.stageNumber,
          system,
          subsystem,
          type
        ),
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const endevorEndpoint = await mockEndpoint(
        request,
        criticalFailureResponse
      )(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const elementsResponse = await searchForFirstFoundElements(logger)(
        progress
      )(service)(configuration)(environmentStageLocation)(
        system,
        subsystem,
        type
      );
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(elementsResponse) &&
          elementsResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('printing elements', () => {
    const configuration = 'TEST-INST';
    const toRequestPath =
      (configuration: Value) =>
      ({
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        id: name,
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

    it('should return element content with history', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const requestQuery = '?print=BROWSE&headings=no&noHeadings=Y';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(configuration)(element),
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
          ...responseHeaders,
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await printElement(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);
      if (isErrorEndevorResponse(actualResponse)) {
        assert.fail(
          `Print element failed because of: ${actualResponse.details.messages}`
        );
      }
      expect(actualResponse.result).toStrictEqual(content);
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualResponse = await printElement(logger)(progress)(
        nonExistingService
      )(configuration)(element);
      // assert
      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const requestQuery = '?print=BROWSE&headings=no&noHeadings=Y';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(configuration)(element),
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
        headers: responseHeaders,
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
      const actualResponse = await printElement(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error for partially specified element location', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const requestQuery = '?print=BROWSE&headings=no&noHeadings=Y';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(configuration)(element),
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
        headers: responseHeaders,
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
      const actualResponse = await printElement(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error for incorrect element location', async () => {
      // arrange
      const invalidElement: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        id: 'ELM',
      };
      const requestQuery = '?print=BROWSE&headings=no&noHeadings=Y';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(configuration)(invalidElement),
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
        headers: responseHeaders,
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
      const actualResponse = await printElement(logger)(progress)(service)(
        configuration
      )(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const requestQuery = '?print=BROWSE&headings=no&noHeadings=Y';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(configuration)(element),
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
        headers: responseHeaders,
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await printElement(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });
  });

  describe('printing element listings', () => {
    const configuration = 'TEST-INST';
    const toRequestPath =
      (basePath: string) =>
      (configuration: Value) =>
      ({
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        id: name,
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

    it('should return element listing', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
          ...responseHeaders,
          'content-type': 'text/plain',
        },
        data: content,
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualResponse).toStrictEqual({
        status: ResponseStatus.OK,
        result: content,
        details: {
          returnCode: 0,
          messages: [],
        },
      });
    });

    it('should return an error for incorrect connection details', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualResponse = await printListing(logger)(progress)(
        nonExistingService
      )(configuration)(element);
      // assert
      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type === ErrorResponseType.CONNECTION_ERROR
      ).toBe(true);
      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error for incorrect base credentials', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM1',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 401,
        statusMessage: 'Unauthorized',
        headers: responseHeaders,
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
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);
      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error for no component info', async () => {
      // arrange
      const invalidElement: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        id: 'ELM',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(invalidElement),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Bad Request',
        headers: responseHeaders,
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: {
            C1MSGS1: '/reports/1621956951-160920989-C1MSGS1',
          },
          data: [],
          messages: [
            '10:31:53  C1C0004E  NO COMPONENT INFORMATION EXISTS FOR THIS ELEMENT',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);
      expect(
        isErrorEndevorResponse(actualResponse) &&
          actualResponse.type ===
            ErrorResponseType.NO_COMPONENT_INFO_ENDEVOR_ERROR
      ).toBe(true);
    });

    it('should return an error for partially specified element location', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 400,
        statusMessage: 'Bad Request',
        headers: responseHeaders,
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
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error for incorrect element location', async () => {
      // arrange
      const invalidElement: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        id: 'ELM',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(invalidElement),
        headers: {
          Accept: 'text/plain',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: requestQuery,
      };
      const response: MockResponse<unknown> = {
        status: 206,
        statusMessage: 'Partial Content',
        headers: responseHeaders,
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
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(invalidElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const requestQuery = '?print=LISTING&headings=yes&noHeadings=N';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
        headers: responseHeaders,
        data: {
          realData: ['Is it real data or not???'],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      const service = toService(mockServer.urlFor(request.path));
      // act
      const actualResponse = await printListing(logger)(progress)(service)(
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(actualResponse)).toBe(true);
    });
  });

  describe('signing in an element', () => {
    const configuration = 'TEST-INST';
    const element: ElementMapPath = {
      environment: 'TEST-ENV',
      stageNumber: '1',
      system: 'TEST-SYS',
      subSystem: 'TEST-SBS',
      type: 'TEST-TYPE',
      id: 'ELM1',
    };
    const toRequestPath =
      (basePath: string) =>
      (configuration: Value) =>
      ({
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        id: name,
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
        path: toRequestPath(basePath)(configuration)(element),
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
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(!isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should not return error for trying to sign in a not signed out element', async () => {
      // arrange
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(configuration)(element),
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
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(!isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should return error for incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const signInResponse = await signInElement(logger)(progress)(
        nonExistingService
      )(configuration)(element);
      // assert
      expect(isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should return error for incorrect base credentials', async () => {
      // arrange
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(configuration)(element),
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
        configuration
      )(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should return error for partially specified element location', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(configuration)(invalidElementPath),
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
        configuration
      )(invalidElementPath);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should return error for incorrect element location', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'SYS',
        subSystem: 'SBS',
        type: 'COB',
        id: 'ELM',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(configuration)(invalidElementPath),
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
        configuration
      )(invalidElementPath);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(signInResponse)).toBe(true);
    });

    it('should return error if something goes wrong in Endevor side', async () => {
      // arrange
      const invalidElementPath: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: '*',
        type: '*',
        id: '*',
      };
      const request: MockRequest<{ action: string }> = {
        method: 'PUT',
        path: toRequestPath(basePath)(configuration)(invalidElementPath),
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
        configuration
      )(invalidElementPath);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(isErrorEndevorResponse(signInResponse)).toBe(true);
    });
  });

  describe('retrieving an element', () => {
    const configuration = 'TEST-INST';
    const toRequestPath =
      (basePath: string) =>
      (configuration: Value) =>
      ({
        environment,
        stageNumber,
        system,
        subSystem,
        type,
        id: name,
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
    it('should return an element content with a fingerprint', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      const isErrorResponse = isErrorEndevorResponse(retrieveResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.content
      ).toEqual(elementContent);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.fingerprint
      ).toEqual(elementFingerprint);
    });
    it('should return an element up the map content with a fingerprint if the element in place is sourceless', async () => {
      // arrange
      const sourcelessElement: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(sourcelessElement),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(sourcelessElement);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      const isErrorResponse = isErrorEndevorResponse(retrieveResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.content
      ).toEqual(elementUpTheMapContent);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.fingerprint
      ).toEqual(elementFingerprint);
    });
    // this is a known bug
    it('should return an element content in UTF-8 encoding with a fingerprint', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      const isErrorResponse = isErrorEndevorResponse(retrieveResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.content
      ).toEqual(elementContentBuffer.toString('utf-8'));
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.fingerprint
      ).toEqual(elementFingerprint);
    });
    it('should return an element content with a fingerprint with signout', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const signoutChangeControlValue = {
        ccid: 'test',
        comment: 'testComment',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toRetrieveQuery({
          ccid: signoutChangeControlValue.ccid,
          comment: signoutChangeControlValue.comment,
          search: false,
          signout: true,
          overrideSignout: false,
        }),
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
      const retrieveResponse = await retrieveElementWithSignout(logger)(
        progress
      )(service)(configuration)(element)({ signoutChangeControlValue });
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      const isErrorResponse = isErrorEndevorResponse(retrieveResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.content
      ).toEqual(elementContent);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.fingerprint
      ).toEqual(elementFingerprint);
    });
    it('should return an element content with a fingerprint with override signout', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const signoutChangeControlValue = {
        ccid: 'test',
        comment: 'testComment',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
        query: toRetrieveQuery({
          ccid: signoutChangeControlValue.ccid,
          comment: signoutChangeControlValue.comment,
          search: false,
          signout: true,
          overrideSignout: true,
        }),
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
      const retrieveResponse = await retrieveElementWithSignout(logger)(
        progress
      )(service)(configuration)(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      const isErrorResponse = isErrorEndevorResponse(retrieveResponse);
      expect(isErrorResponse).toBe(false);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.content
      ).toEqual(elementContent);
      expect(
        isErrorResponse ? undefined : retrieveResponse.result.fingerprint
      ).toEqual(elementFingerprint);
    });
    it('should return an error if the element fingerprint is missing', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(retrieveResponse) &&
          retrieveResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
    it('should return an error for the incorrect credentials', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `Basic ${toBase64(credential)}`,
        },
        body: null,
      };
      const incorrectCredentialsResponse: MockResponse<unknown> = {
        status: 401,
        statusMessage: 'Unauthorized',
        headers: {
          version: '1.1',
          'content-type': 'application/json',
          fingerprint: 'aaa',
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
        incorrectCredentialsResponse
      )(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(retrieveResponse) &&
          retrieveResponse.type ===
            ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
      ).toBe(true);
    });
    it('should return an error for the incorrect connection details', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(nonExistingService)(configuration)(element);
      // assert
      expect(isErrorEndevorResponse(retrieveResponse)).toBe(true);
    });
    it('should return an error if the element does not exist', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(
        isErrorEndevorResponse(retrieveResponse) &&
          retrieveResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
    it('should return a signout error for the element, signed out to somebody else', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const signoutChangeControlValue = {
        ccid: 'test',
        comment: 'testComment',
      };
      const elementFingerprint = '12345';
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
          fingerprint: elementFingerprint,
        },
        data: {
          returnCode: '12',
          reasonCode: '0',
          reports: null,
          data: [],
          messages: [
            'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC03233',
            '09:30:29  C1G0167E  ELEMENT IS NOT AVAILABLE.  IT IS ALREADY "SIGNED-OUT" TO YOUR MANAGER',
          ],
        },
      };
      const endevorEndpoint = await mockEndpoint(request, response)(mockServer);
      // act
      const service = toService(mockServer.urlFor(request.path));
      const retrieveResponse = await retrieveElementWithSignout(logger)(
        progress
      )(service)(configuration)(element)({ signoutChangeControlValue });
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      expect(seenRequests.length).toBe(1);

      expect(
        isErrorEndevorResponse(retrieveResponse) &&
          retrieveResponse.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
      ).toBe(true);
    });
    it('should return an error if something went wrong on the Endevor side', async () => {
      // arrange
      const element: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'TEST-EL1',
      };
      const request: MockRequest<null> = {
        method: 'GET',
        path: toRequestPath(basePath)(configuration)(element),
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
      const retrieveResponse = await retrieveElementWithoutSignout(logger)(
        progress
      )(service)(configuration)(element);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(
        isErrorEndevorResponse(retrieveResponse) &&
          retrieveResponse.type === ErrorResponseType.GENERIC_ERROR
      ).toBe(true);
    });
  });

  describe('element updating', () => {
    const configuration = 'TEST-INST';
    const updatedContent = 'very important content';
    const tempFilePath = './temp-api-v1-upd-elm.testfile';
    const existingFingerprint = '12345';
    const elementData: ElementDataWithFingerprint = {
      content: updatedContent,
      fingerprint: existingFingerprint,
      elementFilePath: tempFilePath,
    };

    beforeAll(() => fs.writeFileSync(tempFilePath, updatedContent));
    afterAll(() => fs.rmSync(tempFilePath));

    it('should update an element', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: null,
          reasonCode: '0034',
          messages: null,
          returnCode: '0000',
        },
        {
          'api-version': '1.1',
          'content-type': 'application/json',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.OK,
        details: {
          messages: [],
          returnCode: 0,
        },
      });
    });
    it('should add a new element', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      mockServer.forAnyRequest().thenJson(
        200,
        {
          data: null,
          reasonCode: '0034',
          messages: null,
          returnCode: '0000',
        },
        {
          'api-version': '1.1',
          'content-type': 'application/json',
        }
      );
      const newElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(newElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.OK,
        details: {
          returnCode: 0,
          messages: [],
        },
      });
    });
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should update an element even after change regression error', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = [
        '03:41:46 SMGR123C 99% PRIOR INSERTS DELETED AND/OR 01% PRIOR DELETES RE-INSERTED',
      ];
      mockServer.forAnyRequest().thenJson(
        409,
        {
          returnCode: '0008',
          reasonCode: '0034',
          data: null,
          messages,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.OK,
        additionalDetails: {
          returnCode: 8,
          message: ['', ...messages.map((message) => message.trim())].join(
            '\n'
          ),
        },
      });
    });
    it('should return an error for incorrect connection details', async () => {
      // arrange
      const newElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const addActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const updateResult = await updateElement(logger)(progress)(
        nonExistingService
      )(configuration)(newElementLocation)(addActionChangeControlValue)(
        elementData
      );
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: 'CONNECTION_ERROR',
        details: {
          connectionCode: undefined,
          httpStatusCode: undefined,
          messages: [
            `connect ECONNREFUSED ${nonExistingService.location.hostname}:${nonExistingService.location.port}`,
          ],
        },
      });
    });
    it('should return an error for incorrect base credentials', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = ['API0034S INVALID USERID OR PASSWORD DETECTED'];
      mockServer.forAnyRequest().thenJson(
        401,
        {
          returnCode: '0020',
          reasonCode: '0034',
          reports: null,
          messages,
          data: null,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR,
        details: {
          messages: ['API0034S INVALID USERID OR PASSWORD DETECTED'],
          returnCode: 20,
        },
      });
    });
    it('should return an error for partially element location specified', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = ['EWS1232E Parameter system cannot be Wildcarded.'];
      mockServer.forAnyRequest().thenJson(
        400,
        {
          returnCode: '0012',
          reasonCode: '0034',
          reports: null,
          messages,
          data: null,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: '*',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: messages.map((message) => message.trim()),
          returnCode: 12,
        },
      });
    });
    it('should return an error for outdated fingerprint', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = [
        "C1G0410E  FINGERPRINT DOESN'T MATCH ELEMENT ALREADY PRESENTED IN THE MAP. ELEMENT SOURCE HAS BEEN UPDATED BEFORE.",
      ];
      mockServer.forAnyRequest().thenJson(
        400,
        {
          returnCode: '0012',
          reasonCode: '0034',
          reports: null,
          messages,
          data: null,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR,
        details: {
          messages: messages.map((message) => message.trim()),
          returnCode: 12,
        },
      });
    });
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('should return update the element with empty content', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = [
        '03:41:46 SMGR123C 99% PRIOR INSERTS DELETED AND/OR 01% PRIOR DELETES RE-INSERTED',
      ];
      mockServer.forAnyRequest().thenJson(
        409,
        {
          returnCode: '0008',
          reasonCode: '0034',
          data: null,
          messages,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.OK,
        additionalDetails: {
          returnCode: 8,
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
      const messages = [
        '11:33:28  C1G0142E  SYSTEM REQUIRES A CCID TO BE SPECIFIED - REQUEST NOT PERFORMED',
      ];
      mockServer.forAnyRequest().thenJson(
        400,
        {
          returnCode: '0012',
          reasonCode: '0034',
          reports: null,
          messages,
          data: null,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: messages.map((message) => message.trim()),
          returnCode: 12,
        },
      });
    });
    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      // this chunked multipart/form-data request seems not available to be mocked with mockttp
      // TODO: investigate ability to use mockServer.put().withForm() method instead, but it seems like it is not working
      const messages = ['Something went really wrong....'];
      mockServer.forAnyRequest().thenJson(
        500,
        {
          returnCode: '0020',
          reasonCode: '0034',
          reports: null,
          messages,
          data: null,
        },
        {
          'content-type': 'application/json',
          version: '1.1',
        }
      );
      const existingElementLocation: ElementMapPath = {
        environment: 'TEST-ENV',
        stageNumber: '1',
        system: 'TEST-SYS',
        subSystem: 'TEST-SBS',
        type: 'TEST-TYPE',
        id: 'ELM',
      };
      const updateActionChangeControlValue: ActionChangeControlValue = {
        ccid: 'test',
        comment: 'test',
      };
      const service = toService(mockServer.url);
      // act
      const updateResult = await updateElement(logger)(progress)(service)(
        configuration
      )(existingElementLocation)(updateActionChangeControlValue)(elementData);
      // assert
      expect(updateResult).toEqual({
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: messages.map((message) => message.trim()),
          returnCode: 20,
        },
      });
    });
  });

  describe('generating elements in a subsystem', () => {
    const toRequestPath =
      (basePath: string) =>
      (configuration: string) =>
      ({
        environment,
        stageNumber,
        system,
        subSystem,
      }: SubSystemMapPath): string => {
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
          ANY_VALUE,
          'ele',
          ANY_VALUE
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

    const reportId = 'reportId';

    describe('generating a subsystem in place', () => {
      it('should generate a subsystem', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            existingSubSystemLocation
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
          status: 200,
          statusMessage: 'OK',
          headers: {
            version: '1.1',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 0,
            reasonCode: 0,
            reports: {
              C1MSGS1: reportId,
            },
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
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isErrorEndevorResponse(generateResult)).toBe(false);
      });

      it('should return an error for incorrect connection details', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const nonExistingService = toService(nonExistingServerURL);
        // act
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(nonExistingService)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        expect(
          isErrorEndevorResponse(generateResult) &&
            generateResult.type === ErrorResponseType.CONNECTION_ERROR
        ).toBe(true);
      });

      it('should return an error for unauthorized request (incorrect base or token credentials)', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            existingSubSystemLocation
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
          status: 401,
          statusMessage: 'Unauthorized',
          headers: {
            version: '1.1',
            'content-type': 'application/json',
          },
          data: '<html>401 - Unauthorized</html>',
        };
        const endevorEndpoint = await mockEndpoint(
          request,
          response
        )(mockServer);
        const service = toService(mockServer.urlFor(request.path));
        // act
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(
          isErrorEndevorResponse(generateResult) &&
            generateResult.type === ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR
        ).toBe(true);
      });

      it('should return an error for incorrect base credentials', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            existingSubSystemLocation
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
          status: 401,
          statusMessage: 'Unauthorized',
          headers: {
            version: '1.1',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 20,
            reasonCode: 34,
            reports: {
              C1MSGS1: reportId,
            },
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
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(
          isErrorEndevorResponse(generateResult) &&
            generateResult.type ===
              ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR
        ).toBe(true);
      });

      it('should return an error if the subsystem location is incorrect', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const incorrectSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'NONEXIST',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            incorrectSubSystemLocation
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
            version: '1.1',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: {
              C1MSGS1: reportId,
            },
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
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(incorrectSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(isErrorEndevorResponse(generateResult)).toBe(true);
      });

      it('should return a signout error if elements in the subsystem are signed out to somebody else', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            existingSubSystemLocation
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
            version: '1.1',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 12,
            reasonCode: 0,
            reports: {
              C1MSGS1: reportId,
            },
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
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(
          isErrorEndevorResponse(generateResult) &&
            generateResult.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
        ).toBe(true);
      });

      it('should return a generate error in case of an incorrect element processor generation', async () => {
        // arrange
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const generateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const request: MockRequest<GenerateRequestBody> = {
          method: 'PUT',
          path: toRequestPath(basePath)(configuration)(
            existingSubSystemLocation
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
        const incorrectGenerationResponse: MockResponse<unknown> = {
          status: 500,
          statusMessage: 'Internal server error',
          headers: {
            version: '1.1',
            'content-type': 'application/json',
          },
          data: {
            returnCode: 20,
            reasonCode: 34,
            reports: {
              C1MSGS1: reportId,
            },
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
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          generateActionChangeControlValue
        )();
        // assert
        const seenRequests = await endevorEndpoint.getSeenRequests();
        const calledOnce = seenRequests.length === 1;
        expect(calledOnce).toBe(true);

        expect(
          isErrorEndevorResponse(generateResult) &&
            generateResult.type ===
              ErrorResponseType.PROCESSOR_STEP_MAX_RC_EXCEEDED_ENDEVOR_ERROR
        ).toBe(true);
      });

      it('should return an error if something went wrong in Endevor side', async () => {
        // arrange
        mockServer.forAnyRequest().thenJson(
          500,
          {
            returnCode: 20,
            reasonCode: 34,
            reports: {
              C1MSGS1: reportId,
            },
            messages: ['Something went really wrong....'],
            data: [],
          },
          {
            'content-type': 'application/json',
            version: '1.1',
          }
        );
        const configuration = 'TEST-CONFIG';
        const existingSubSystemLocation: SubSystemMapPath = {
          environment: 'TEST-ENV',
          stageNumber: '1',
          system: 'TEST-SYS',
          subSystem: 'TEST-SBS',
        };
        const updateActionChangeControlValue: ActionChangeControlValue = {
          ccid: 'test',
          comment: 'test',
        };
        const service = toService(mockServer.url);
        // act
        const generateResult = await generateSubSystemElementsInPlace(logger)(
          progress
        )(service)(configuration)(existingSubSystemLocation)(
          updateActionChangeControlValue
        )();
        // assert
        expect(isErrorEndevorResponse(generateResult)).toBe(true);
      });
    });
  });

  describe('downloading report by id', () => {
    const configuration = 'TEST-INST';
    const reportId = 'TEST-REPORT-ID';

    it('should return a report', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: `/endevor/reports/${reportId}`,
        headers: {
          Authorization: `Basic ${toBase64(credential)}`,
          'accept-encoding': 'gzip,deflate',
        },

        body: null,
      };
      const content = 'Start of Endevor report';
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
      const actualContent = await downloadReportById(logger)(progress)(service)(
        configuration
      )(reportId);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return a undefined if unretrieved report', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: `/endevor/reports/${reportId}`,
        headers: {
          Authorization: `Basic ${toBase64(credential)}`,
          'accept-encoding': 'gzip,deflate',
        },

        body: null,
      };
      const content = 'Endevor report could not be retrieved';
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
      const actualContent = await downloadReportById(logger)(progress)(service)(
        configuration
      )(reportId);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toStrictEqual(content);
    });

    it('should return void for error related to incorrect connection details', async () => {
      // arrange
      const nonExistingService = toService(nonExistingServerURL);
      // act
      const actualContent = await downloadReportById(logger)(progress)(
        nonExistingService
      )(configuration)(reportId);
      // assert
      expect(actualContent).toBe(undefined);
    });

    it('should return an error if something went wrong in Endevor side', async () => {
      // arrange
      const request: MockRequest<null> = {
        method: 'GET',
        path: `/endevor/reports/${reportId}`,
        headers: {
          Authorization: `Basic ${toBase64(credential)}`,
          'accept-encoding': 'gzip,deflate',
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
      const actualContent = await downloadReportById(logger)(progress)(service)(
        configuration
      )(reportId);
      // assert
      const seenRequests = await endevorEndpoint.getSeenRequests();
      const calledOnce = seenRequests.length === 1;
      expect(calledOnce).toBe(true);

      expect(actualContent).toBe(undefined);
    });
  });
});
