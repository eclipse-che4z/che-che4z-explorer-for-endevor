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
  BaseProfile,
  EndevorLocationProfile,
  EndevorServiceProfile,
} from '../_ext/Profile';

describe('parseToType profiles', () => {
  // here can be any profile: Base, EndevorService or Location
  describe('common profile cases', () => {
    it('should not report for missed fields', () => {
      // arrange
      const emptyProfile: BaseProfile = {};
      // act
      const actualBaseProfile = parseToType(BaseProfile, emptyProfile);
      // assert
      expect(actualBaseProfile).toEqual(emptyProfile);
    });
    it('should report for wrong typed profile', () => {
      // arrange
      const wrongTypedProfile = {
        host: 42,
      };
      // act && assert
      expect(() =>
        parseToType(BaseProfile, wrongTypedProfile)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('parseToType base profile', () => {
    it('should parse proper base profile', () => {
      // arrange
      const baseProfile: BaseProfile = {
        host: 'host',
        port: 9090,
        user: 'some_user',
        password: 'some_pass',
      };
      // act
      const actualBaseProfile = parseToType(BaseProfile, baseProfile);
      // assert
      expect(actualBaseProfile).toEqual(baseProfile);
    });
  });
  describe('parseToType endevor service profile', () => {
    it('should parse proper endevor service profile', () => {
      // arrange
      const endevorServiceProfile: EndevorServiceProfile = {
        host: 'host',
        port: 9090,
        user: 'some_user',
        password: 'some_pass',
      };
      // act
      const actualProfile = parseToType(
        EndevorServiceProfile,
        endevorServiceProfile
      );
      // assert
      expect(actualProfile).toEqual(endevorServiceProfile);
    });
  });
  describe('parseToType endevor location profile', () => {
    it('should parse proper endevor location profile', () => {
      // arrange
      const endevorLocationProfile: EndevorLocationProfile = {
        instance: 'NDVRCNFG',
        system: 'SYS',
      };
      // act
      const actualProfile = parseToType(
        EndevorLocationProfile,
        endevorLocationProfile
      );
      // assert
      expect(actualProfile).toEqual(endevorLocationProfile);
    });
  });
});
