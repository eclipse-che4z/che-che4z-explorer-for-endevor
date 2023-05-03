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

import { parseToType } from '@local/type-parser/parser';
import {
  Element,
  Configuration,
  SubSystem,
  System,
  EnvironmentStage,
  ElementType,
  Component,
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
      expect(() =>
        parseToType(EnvironmentStage, environment)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(EnvironmentStage, environment)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a environment stage without the stage id', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: '1',
        // stgId: '2',
      };
      // act && assert
      expect(() =>
        parseToType(EnvironmentStage, environment)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(EnvironmentStage, environment)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(EnvironmentStage, environment)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a environment stage with the incorrect next stage number', () => {
      // arrange
      const environment = {
        envName: 'ENV',
        stgNum: '2',
        nextEnv: 'ENV2',
        nextStgNum: 'T',
        stgId: '1',
      };
      // act && assert
      expect(() =>
        parseToType(EnvironmentStage, environment)
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
      expect(() => parseToType(System, system)).toThrowErrorMatchingSnapshot();
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
      expect(() => parseToType(System, system)).toThrowErrorMatchingSnapshot();
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
      expect(() => parseToType(System, system)).toThrowErrorMatchingSnapshot();
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
      expect(() => parseToType(System, system)).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a subsystem with an incorrect stage id', () => {
      // arrange
      const subSystem = {
        envName: 'ENV',
        sysName: 'SYS',
        sbsName: 'SUBSYS',
        stgId: 3, // <-- should be literal
        stgSeqNum: 1,
        nextSbs: 'SUBSYS',
      };
      // act && assert
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
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
      expect(() =>
        parseToType(SubSystem, subSystem)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('"element type" type parsing', () => {
    it('should parse a proper element type', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act
      const parsedElementType = parseToType(ElementType, elementType);
      // assert
      const expectedElementType: ElementType = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      expect(parsedElementType).toStrictEqual(expectedElementType);
    });
    it('should throw an error for a element type without an environment name', () => {
      // arrange
      const elementType = {
        // envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a element type without a system name', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        // sysName: 'SYS',
        stgId: '1',
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a element type without a stage id', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        sysName: 'SYS',
        // stgId: '1',
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a element type with an incorrect stage id', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: 3, // <- should be literal
        typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a element type without a type name', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        // typeName: 'TYPE',
        nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a subsystem without a next type name', () => {
      // arrange
      const elementType = {
        envName: 'ENV',
        sysName: 'SYS',
        stgId: '1',
        typeName: 'TYPE',
        // nextType: 'NEXT_TYPE',
      };
      // act && assert
      expect(() =>
        parseToType(ElementType, elementType)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('element type parsing', () => {
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should parse an element without last action CCID', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fullElmName: 'ELM1',
        fileExt: 'cbl',
        nosource: 'N',
        // lastActCcid: 'CCID',
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
        fileExt: 'cbl',
        nosource: 'N',
      };
      expect(parsedElement).toStrictEqual(expectedElement);
    });
    it('should parse an element with null last action CCID', () => {
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
        lastActCcid: null,
        nosource: 'Y',
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
        lastActCcid: null,
        nosource: 'Y',
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for an element without full element name', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        // fullElmName: 'ELM1',
        elmName: 'ELM1',
        stgNum: '2',
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
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
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
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
        fullElmName: 'ELM1',
        lastActCcid: 'CCID',
        nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for an element without nosource', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fullElmName: 'ELM1',
        lastActCcid: 'CCID',
        //nosource: 'N',
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for an element with incorrect nosource', () => {
      // arrange
      const element = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
        fullElmName: 'ELM1',
        lastActCcid: 'CCID',
        nosource: true,
      };
      // act && assert
      expect(() =>
        parseToType(Element, element)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('component type parsing', () => {
    it('should parse a proper component', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act
      const parsedComponent = parseToType(Component, component);
      // assert
      const expectedComponent: Component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      expect(parsedComponent).toStrictEqual(expectedComponent);
    });
    it('should parse a component with numeric stage number', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: 2,
      };
      // act
      const parsedComponent = parseToType(Component, component);
      // assert
      const expectedComponent: Component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      expect(parsedComponent).toStrictEqual(expectedComponent);
    });
    it('should throw an error for a component without element name', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        // elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a component without stage number', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        // stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a component without environment name', () => {
      // arrange
      const component = {
        // envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a component without type name', () => {
      // arrange
      const component = {
        envName: 'ENV',
        // typeName: 'TYPE',
        sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a component without system name', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        // sysName: 'SYS',
        sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a component without subsystem name', () => {
      // arrange
      const component = {
        envName: 'ENV',
        typeName: 'TYPE',
        sysName: 'SYS',
        // sbsName: 'SBS',
        elmName: 'ELM1',
        stgNum: '2',
      };
      // act && assert
      expect(() =>
        parseToType(Component, component)
      ).toThrowErrorMatchingSnapshot();
    });
  });
});
