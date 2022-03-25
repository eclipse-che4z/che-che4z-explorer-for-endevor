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

import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
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

describe('creating Endevor locations', () => {
  let elementLocations: typeof import('../elementLocations');
  const profileRootDir = './__fixtures__/create-endevor-location-profile';
  beforeAll(async () => {
    setupGlobals(profileRootDir);
    elementLocations = await import('../elementLocations');
  });

  const newLocationName = 'new-endevor-location-profile';
  const newLocationPath = path.join(
    __dirname,
    profileRootDir,
    'endevor-location',
    `${newLocationName}.yaml`
  );
  beforeAll(async () => {
    try {
      // try deleting a file in case previous run failed
      await fs.promises.unlink(newLocationPath);
    } catch (ignored) {
      // do nothing if the file did not exist
    }
  });
  afterAll(async () => {
    // delete the new profile after test
    await fs.promises.unlink(newLocationPath);
  });
  it('should save an element location on disk', async () => {
    // arrange
    const newElementLocation: ElementSearchLocation = {
      instance: 'TEST',
      system: 'SYS',
      type: 'COBOL',
      environment: 'ENV',
      subsystem: 'SUBSYS',
      stageNumber: '1',
      comment: 'SOME_COMMENT',
      ccid: 'example',
    };
    // act
    await elementLocations.createEndevorElementLocation(
      newLocationName,
      newElementLocation
    );
    // assert
    const elementLocationOnDisk = await fs.promises.readFile(
      newLocationPath,
      'utf-8'
    );
    const decodedElementLocation = yaml.load(elementLocationOnDisk);
    expect(decodedElementLocation).toEqual(newElementLocation);
  });
  it('should not fail to overwrite an existing element location', async () => {
    // arrange
    const existingLocationName = 'existing-endevor-location-profile';
    // act && assert
    expect(
      await elementLocations.createEndevorElementLocation(
        existingLocationName,
        {
          instance: 'NDVRCNFG',
          system: 'SYS',
        }
      )
    ).toBe(undefined);
  });
});

describe('Endevor element locations fetching', () => {
  it('should return list of element locations', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-only-location-profiles');
    const elementLocations = await import('../elementLocations');
    // act
    const actualLocations = await elementLocations.getElementLocationNames();
    // assert
    expect(actualLocations).toEqual([]);
  });

  it('should return empty list if no element location existed', async () => {
    // arrange
    setupGlobals('./__fixtures__/no-default-profiles');
    const elementLocations = await import('../elementLocations');
    // act
    const actualLocations = await elementLocations.getElementLocationNames();
    // assert
    expect(actualLocations).toEqual([]);
  });

  it('should return undefined if no instance was specified', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-only-location-profiles');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'endevor-location_1'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
});

describe('fetching an Endevor location by name', () => {
  it('should return a saved location', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'correct-location-profile'
    );
    // assert
    expect(elementLocation).toStrictEqual({
      instance: 'TEST-INS',
      environment: 'TEST-ENV',
      stageNumber: '1',
      system: 'SYS',
      subsystem: 'SBS',
      type: undefined,
      ccid: undefined,
      comment: undefined,
    });
  });
  it('should return undefined for non existing location', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'non-existing-profile'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location without instance', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-without-instance'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location without environment', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-without-env'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location without stage number', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-without-stage'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location with wildcarded instance', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-with-wild-instance'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location with wildcarded environment', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-with-wild-env'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
  it('should return undefined for the location with incorrect stage number', async () => {
    // arrange
    setupGlobals('./__fixtures__/get-endevor-location-profile');
    const elementLocations = await import('../elementLocations');
    // act
    const elementLocation = await elementLocations.getElementLocationByName(
      'profile-with-incorrect-stage'
    );
    // assert
    expect(elementLocation).toBeUndefined();
  });
});
