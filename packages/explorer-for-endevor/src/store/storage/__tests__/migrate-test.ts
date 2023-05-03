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

import { mergeConnectionLocations } from '../migrate';
import { Source, ConnectionLocations } from '../_doc/Storage';

jest.mock('vscode', () => ({}), { virtual: true });
jest.mock(
  '../../../globals',
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

describe('merging of the connection locations', () => {
  const connectionLocationsFromSettings: ConnectionLocations = {
    [`synchronized.test1`]: {
      value: {
        ['synchronized.test2']: {
          id: {
            name: 'test2',
            source: Source.SYNCHRONIZED,
          },
        },
        ['synchronized.test3']: {
          id: {
            name: 'test3',
            source: Source.SYNCHRONIZED,
          },
        },
      },
      id: {
        name: 'test1',
        source: Source.SYNCHRONIZED,
      },
    },
    [`synchronized.test4`]: {
      value: {
        ['synchronized.test5']: {
          id: {
            name: 'test5',
            source: Source.SYNCHRONIZED,
          },
        },
        ['synchronized.test6']: {
          id: {
            name: 'test6',
            source: Source.SYNCHRONIZED,
          },
        },
      },
      id: {
        name: 'test4',
        source: Source.SYNCHRONIZED,
      },
    },
  };
  it('should add everything from the settings', () => {
    // arrange
    const internalConnectionLocations: ConnectionLocations = {};
    const expectedConnectionLocations = connectionLocationsFromSettings;
    // act
    const result = mergeConnectionLocations(
      internalConnectionLocations,
      expectedConnectionLocations
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
  it('should add a new service profile from the settings', () => {
    // arrange
    const internalConnectionLocations: ConnectionLocations = {
      [`synchronized.test`]: {
        value: {},
        id: {
          name: 'test',
          source: Source.SYNCHRONIZED,
        },
      },
    };
    const expectedConnectionLocations: ConnectionLocations = {
      ...internalConnectionLocations,
      ...connectionLocationsFromSettings,
    };
    // act
    const result = mergeConnectionLocations(
      internalConnectionLocations,
      connectionLocationsFromSettings
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
  it('should add a new location profile for the existing service profile from the settings', () => {
    // arrange
    const internalConnectionLocations: ConnectionLocations = {
      [`synchronized.test1`]: {
        value: {
          ['synchronized.existing-test2']: {
            id: {
              name: 'existing-test2',
              source: Source.SYNCHRONIZED,
            },
          },
          ['synchronized.existing-test3']: {
            id: {
              name: 'existing-test3',
              source: Source.SYNCHRONIZED,
            },
          },
        },
        id: {
          name: 'test1',
          source: Source.SYNCHRONIZED,
        },
      },
    };
    const expectedConnectionLocations = {
      ...internalConnectionLocations,
      ...connectionLocationsFromSettings,
      [`synchronized.test1`]: {
        ...internalConnectionLocations[`synchronized.test1`],
        value: {
          ...internalConnectionLocations[`synchronized.test1`]?.value,
          ...connectionLocationsFromSettings[`synchronized.test1`]?.value,
        },
      },
    };
    // act
    const result = mergeConnectionLocations(
      internalConnectionLocations,
      connectionLocationsFromSettings
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
  it('should not remove the service profile from the internal storage', () => {
    // arrange
    const expectedConnectionLocations: ConnectionLocations = {
      [`synchronized.test`]: {
        value: {},
        id: {
          name: 'test',
          source: Source.SYNCHRONIZED,
        },
      },
    };
    const externalConnectionLocations: ConnectionLocations = {};
    // act
    const result = mergeConnectionLocations(
      expectedConnectionLocations,
      externalConnectionLocations
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
  it('should not remove the location profile from the internal storage', () => {
    // arrange
    const expectedConnectionLocations: ConnectionLocations =
      connectionLocationsFromSettings;
    const externalConnectionLocations: ConnectionLocations = {
      [`synchronized.test1`]: {
        value: {},
        id: {
          name: 'test1',
          source: Source.SYNCHRONIZED,
        },
      },
    };
    // act
    const result = mergeConnectionLocations(
      expectedConnectionLocations,
      externalConnectionLocations
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
  it('should not update anything in case the settings are empty', () => {
    // arrange
    const expectedConnectionLocations: ConnectionLocations = {
      [`synchronized.test`]: {
        value: {},
        id: {
          name: 'test',
          source: Source.SYNCHRONIZED,
        },
      },
    };
    const externalConnectionLocations: ConnectionLocations = {};
    // act
    const result = mergeConnectionLocations(
      expectedConnectionLocations,
      externalConnectionLocations
    );
    // assert
    expect(result).toStrictEqual(expectedConnectionLocations);
  });
});
