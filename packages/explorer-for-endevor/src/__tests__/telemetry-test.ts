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

import { getRedactedError } from '../telemetry';

jest.mock('vscode', () => ({}), { virtual: true });

describe('telemetry errors redacting', () => {
  // if failed - we have a function side effect
  it('should save the passed error as it is', () => {
    // arrange
    const errorMessage = `Endevor is a very useful tool`;
    const passedError = new Error(errorMessage);
    // act
    getRedactedError(passedError);
    // assert
    expect(passedError.message).toStrictEqual(errorMessage);
  });

  // if failed - we are removing existing error message for the errors without error codes
  it('should return the same error', () => {
    // arrange
    const errorMessage = `Endevor is a very useful tool`;
    const expectedError = new Error(errorMessage);
    // act
    const actualError = getRedactedError(expectedError);
    // assert
    expect(actualError.message).toStrictEqual(expectedError.message);
  });

  it('should return an error with redacted Endevor messages', () => {
    // arrange
    const errorMessage =
      'Unable to do something with element SYS/SUBSYS/TYPE/ELM because of response code 16 with reason ' +
      'EWS1117I Request processed by SysID A01SENF, STC TSO1MFTS - STC02971\n' +
      '16:11:41  SMGR160E  INVALID SOURCE RECORD LENGTH - 00086 EXCEEDS MAXIMUM RECORD LENGTH FOR TYPE - 00080';
    const passedError = new Error(errorMessage);
    const expectedErrorMessage =
      '<REDACTED: user-endevor-messages> EWS1117I, SMGR160E';
    // act
    const actualError = getRedactedError(passedError);
    // assert
    expect(actualError.message).toStrictEqual(expectedErrorMessage);
  });

  it('should return an error with redacted paths', () => {
    // arrange
    const errorMessage =
      'Unable to do something with element SYS/SUBSYS/TYPE/ELM and ' +
      'some file path /users/userid/somefolder/anotherfolder/file.ext and ' +
      'some URI file:///users/userid/somefolder/anotherfolder/file.ext?prop1="x"&prop2="y" and ' +
      'some encoded URI file:///users/userid/somefolder/anotherfolder/file.ext' +
      '?%7B%22element%22%3A%22ELM%22%2C%22system%22%3A%22SYS%22%2C%22subsys%22%3A%22SUBSYS%22%2C%22type%22%3A%22TYPE%22%7D ' +
      'because of error in directory "/users/userid/somefolder/yetanotherfolder".';
    const error = new Error(errorMessage);
    const expectedErrorMessage =
      'Unable to do something with element <REDACTED: user-path> and ' +
      'some file path <REDACTED: user-path> and ' +
      'some URI <REDACTED: user-path> and ' +
      'some encoded URI <REDACTED: user-path> ' +
      'because of error in directory "<REDACTED: user-path>".';
    // act
    const actualError = getRedactedError(error);
    // assert
    expect(actualError.message).toStrictEqual(expectedErrorMessage);
  });
});
