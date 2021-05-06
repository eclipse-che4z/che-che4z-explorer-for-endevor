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
import { Element, ElementDependency, Repositories } from '../_ext/Endevor';

describe('parseToType endevor repositories', () => {
  it('should parse proper repositories structure', () => {
    // arrange
    const repositories: Repositories = [
      {
        name: 'WEBSMFNO',
      },
    ];
    // act
    const actualEndevorRepositories = parseToType(Repositories, repositories);
    // assert
    expect(actualEndevorRepositories).toEqual(repositories);
  });
  it('should report for missed instance name', () => {
    // arrange
    const repositoriesWithoutInstanceName = [{}];
    // act && assert
    expect(() =>
      parseToType(Repositories, repositoriesWithoutInstanceName)
    ).toThrow(
      'Invalid value undefined supplied to : Array<{ name: string }>/0: { name: string }/name: string'
    );
  });
});

describe('parseToType endevor elements', () => {
  it('should parse for a proper element', () => {
    // arrange
    const element = {
      envName: 'env',
      stgNum: '1',
      sysName: 'sys',
      sbsName: 'sbs',
      typeName: 'type',
      elmName: 'element',
      fileExt: '.cbl',
    };
    // act
    const result = parseToType(Element, element);
    // assert
    expect(result).toEqual(element);
  });
  it('should report for missing property', () => {
    // arrange
    const incorrectElement = {
      // envName: 'env',
      stgNum: '1',
      sysName: 'sys',
      sbsName: 'sbs',
      typeName: 'type',
      elmName: 'element',
      fileExt: '.cbl',
    };
    // act && assert
    expect(() => parseToType(Element, incorrectElement)).toThrowError();
  });
});

describe('parseToType endevor element dependencies', () => {
  it('should parse for a proper dependency', () => {
    // arrange
    const dependency = {
      components: [
        {
          envName: 'env',
          stgNum: '1',
          sysName: 'sys',
          sbsName: 'sbs',
          typeName: 'type',
          elmName: 'element',
          comment: 'comment',
          ccid: 'ccid',
        },
      ],
    };
    // act
    const result = parseToType(ElementDependency, dependency);
    // assert
    expect(result).toEqual(dependency);
  });
  it('should report for missing components', () => {
    // arrange
    const incorrectDependency = {};
    // act && assert
    expect(() =>
      parseToType(ElementDependency, incorrectDependency)
    ).toThrowError();
  });
});
