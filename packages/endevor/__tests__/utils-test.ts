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

import * as fc from 'fast-check';
import { toVersion2Api } from '../utils';

describe('Test Endevor Rest API basepath v1 -> v2 conversion', () => {
  const v2basePath = '/EndevorService/api/v2/';

  describe('input contains endevor legacy basepath: EndevorService/rest', () => {
    it('return v2 basepath', () => {
      expect(toVersion2Api('EndevorService/rest')).toEqual(v2basePath);
      expect(toVersion2Api('/EndevorService/rest')).toEqual(v2basePath);
      expect(toVersion2Api('EndevorService/rest/')).toEqual(v2basePath);
      expect(toVersion2Api('/EndevorService/rest/')).toEqual(v2basePath);
      expect(toVersion2Api('gibberish/EndevorService/rest/gibberish')).toEqual(
        v2basePath
      );
    });
  });

  describe('input contains endevor v1 basepath: EndevorService/api/v1', () => {
    it('return v2 basepath', () => {
      expect(toVersion2Api('EndevorService/api/v1')).toEqual(v2basePath);
      expect(toVersion2Api('/EndevorService/api/v1')).toEqual(v2basePath);
      expect(toVersion2Api('EndevorService/api/v1/')).toEqual(v2basePath);
      expect(toVersion2Api('/EndevorService/api/v1/')).toEqual(v2basePath);
      expect(
        toVersion2Api('gibberish/EndevorService/api/v1/gibberish')
      ).toEqual(v2basePath);
    });
  });

  describe('input does not contain endevor legacy basepath or v1 basepath', () => {
    it('return the input', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (s) =>
                !s.includes('EndevorService/api/v1') ||
                !s.includes('EndevorService/rest')
            ),
          (url) => {
            expect(toVersion2Api(url)).toBe(url);
          }
        )
      );
    });
  });
});
