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
  Configuration,
  SubSystem,
  System,
  EnvironmentStage,
} from '../_ext/Endevor';

describe('external Endevor data type parsing', () => {
  describe('configuration type parsing', () => {
    const name = 'CONFIG1';
    const description = 'Config 1';
    it('should parse a proper configuration', () => {
      // arrange
      const configuration = {
        name,
        description,
      };
      // act
      const parsedRepository = parseToType(Configuration, configuration);
      // assert
      const expectedRepo: Configuration = {
        name,
        description,
      };
      expect(parsedRepository).toStrictEqual(expectedRepo);
    });
    it('should throw an error for a configuration without name', () => {
      // arrange
      const configuration = { description };
      // act && assert
      expect(() =>
        parseToType(Configuration, configuration)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a configuration with incorrect name', () => {
      // arrange
      const configuration = {
        naMe: 'something',
        description,
      };
      // act && assert
      expect(() =>
        parseToType(Configuration, configuration)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a configuration without description', () => {
      // arrange
      const configuration = { name };
      // act && assert
      expect(() =>
        parseToType(Configuration, configuration)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a configuration with incorrect description', () => {
      // arrange
      const configuration = {
        name,
        desCription: 'something',
      };
      // act && assert
      expect(() =>
        parseToType(Configuration, configuration)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('system type parsing', () => {
    it('should parse a proper system', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        nextSys: 'SYS',
      };
      // act
      const parsedSystem = parseToType(System, system);
      // assert
      const expectedSystem: System = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        nextSys: 'SYS',
      };
      expect(parsedSystem).toStrictEqual(expectedSystem);
    });
    it('should throw an error for a system without an environment name', () => {
      // arrange
      const system = {
        // envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, nextSys: string }/envName: string'
      );
    });
    it('should throw an error for a system without a system name', () => {
      // arrange
      const system = {
        envName: 'ENV',
        // sysName: 'SYS',
        stgId: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, nextSys: string }/sysName: string'
      );
    });
    it('should throw an error for a system without a next system name', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        // nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, nextSys: string }/nextSys: string'
      );
    });
    it('should throw an error for a system without a stage id', () => {
      // arrange
      const system = {
        envName: 'ENV',
        sysName: 'SYS',
        // stgId: '1',
        nextSys: 'SYS',
      };
      // act && assert
      expect(() => parseToType(System, system)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, nextSys: string }/stgId: string'
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
        stgId: '1',
        nextSbs: 'SUBSYS',
      };
      // act
      const parsedSubSystem = parseToType(SubSystem, subSystem);
      // assert
      const expectedSubSystem: SubSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgId: '1',
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
        stgId: '1',
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/envName: string'
      );
    });
    it('should throw an error for a subsystem without a system name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        // sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgId: '1',
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/sysName: string'
      );
    });
    it('should throw an error for a subsystem without a subsystem name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        // sbsName: 'SUBSYS',
        stgId: '1',
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/sbsName: string'
      );
    });
    it('should throw an error for a subsystem without a next subsystem name', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgId: '1',
        stgSeqNum: 1,
        // nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/nextSbs: string'
      );
    });
    it('should throw an error for a subsystem with an incorrect stage id', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgId: 3, // <-- should be 1 or 2
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value 3 supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/stgId: string'
      );
    });
    it('should throw an error for a subsystem without a stage id', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        // stgId: '1',
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() => parseToType(SubSystem, subSystem)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgId: string, sysName: string, sbsName: string, nextSbs: string }/stgId: string'
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
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
        fullElmName: 'ELM1',
        // elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/elmName: string'
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
        fullElmName: 'ELM1',
        // stgNum: '2',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/stgNum: StageNumber'
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
        fullElmName: 'ELM1',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/envName: string'
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
        fullElmName: 'ELM1',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/typeName: string'
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
        fullElmName: 'ELM1',
      };
      // act && assert
      expect(() => parseToType(Element, element)).toThrowError(
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/sysName: string'
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
        'Invalid value undefined supplied to : ({ envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string } & Partial<{ fileExt: (string | null) }>)/0: { envName: string, stgNum: StageNumber, sysName: string, sbsName: string, typeName: string, elmName: string, fullElmName: string }/sbsName: string'
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
        stgId: '2',
      };
      // act
      const parsedEnvironment = parseToType(EnvironmentStage, environment);
      // assert
      const expectedEnvironment: EnvironmentStage = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
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
        stgId: '2',
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
        stgId: '2',
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
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/envName: string'
      );
    });
    it('should throw an error for a environment stage without the stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        // stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/stgNum: StageNumber'
      );
    });
    it('should throw an error for a environment stage without the next environment', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        // nextEnv: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/0: string\n' +
          'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/1: null'
      );
    });
    it('should throw an error for a environment stage without the next stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        // nextStgNum: '1'
        stgId: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextStgNum: (StageNumber | null)/0: StageNumber\n' +
          'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextStgNum: (StageNumber | null)/1: null'
      );
    });
    it('should throw an error for a environment stage with the incorrect environment name', () => {
      // arrange
      const environment = {
        envNaMe: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/envName: string'
      );
    });
    it('should throw an error for a environment stage with the incorrect stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNuM: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/stgNum: StageNumber'
      );
    });
    it('should throw an error for a environment stage with the incorrect next environment', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnV: 'ENV2',
        nextStgNum: '1',
        stgId: '2',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/0: string\n' +
          'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/nextEnv: (string | null)/1: null'
      );
    });
    it('should throw an error for a environment stage with the incorrect next stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
      };
      // act && assert
      expect(() => parseToType(EnvironmentStage, environment)).toThrowError(
        'Invalid value undefined supplied to : { envName: string, stgNum: StageNumber, stgId: string, nextEnv: (string | null), nextStgNum: (StageNumber | null) }/stgId: string'
      );
    });
  });
});
