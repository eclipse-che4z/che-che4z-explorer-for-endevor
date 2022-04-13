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

import { parseToType } from '@local/type-parser/parser';
import {
  Element,
  Repository,
  SubSystem,
  System,
  EnvironmentStage,
} from '../_ext/Endevor';

describe('external Endevor data type parsing', () => {
  describe('repository type parsing', () => {
    it('should parse a proper repository', () => {
      // arrange
      const name = 'REPO1';
      const repository = {
        name,
      };
      // act
      const parsedRepository = parseToType(Repository, repository);
      // assert
      const expectedRepo: Repository = {
        name,
      };
      expect(parsedRepository).toStrictEqual(expectedRepo);
    });
    it('should throw an error for a repository without name', () => {
      // arrange
      const repository = {};
      // act && assert
      expect(() => parseToType(Repository, repository)).toThrowError(
        'Invalid value undefined supplied to : { name: string }/name: string'
      );
    });
    it('should throw an error for a repository with incorrect name', () => {
      // arrange
      const repository = {
        naMe: 'something',
      };
      // act && assert
      expect(() => parseToType(Repository, repository)).toThrowError(
        'Invalid value undefined supplied to : { name: string }/name: string'
      );
    });
  });
  describe('system type parsing', () => {
    it('should parse a proper system', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: '1',
        nextSys: 'SYS',
      };
      // act
      const parsedSystem = parseToType(System, system);
      // assert
      const expectedSystem: System = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: '1',
        nextSys: 'SYS',
      };
      expect(parsedSystem).toStrictEqual(expectedSystem);
    });
    it('should parse a system with numeric stage sequence number', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: 1,
        nextSys: 'SYS',
      };
      // act
      const parsedSystem = parseToType(System, system);
      // assert
      const expectedSystem: System = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: '1',
        nextSys: 'SYS',
      };
      expect(parsedSystem).toStrictEqual(expectedSystem);
    });
    it('should throw an error for a system without an environment name', () => {
      // arrange
      const system = {
        // envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, nextSys: string }/envName: string'
      );
    });
    it('should throw an error for a system without a system name', () => {
      // arrange
      const system = {
        envName: 'ENV',
        // sysName: 'SYS',
        stgSeqNum: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, nextSys: string }/sysName: string'
      );
    });
    it('should throw an error for a system without a next system name', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: '1',
        // nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, nextSys: string }/nextSys: string'
      );
    });
    it('should throw an error for a system with an incorrect stage sequence number', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgSeqNum: 3, // <-- should be 1 or 2
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value 3 supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, nextSys: string }/stgSeqNum: StageNumber'
      );
    });
    it('should throw an error for a system without a stage sequence number', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        // stgSeqNum: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, nextSys: string }/stgSeqNum: StageNumber'
      );
    });
  });
  describe('subsystem type parsing', () => {
    it('should parse a proper subsystem', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      // act
      const parsedSubSystem = parseToType(SubSystem, subSystem);
      // assert
      const expectedSubSystem: SubSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      expect(parsedSubSystem).toStrictEqual(expectedSubSystem);
    });
    it('should parse a subsystem with numeric stage sequence number', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act
      const parsedSubSystem = parseToType(SubSystem, subSystem);
      // assert
      const expectedSubSystem: SubSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      expect(parsedSubSystem).toStrictEqual(expectedSubSystem);
    });
    it('should throw an error for a subsystem without an environment name', () => {
      // arrange
      const subSystem = {
        // envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/envName: string'
      );
    });
    it('should throw an error for a subsystem without a system name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        // sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/sysName: string'
      );
    });
    it('should throw an error for a subsystem without a subsystem name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        // sbsName: 'SUBSYS',
        stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/sbsName: string'
      );
    });
    it('should throw an error for a subsystem without a next subsystem name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: '1',
        // nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/nextSbs: string'
      );
    });
    it('should throw an error for a subsystem with an incorrect stage sequence number', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgSeqNum: 3, // <-- should be 1 or 2
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value 3 supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/stgSeqNum: StageNumber'
      );
    });
    it('should throw an error for a subsystem without a stage sequence number', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        // stgSeqNum: '1',
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgSeqNum: StageNumber, sysName: string, sbsName: string, nextSbs: string }/stgSeqNum: StageNumber'
      );
    });
  });
  describe('element (and dependent element) type parsing', () => {
    it('should parse a proper element', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fileExt: 'cbl',
      };
      // act
      const parsedElement = parseToType(Element, element);
      // assert
      const expectedElement: Element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fileExt: 'cbl',
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should parse an element with numeric stage number', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: 2,
        fileExt: 'cbl',
      };
      // act
      const parsedElement = parseToType(Element, element);
      // assert
      const expectedElement: Element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fileExt: 'cbl',
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should parse an element without file extension', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        // fileExt: 'cbl',
      };
      // act
      const parsedElement = parseToType(Element, element);
      // assert
      const expectedElement: Element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should parse an element with null file extension', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fileExt: null,
      };
      // act
      const parsedElement = parseToType(Element, element);
      // assert
      const expectedElement: Element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fileExt: null,
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should throw an error for an element without element name', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        // elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/elmName: string'
      );
    });
    it('should throw an error for an element without stage number', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        // stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/stgNum: StageNumber'
      );
    });
    it('should throw an error for an element without environment name', () => {
      // arrange
      const element = {
        // envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/envName: string'
      );
    });
    it('should throw an error for an element without type name', () => {
      // arrange
      const element = {
        envName: 'ENV',
        // typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/typeName: string'
      );
    });
    it('should throw an error for an element without system name', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        // sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/sysName: string'
      );
    });
    it('should throw an error for an element without subsystem name', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        // sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string }/sbsName: string'
      );
    });
  });

  describe('environment stage type parsing', () => {
    it('should parse a proper environment stage', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act
      const parsedEnvironment = parseToType(EnvironmentStage, environment);
      // assert
      const expectedEnvironment: EnvironmentStage = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      expect(parsedEnvironment).toStrictEqual(expectedEnvironment);
    });
    it('should parse a proper final environment stage', () => {
      // arrange
      const finalEnvironmentStage = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: null,
        nextStgNum: null,
      };
      // act
      const parsedEnvironment = parseToType(
        EnvironmentStage,
        finalEnvironmentStage
      );
      // assert
      const expectedEnvironment: EnvironmentStage = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: null,
        nextStgNum: null,
      };
      expect(parsedEnvironment).toStrictEqual(expectedEnvironment);
    });
    it('should throw an error for a environment stage without the envinronment name', () => {
      // arrange
      const environment = {
        // envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/envName: string'
      );
    });
    it('should throw an error for a environment stage without the stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        // stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/stgNum: StageNumber'
      );
    });
    it('should throw an error for a environment stage without the next environment', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        // nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/1: null'
      );
    });
    it('should throw an error for a environment stage without the next stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        // nextStgNum: '1'
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextStgNum: (StageNumber | null)/1: null'
      );
    });
    it('should throw an error for a environment stage with the incorrect environment name', () => {
      // arrange
      const environment = {
        envNaMe: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/envName: string'
      );
    });
    it('should throw an error for a environment stage with the incorrect stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNuM: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/stgNum: StageNumber'
      );
    });
    it('should throw an error for a environment stage with the incorrect next environment', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnV: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/1: null'
      );
    });
    it('should throw an error for a environment stage with the incorrect next stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNumber: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextStgNum: (StageNumber | null)/1: null'
      );
    });
  });
});
