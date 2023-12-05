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

import { Element } from '@local/endevor/_doc/Endevor';
import { MoveOptions } from '../../dialogs/multi-step/moveOptions';
import { generateMoveSCL } from '../move';

describe('Create SCL', () => {
  const element: Element = {
    environment: 'DEV',
    stageNumber: '1',
    system: 'SYSTEM',
    subSystem: 'SUBSYS',
    type: 'ASMPGM',
    id: 'ELEMENT',
    name: 'ELEMENT',
  };
  describe('for Move without any options', () => {
    const options: MoveOptions = {
      ccid: '',
      comment: '',
      withHistory: false,
      bypassElementDelete: false,
      synchronize: false,
      retainSignout: false,
      ackElementJump: false,
    };
    it('to generate SCL without OPTIONS keyword', () => {
      // arrange
      const expectedScl = `
MOVE ELEMENT '${element.name}'
FROM ENVIRONMENT '${element.environment}'
     SYSTEM '${element.system}'
     SUBSYSTEM '${element.subSystem}'
     TYPE '${element.type}'
     STAGE NUM ${element.stageNumber}

.
`;
      // act
      const scl = generateMoveSCL(element, options);

      // assert
      expect(scl).toBe(expectedScl);
    });
  });

  describe('for Move with only ccid and comment', () => {
    const options: MoveOptions = {
      ccid: 'testccid',
      comment: 'test comment',
      withHistory: false,
      bypassElementDelete: false,
      synchronize: false,
      retainSignout: false,
      ackElementJump: false,
    };
    it('to generate SCL without additional options', () => {
      // arrange
      const expectedScl = `
MOVE ELEMENT '${element.name}'
FROM ENVIRONMENT '${element.environment}'
     SYSTEM '${element.system}'
     SUBSYSTEM '${element.subSystem}'
     TYPE '${element.type}'
     STAGE NUM ${element.stageNumber}
OPTIONS CCID '${options.ccid}' COMMENT '${options.comment}' 
.
`;
      // act
      const scl = generateMoveSCL(element, options);

      // assert
      expect(scl).toBe(expectedScl);
    });
  });

  describe('for Move with all options', () => {
    const options: MoveOptions = {
      ccid: 'testccid',
      comment: 'test comment',
      withHistory: true,
      bypassElementDelete: true,
      synchronize: true,
      retainSignout: true,
      ackElementJump: true,
    };
    it('to generate SCL with all option keywords', () => {
      // arrange
      const expectedScl = `
MOVE ELEMENT '${element.name}'
FROM ENVIRONMENT '${element.environment}'
     SYSTEM '${element.system}'
     SUBSYSTEM '${element.subSystem}'
     TYPE '${element.type}'
     STAGE NUM ${element.stageNumber}
OPTIONS CCID '${options.ccid}' COMMENT '${options.comment}' WITH HISTORY BYPASS ELEMENT DELETE SYNCHRONIZE RETAIN SIGNOUT JUMP 
.
`;
      // act
      const scl = generateMoveSCL(element, options);

      // assert
      expect(scl).toBe(expectedScl);
    });
  });
});
