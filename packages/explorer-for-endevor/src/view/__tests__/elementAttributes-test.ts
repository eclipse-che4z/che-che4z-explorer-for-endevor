/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { Element } from '@local/endevor/_doc/Endevor';
import { renderElementAttributes } from '../elementAttributes';
import * as cheerio from 'cheerio';

describe('renderElementAttributes', () => {
  it('renders a row for each endevor element attribute', () => {
    // arrange
    const element: Element = {
      environment: 'DEV',
      stageNumber: '1',
      system: 'SYSTEM',
      subSystem: 'SUBSYS',
      type: 'ASMPGM',
      name: 'ELEMENT',
      extension: 'cbl',
      instance: 'INS',
    };

    // act
    const html = renderElementAttributes(element);

    // assert
    const $ = cheerio.load(html);
    const rowsCount = $('tr').length;
    const hiddenAttributes = 1;
    expect(rowsCount + hiddenAttributes).toBe(Object.keys(element).length);
  });
});
