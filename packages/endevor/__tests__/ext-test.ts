/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { Element, Repository } from '../_ext/Endevor';

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
});
