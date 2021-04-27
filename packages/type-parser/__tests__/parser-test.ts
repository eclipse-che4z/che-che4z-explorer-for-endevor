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

import { parseToType } from '../parser';
import * as t from 'io-ts';

type TestType = t.TypeOf<typeof TestType>;
const TestType = t.type({
  property1: t.string,
  property2: t.string,
});

describe('parseToType', () => {
  it('should parse the proper structure', () => {
    // arrange
    const value = {
      property1: 'some_value',
      property2: 'some_value',
    };
    // act
    const parsedValue: TestType = parseToType(TestType, value);
    // assert
    expect(parsedValue).toEqual(value);
  });
  it('should report for missing property', () => {
    // arrange
    const wrongTypedValue = {
      property1: 'some_value',
    };
    // act && assert
    expect(() => parseToType(TestType, wrongTypedValue)).toThrowError();
  });
  it('should report for undefined', () => {
    // arrange
    const undefinedValue = undefined;
    // act && assert
    expect(() => parseToType(TestType, undefinedValue)).toThrowError();
  });
  it('should report for empty string', () => {
    // arrange
    const emptyValue = '';
    // act && assert
    expect(() => parseToType(TestType, emptyValue)).toThrowError();
  });
});
