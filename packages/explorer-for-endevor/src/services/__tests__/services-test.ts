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

import { CredentialType } from '@local/endevor/_doc/Credential';
import {
  Service,
  ServiceApiVersion,
  ServiceBasePath,
} from '@local/endevor/_doc/Endevor';
import { EndevorServiceProfile } from '@local/profiles/_ext/Profile';
import path = require('path');
import * as yaml from 'js-yaml';
import * as fs from 'fs';

jest.mock('@zowe/imperative/lib/console/src/Console'); // disable imperative logging
jest.mock('vscode', () => ({}), { virtual: true });

const setupGlobals = (profilesDir: string) => {
  jest.resetModules();
  jest.doMock('@local/profiles/globals', () => ({
    __esModule: true,
    getProfilesDir: () => path.join(__dirname, profilesDir),
  }));
};

jest.mock(
  '../../globals',
  () => ({
    logger: {
      trace: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

describe('services fetching', () => {
  describe('fetching a list of services', () => {
    it('should return a list of services', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualServices = await services.getEndevorServiceNames();
      // assert
      const expectedServices = [
        'full-profile',
        'no-base-path',
        'no-credentials',
        'no-hostname',
        'no-port',
        'no-protocol',
        'no-reject',
      ];
      expect(actualServices).toEqual(expectedServices);
    });

    it('should return an empty list if no service existed', async () => {
      // arrange
      setupGlobals('./__fixtures__/no-profiles');
      const services = await import('../services');
      // act
      const actualServices = await services.getEndevorServiceNames();
      // assert
      expect(actualServices).toEqual([]);
    });
  });

  describe('fetching a service location from service profiles', () => {
    it('should return a service location from a service profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'full-profile'
      );
      // assert
      expect(actualLocation).toEqual({
        hostname: 'endevor1.example.com',
        port: 12345,
        protocol: 'http',
        basePath: '/EndevorService/api/v2/',
      });
    });
    it('should return a service location from a service profile with a default base path', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'no-base-path'
      );
      // assert
      expect(actualLocation).toEqual({
        hostname: 'endevor2.example.com',
        port: 12345,
        protocol: 'http',
        basePath: ServiceBasePath.V2,
      });
    });
    it('should return a service location from a service profile with a default protocol', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'no-protocol'
      );
      // assert
      const defaultProtocol = 'http';
      expect(actualLocation).toEqual({
        hostname: 'endevor1.example.com',
        port: 12345,
        protocol: defaultProtocol,
        basePath: '/EndevorService/api/v2/',
      });
    });
    it('should return an undefined with a service profile without a hostname', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'no-hostname'
      );
      // assert
      expect(actualLocation).toBeUndefined();
    });
    it('should return an undefined with a service profile without a port', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'no-port'
      );
      // assert
      expect(actualLocation).toBeUndefined();
    });
    it('should return an undefined for a non existing service profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'nonexisting-profile'
      );
      // assert
      expect(actualLocation).toBeUndefined();
    });
  });
  describe('fetching a service location from service profiles with a default base profile', () => {
    it('should return a service location from a default base profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/with-default-base-profile');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'empty-profile'
      );
      const baseProfileLocation = {
        hostname: 'endevor1.example.com',
        port: 12345,
        protocol: 'http',
        basePath: ServiceBasePath.V2,
      };
      // assert
      expect(actualLocation).toEqual(baseProfileLocation);
    });
    it('should return a service location from a default base profile for a non existing service profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/with-default-base-profile');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'nonexisting-profile'
      );
      const baseProfileLocation = {
        hostname: 'endevor1.example.com',
        port: 12345,
        protocol: 'http',
        basePath: ServiceBasePath.V2,
      };
      // assert
      expect(actualLocation).toEqual(baseProfileLocation);
    });
    it('should return a service location with a hostname from a default base profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/with-default-base-profile');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'no-hostname'
      );
      const baseProfileHostname = 'endevor1.example.com';
      // assert
      expect(actualLocation).toEqual({
        hostname: baseProfileHostname,
        port: 12345,
        protocol: 'http',
        basePath: '/EndevorService/api/v2/',
      });
    });
    it('should return an undefined for a non existing default base profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/no-profiles');
      const services = await import('../services');
      // act
      const actualLocation = await services.getServiceLocationByServiceName(
        'nonexisting-profile'
      );
      // assert
      expect(actualLocation).toBeUndefined();
    });
  });
  describe('fetching a reject unauthorized value from a service profile', () => {
    it('should return a value from a service profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualValue = await services.getRejectUnauthorizedByServiceName(
        'full-profile'
      );
      // assert
      expect(actualValue).toEqual(false);
    });
    it('should return a default value', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualValue = await services.getRejectUnauthorizedByServiceName(
        'no-reject'
      );
      // assert
      const defaultValue = true;
      expect(actualValue).toEqual(defaultValue);
    });
    it('should return a default value for a non existing profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const services = await import('../services');
      // act
      const actualValue = await services.getRejectUnauthorizedByServiceName(
        'non-existing-profile'
      );
      // assert
      const defaultValue = true;
      expect(actualValue).toEqual(defaultValue);
    });
    it('should return a default value for a non existing default base profile', async () => {
      // arrange
      setupGlobals('./__fixtures__/no-profiles');
      const services = await import('../services');
      // act
      const actualValue = await services.getRejectUnauthorizedByServiceName(
        'non-existing-profile'
      );
      // assert
      const defaultValue = true;
      expect(actualValue).toEqual(defaultValue);
    });
  });
  describe('fetching a credentials from a service profile', () => {
    it('should return credentials from a service profile', async () => {
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const credentials = await import('../../credentials/credentials');
      // act
      const actualCredentials = await credentials.getCredentialsByServiceName(
        'full-profile'
      );
      // assert
      expect(actualCredentials).toEqual({
        type: CredentialType.BASE,
        user: 'endevorUser1',
        password: 'endevorPassword1',
      });
    });
    it('should return undefined for a service profile without username/password', async () => {
      setupGlobals('./__fixtures__/only-endevor-profiles');
      const credentials = await import('../../credentials/credentials');
      // act
      const actualCredentials = await credentials.getCredentialsByServiceName(
        'no-credentials'
      );
      // assert
      expect(actualCredentials).toBeUndefined();
    });
    it('should return undefined for a non existing service profile', async () => {
      setupGlobals('./__fixtures__/no-profiles');
      const credentials = await import('../../credentials/credentials');
      // act
      const actualCredentials = await credentials.getCredentialsByServiceName(
        'nonexisting-profile'
      );
      // assert
      expect(actualCredentials).toBeUndefined();
    });
  });
  describe('fetching a credentials from service profiles with a default base profile', () => {
    it('should return credentials from a default base profile', async () => {
      setupGlobals('./__fixtures__/with-default-base-profile');
      const credentials = await import('../../credentials/credentials');
      // act
      const actualCredentials = await credentials.getCredentialsByServiceName(
        'empty-profile'
      );
      // assert
      expect(actualCredentials).toEqual({
        type: CredentialType.BASE,
        user: 'endevorUser1',
        password: 'endevorPassword1',
      });
    });
    it('should return undefined for a non existing default base profile', async () => {
      setupGlobals('./__fixtures__/no-profiles');
      const credentials = await import('../../credentials/credentials');
      // act
      const actualCredentials = await credentials.getCredentialsByServiceName(
        'nonexisting-profile'
      );
      // assert
      expect(actualCredentials).toBeUndefined();
    });
  });
});

describe('creating an endevor service', () => {
  let services: typeof import('../services');
  const profileRootDir = './__fixtures__/only-endevor-profiles';
  beforeAll(async () => {
    setupGlobals(profileRootDir);
    services = await import('../services');
  });

  const newServiceName = 'new-endevor-profile';
  const newServicePath = path.join(
    __dirname,
    profileRootDir,
    'endevor',
    `${newServiceName}.yaml`
  );
  beforeAll(async () => {
    try {
      // try deleting a file in case previous run failed
      await fs.promises.unlink(newServicePath);
    } catch (_e) {
      // do nothing if the file did not exist
    }
  });
  afterAll(async () => {
    // delete the new profile after test
    await fs.promises.unlink(newServicePath);
  });

  it('should create a new yaml file on disk with service content', async () => {
    // arrange
    const newService: Service = {
      credential: {
        type: CredentialType.BASE,
        user: 'new-endevor-user',
        password: 'new-endevor-password',
      },
      location: {
        hostname: 'localhost',
        protocol: 'http',
        port: 8080,
        basePath: '/some',
      },
      rejectUnauthorized: true,
      apiVersion: ServiceApiVersion.V2,
    };
    // act
    await services.createEndevorService(newServiceName, newService);
    // assert
    const serviceOnDisk = await fs.promises.readFile(newServicePath, 'utf-8');
    const decodedService = yaml.load(serviceOnDisk);
    expect(decodedService).toEqual({
      user: 'new-endevor-user',
      password: 'new-endevor-password',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      basePath: '/some',
      rejectUnauthorized: true,
    });
  });
  it('should fail to overwrite an existing service', async () => {
    // arrange
    const existingServiceName = 'full-profile';
    const existingServicePath = path.join(
      __dirname,
      profileRootDir,
      'endevor',
      `${existingServiceName}.yaml`
    );
    // act
    // - try to overwrite existing profile on disk with new content
    expect(
      await services.createEndevorService(existingServiceName, {
        credential: {
          type: CredentialType.BASE,
          user: 'new-endevor-user',
          password: 'new-endevor-password',
        },
        location: {
          hostname: 'localhost',
          protocol: 'http',
          port: 8080,
          basePath: '/some',
        },
        rejectUnauthorized: true,
        apiVersion: ServiceApiVersion.V2,
      })
    ).toBe(undefined);
    // assert
    const serviceOnDisk = await fs.promises.readFile(
      existingServicePath,
      'utf-8'
    );
    const decodedService = yaml.load(serviceOnDisk);
    const existingService: EndevorServiceProfile = {
      host: 'endevor1.example.com',
      port: 12345,
      user: 'endevorUser1',
      password: 'endevorPassword1',
      rejectUnauthorized: false,
      protocol: 'http',
      basePath: '/EndevorService/api/v2/',
    };
    expect(decodedService).toEqual(existingService);
  });
});
