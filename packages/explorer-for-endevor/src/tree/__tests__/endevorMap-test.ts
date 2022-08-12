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

import {
  EnvironmentStage,
  System,
  SubSystem,
  SubSystemMapPath,
  EnvironmentStageMapPath,
} from '@local/endevor/_doc/Endevor';
import { toEndevorMap, toEndevorMapWithWildcards } from '../endevorMap';
import { EndevorMap, toSubsystemMapPathId } from '../../_doc/Endevor';

jest.mock('vscode', () => ({}), { virtual: true });

describe('building the endevor map', () => {
  // arrange
  // TEST-ENV1/1 -> TEST-ENV1/2 -> QA-ENV1/1 -> QA-ENV1/2                -> PROD-ENV1/2
  //                                                         PROD-ENV1/1 ->
  //                                          QFIX-ENV1/1 -> QFIX-ENV1/2 ->
  const allEnvStages: EnvironmentStage[] = [
    {
      environment: 'QFIX-ENV1',
      stageNumber: '1',
      nextEnvironment: 'QFIX-ENV1',
      nextStageNumber: '2',
    },
    {
      environment: 'QFIX-ENV1',
      stageNumber: '2',
      nextEnvironment: 'PROD-ENV1',
      nextStageNumber: '2',
    },
    {
      environment: 'TEST-ENV1',
      stageNumber: '1',
      nextEnvironment: 'TEST-ENV1',
      nextStageNumber: '2',
    },
    {
      environment: 'TEST-ENV1',
      stageNumber: '2',
      nextEnvironment: 'QA-ENV1',
      nextStageNumber: '1',
    },
    {
      environment: 'QA-ENV1',
      stageNumber: '1',
      nextEnvironment: 'QA-ENV1',
      nextStageNumber: '2',
    },
    {
      environment: 'QA-ENV1',
      stageNumber: '2',
      nextEnvironment: 'PROD-ENV1',
      nextStageNumber: '2',
    },
    {
      environment: 'PROD-ENV1',
      stageNumber: '1',
      nextEnvironment: 'PROD-ENV1',
      nextStageNumber: '2',
    },
    // end of the map
    {
      environment: 'PROD-ENV1',
      stageNumber: '2',
    },
  ];
  // TEST-ENV1/1/TEST-SYS1 -> TEST-ENV1/2/TEST-SYS1 -> QA-ENV1/1/QA-SYS1 -> QA-ENV1/2/QA-SYS1                    -> PROD-ENV1/2/PROD-SYS1
  // TEST-ENV1/1/TEST-SYS2 -> TEST-ENV1/2/TEST-SYS2 ->
  //                                                              QFIX-ENV1/1/QFIX-SYS1 -> QFIX-ENV1/2/QFIX-SYS1 ->
  //                                                                                             PROD-ENV1/1/?/? ->
  const allSystems: System[] = [
    {
      environment: 'TEST-ENV1',
      stageNumber: '1',
      system: 'TEST-SYS1',
      nextSystem: 'QA-SYS1',
    },
    {
      environment: 'TEST-ENV1',
      stageNumber: '2',
      system: 'TEST-SYS1',
      nextSystem: 'QA-SYS1',
    },
    {
      environment: 'TEST-ENV1',
      stageNumber: '1',
      system: 'TEST-SYS2',
      nextSystem: 'QA-SYS1',
    },
    {
      environment: 'TEST-ENV1',
      stageNumber: '2',
      system: 'TEST-SYS2',
      nextSystem: 'QA-SYS1',
    },
    {
      environment: 'QA-ENV1',
      stageNumber: '1',
      system: 'QA-SYS1',
      nextSystem: 'PROD-SYS1',
    },
    {
      environment: 'QA-ENV1',
      stageNumber: '2',
      system: 'QA-SYS1',
      nextSystem: 'PROD-SYS1',
    },
    {
      environment: 'QFIX-ENV1',
      stageNumber: '1',
      system: 'QFIX-SYS1',
      nextSystem: 'PROD-SYS1',
    },
    {
      environment: 'QFIX-ENV1',
      stageNumber: '2',
      system: 'QFIX-SYS1',
      nextSystem: 'PROD-SYS1',
    },
    {
      environment: 'PROD-ENV1',
      stageNumber: '2',
      system: 'PROD-SYS1',
      // end of the map
      nextSystem: 'PROD-SYS1',
    },
  ];
  // TEST-ENV1/1/TEST-SYS1/TEST-SBS2  -> (unreal case)
  // TEST-ENV1/1/TEST-SYS1/TEST-SBS1 -> TEST-ENV1/2/TEST-SYS1/TEST-SBS1 -> QA-ENV1/1/QA-SYS1/QA-SBS1 -> QA-ENV1/2/QA-SYS1/QA-SBS1                -> PROD-ENV1/2/PROD-SYS1/PROD-SBS1
  // TEST-ENV1/1/TEST-SYS2/TEST-SBS1 -> TEST-ENV1/2/TEST-SYS2/TEST-SBS1 ->
  //                                                                          QFIX-ENV1/1/QFIX-SYS1/QFIX-SBS1 -> QFIX-ENV1/2/QFIX-SYS1/QFIX-SBS1 ->
  //                                                                          QFIX-ENV1/1/QFIX-SYS1/QFIX-SBS2 ->
  //                                                                                                                            PROD-ENV1/1/?/?  ->
  const allSubSystems: SubSystem[] = [
    {
      environment: 'TEST-ENV1',
      system: 'TEST-SYS1',
      subSystem: 'TEST-SBS1',
      stageNumber: '1',
      // no subsystem like this in QA-ENV1/1/QA-SYS
      nextSubSystem: 'TEST-SBS1',
    },
    {
      environment: 'TEST-ENV1',
      system: 'TEST-SYS2',
      subSystem: 'TEST-SBS1',
      stageNumber: '1',
      nextSubSystem: 'QA-SBS1',
    },
    {
      environment: 'TEST-ENV1',
      system: 'TEST-SYS1',
      subSystem: 'TEST-SBS2',
      stageNumber: '1',
      nextSubSystem: 'QA-SBS1',
    },
    {
      environment: 'TEST-ENV1',
      system: 'TEST-SYS1',
      subSystem: 'TEST-SBS1',
      stageNumber: '2',
      nextSubSystem: 'QA-SBS1',
    },
    {
      environment: 'TEST-ENV1',
      system: 'TEST-SYS2',
      subSystem: 'TEST-SBS1',
      stageNumber: '2',
      nextSubSystem: 'QA-SBS1',
    },
    {
      environment: 'QFIX-ENV1',
      system: 'QFIX-SYS1',
      subSystem: 'QFIX-SBS1',
      stageNumber: '1',
      nextSubSystem: 'PROD-SBS1',
    },
    {
      environment: 'QFIX-ENV1',
      system: 'QFIX-SYS1',
      subSystem: 'QFIX-SBS2',
      stageNumber: '1',
      nextSubSystem: 'PROD-SBS1',
    },
    {
      environment: 'QFIX-ENV1',
      system: 'QFIX-SYS1',
      subSystem: 'QFIX-SBS1',
      stageNumber: '2',
      nextSubSystem: 'PROD-SBS1',
    },
    {
      environment: 'QA-ENV1',
      system: 'QA-SYS1',
      subSystem: 'QA-SBS1',
      stageNumber: '1',
      nextSubSystem: 'PROD-SBS1',
    },
    {
      environment: 'QA-ENV1',
      system: 'QA-SYS1',
      subSystem: 'QA-SBS1',
      stageNumber: '2',
      nextSubSystem: 'PROD-SBS1',
    },
    {
      environment: 'PROD-ENV1',
      system: 'PROD-SYS1',
      subSystem: 'PROD-SBS1',
      stageNumber: '2',
      // end of the map
      nextSubSystem: 'PROD-SBS1',
    },
  ];
  it('should return an Endevor map with searching up the map (1) from the beginning', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'TEST-ENV1',
      stageNumber: '1',
      system: 'TEST-SYS1',
      subSystem: 'TEST-SBS1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [
        'TEST-ENV1/2/TEST-SYS1/TEST-SBS1',
        'QA-ENV1/1/QA-SYS1/QA-SBS1',
        'QA-ENV1/2/QA-SYS1/QA-SBS1',
        'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
      ],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an Endevor map with searching up the map (2) from the beginning', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'QFIX-ENV1',
      system: 'QFIX-SYS1',
      subSystem: 'QFIX-SBS1',
      stageNumber: '1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [
        'QFIX-ENV1/2/QFIX-SYS1/QFIX-SBS1',
        'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
      ],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an Endevor map with searching up the map from the middle', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'QA-ENV1',
      stageNumber: '1',
      system: 'QA-SYS1',
      subSystem: 'QA-SBS1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [
        'QA-ENV1/2/QA-SYS1/QA-SBS1',
        'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
      ],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an empty Endevor map with searching from the top', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'PROD-ENV1',
      stageNumber: '2',
      system: 'PROD-SYS1',
      subSystem: 'PROD-SBS1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [],
    };
    // assert
    expect(result).toEqual(expectedResult);
  });
  it('should return an empty Endevor map in case of incorrect subsystem name', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'PROD-ENV2',
      stageNumber: '2',
      system: 'PROD-SYS1',
      subSystem: 'PROD-SBS8',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an empty Endevor map in case of incorrect system name', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'PROD-ENV2',
      stageNumber: '2',
      system: 'PROD-SYS8',
      subSystem: 'PROD-SBS1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an empty Endevor map in case of incorrect environment name', () => {
    const searchLocation: SubSystemMapPath = {
      environment: 'PROD-ENV8',
      stageNumber: '2',
      system: 'PROD-SYS1',
      subSystem: 'PROD-SBS1',
    };
    // act
    const result =
      toEndevorMap(allEnvStages)(allSystems)(allSubSystems)(searchLocation);
    // assert
    const expectedResult: EndevorMap = {
      [toSubsystemMapPathId(searchLocation)]: [],
    };
    expect(result).toEqual(expectedResult);
  });
  it('should return an Endevor map with searching up the map with wildcards (1)', () => {
    const environmentStageMapPath: EnvironmentStageMapPath = {
      environment: 'QFIX-ENV1',
      stageNumber: '1',
    };
    // act
    const result = toEndevorMapWithWildcards(allEnvStages)(allSystems)(
      allSubSystems
    )(environmentStageMapPath);
    // assert
    const expectedRoute = [
      'QFIX-ENV1/2/QFIX-SYS1/QFIX-SBS1',
      'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
    ];
    const expectedResult: EndevorMap = {
      ['QFIX-ENV1/1/QFIX-SYS1/QFIX-SBS1']: expectedRoute,
      // Endevor does not allow for system or subsystem names to change from stage 1 to 2 in the same environment.
      // This technically means our fake setup cannot exist in real word, but it is a good test.
      ['QFIX-ENV1/1/QFIX-SYS1/QFIX-SBS2']: [],
    };

    expect(result).toEqual(expectedResult);
  });
  it('should return an Endevor map with searching up the map with wildcards (2)', () => {
    const environmentStageMapPath: EnvironmentStageMapPath = {
      environment: 'TEST-ENV1',
      stageNumber: '1',
    };
    // act
    const result = toEndevorMapWithWildcards(allEnvStages)(allSystems)(
      allSubSystems
    )(environmentStageMapPath);
    // assert
    const expectedRoute = [
      'TEST-ENV1/2/TEST-SYS1/TEST-SBS1',
      'QA-ENV1/1/QA-SYS1/QA-SBS1',
      'QA-ENV1/2/QA-SYS1/QA-SBS1',
      'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
    ];
    const expectedResult: EndevorMap = {
      ['TEST-ENV1/1/TEST-SYS1/TEST-SBS1']: expectedRoute,
      // Endevor does not allow for system or subsystem names to change from stage 1 to 2 in the same environment.
      // This technically means our fake setup cannot exist in real word, but it is a good test.
      ['TEST-ENV1/1/TEST-SYS1/TEST-SBS2']: [],
      ['TEST-ENV1/1/TEST-SYS2/TEST-SBS1']: [
        'TEST-ENV1/2/TEST-SYS2/TEST-SBS1',
        'QA-ENV1/1/QA-SYS1/QA-SBS1',
        'QA-ENV1/2/QA-SYS1/QA-SBS1',
        'PROD-ENV1/2/PROD-SYS1/PROD-SBS1',
      ],
    };

    expect(result).toEqual(expectedResult);
  });
});
