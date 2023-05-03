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

import assert = require('assert');
import * as sinon from 'sinon';
import { CachedElement } from '../../store/_doc/v2/Store';
import { parseHistory } from '../../tree/endevor';
import * as elementHistoryUri from '../../uri/elementHistoryUri';
import { isError } from '../../utils';
import { getChangeLevelContent } from '../../view/changeLvlContentProvider';
import { Element } from '@local/endevor/_doc/Endevor';
import { Id, Source } from '../../store/storage/_doc/Storage';
import { UNIQUE_ELEMENT_FRAGMENT } from '../../constants';
import { Uri } from 'vscode';
import { ElementChangeUriQuery, FragmentType } from '../../_doc/Uri';

jest.mock(
  'vscode',
  () => ({
    window: {
      createTextEditorDecorationType: jest.fn(),
    },
  }),
  { virtual: true }
);
jest.mock(
  '../../globals',
  () => ({
    logger: {
      trace: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    reporter: {
      sendTelemetryEvent: jest.fn(),
    },
  }),
  { virtual: true }
);

const historyTextValid = `1CA Endevor SCM Version 18.1.00        Copyright (C) 1986-2019 Broadcom. All Rig
PROBLEM                                               CA Endevor SCM           
PRINT                                  HISTORY                                 
ELEMENT: ELMCAST1                                                              
                                                                               
*******************************************************************************
*******************************************************************************
**                                                                           **
** ELEMENT HISTORY                                           28FEB23  04:14  **
**                                                                           **
**    ENVIRONMENT:   ENV1       SYSTEM:    QAPKG     SUBSYSTEM:  SBSQAM2     **
**    TYPE:          ASM        STAGE ID:  A                                 **
**    ELEMENT:       ELMCAST1                                                **
**                                                                           **
**    SIGNED OUT TO: MILANKO                         DELTA TYPE: REVERSE     **
**                                                                           **
*******************************************************************************
*******************************************************************************
                                                                               
-------------------------- SOURCE LEVEL INFORMATION ---------------------------
                                                                               
  VVLL SYNC USER     DATE    TIME     STMTS CCID         COMMENT                                   
  ---- ---- -------- ------- ----- -------- ------------ ----------------------------------------  
  0100      MILANKO  31JAN23 04:28        1                                                        
  0101      MILANKO  28FEB23 04:13        2 TEST         COMMENT                                   
  0102      JANMI04  29FEB23 04:14        3 HELE         HALUZ                                     
  0103      USERXYZ  30FEB23 04:14        2 CCID                                                   
  0104      MILANKO  28FEB23 04:14        3              JUST COMMENT                              
GENERATED   MILANKO  28FEB23 04:14                                                                 
                                                                                                   
 +0100      ELEMENT                                                                         
%+0104      LINE 4                                                                          
%+0104      LINE 5                                                                          
%+0101-0103 LINE 2                                                                          
%+0102-0104 LINE 3                                                                          
`;

const historyTextInvalid = `1CA Endevor SCM Version 18.1.00        Copyright (C) 1986-2019 Broadcom. All Rig
PROBLEM                                               CA Endevor SCM           
PRINT                                  HISTORY                                 
ELEMENT: ELMCAST1                                                              
                                                                               
*******************************************************************************
*******************************************************************************
**                                                                           **
** ELEMENT HISTORY                                           28FEB23  04:14  **
**                                                                           **
**    ENVIRONMENT:   ENV1       SYSTEM:    QAPKG     SUBSYSTEM:  SBSQAM2     **
**    TYPE:          ASM        STAGE ID:  A                                 **
**    ELEMENT:       ELMCAST1                                                **
**                                                                           **
**    SIGNED OUT TO: MILANKO                         DELTA TYPE: REVERSE     **
**                                                                           **
*******************************************************************************
*******************************************************************************
                                                                               
-------------------------- SOURCE LEVEL INFORMATION ---------------------------
                                                                               
  VVLL SYNC USER     DATE    TIME     STMTS CCID            COMMENT                                   
  ---- ---- -------- ------- ----- -------- ------------    ----------------------------------------  
  0100      MILANKO  31JAN23 04:28        1                                                        
  0101      MILANKO  28FEB23 04:13        2 TEST            COMMENT                                   
  0102      JOZKO    29FEB23 04:14        3 HELE            HALUZ                                     
  0103      USERXYZ  30FEB23 04:14        2 CCID                                                   
  0104      MILANKO  28FEB23 04:14        3                 JUST COMMENT                              
GENERATED   MILANKO  28FEB23 04:14                                                                 
                                                                                                   
 +0100      ELEMENT                                                                         
%+0104      LINE 4                                                                          
%+0104      LINE 5                                                                          
%+0101-0103 LINE 2                                                                          
%+0102-0104 LINE 3                                                                          
`;

describe('showHistory', () => {
  const uri = {
    scheme: 'hist',
    authority: '',
    path: '',
    query: '',
    fragment: '',
    fsPath: '',
    with: jest.fn(),
    toJSON: jest.fn(),
  };
  describe('parseHistory', () => {
    it('should properly parse the history content', () => {
      const historyData = parseHistory(historyTextValid, uri);
      if (isError(historyData)) {
        const error = historyData;
        assert.fail(`Could not parse history because of: ${error.message}`);
      }
      expect(historyData.changeLevels.length).toBe(5);
      expect(historyData.historyLines.length).toBe(5);
      expect(historyData.changeLevels[1]).toStrictEqual({
        uri,
        vvll: '0101',
        user: 'MILANKO',
        date: '28FEB23',
        time: '04:13',
        ccid: 'TEST',
        comment: 'COMMENT',
        lineNums: [],
      });
      expect(historyData.changeLevels[3]).toStrictEqual({
        uri,
        vvll: '0103',
        user: 'USERXYZ',
        date: '30FEB23',
        time: '04:14',
        ccid: 'CCID',
        comment: '',
        lineNums: [],
      });
      expect(historyData.changeLevels[4]).toStrictEqual({
        uri,
        vvll: '0104',
        user: 'MILANKO',
        date: '28FEB23',
        time: '04:14',
        ccid: '',
        comment: 'JUST COMMENT',
        lineNums: [],
      });
      // check history lines
      expect(historyData.historyLines[0]).toStrictEqual({
        changed: false,
        line: 30,
        removedVersion: '',
        addedVersion: '0100',
        lineLength: 92,
      });
      expect(historyData.historyLines[2]).toStrictEqual({
        changed: true,
        line: 32,
        removedVersion: '',
        addedVersion: '0104',
        lineLength: 92,
      });
      expect(historyData.historyLines[3]).toStrictEqual({
        changed: true,
        line: 33,
        removedVersion: '0103',
        addedVersion: '0101',
        lineLength: 92,
      });
    });

    it('should return error if history change levels not in correct format', () => {
      const historyData = parseHistory(historyTextInvalid, uri);
      expect(isError(historyData)).toBe(true);
    });
  });

  describe('getChangeLevelContent', () => {
    afterEach(async () => {
      // Sinon has some issues with cleaning up the environment after itself, so we have to do it
      // TODO: take a look into Fake API instead of Stub
      sinon.restore();
    });

    const dispatch = jest.fn();
    const serviceId: Id = { name: 'serviceName', source: Source.INTERNAL };
    const searchLocationId: Id = {
      name: 'searchLocationName',
      source: Source.INTERNAL,
    };
    const element: Element = {
      environment: 'ENV',
      system: 'SYS',
      subSystem: 'SUBSYS',
      stageNumber: '1',
      type: 'TYP',
      name: 'ELM',
      id: 'ELM',
      noSource: false,
      extension: 'ext',
      lastActionCcid: 'LAST-CCID',
    };
    const getElement = () => () => (): CachedElement | undefined => {
      return {
        element,
        elementIsUpTheMap: false,
        lastRefreshTimestamp: Date.now(),
        historyData: {
          changeLevels: [
            {
              uri,
              vvll: '0100',
              user: 'MELDO',
              date: '010101',
              time: 'HH:MM',
              ccid: 'CCID',
              comment: 'COMMENT',
            },
            {
              uri,
              vvll: '0101',
              user: 'MELDO',
              date: '010101',
              time: 'HH:MM',
              ccid: 'CCID',
              comment: 'COMMENT',
            },
            {
              uri,
              vvll: '0102',
              user: 'MELDO',
              date: '010101',
              time: 'HH:MM',
              ccid: 'CCID',
              comment: 'COMMENT',
            },
            {
              uri,
              vvll: '0103',
              user: 'MELDO',
              date: '010101',
              time: 'HH:MM',
              ccid: 'CCID',
              comment: 'COMMENT',
            },
            {
              uri,
              vvll: '0104',
              user: 'MELDO',
              date: '010101',
              time: 'HH:MM',
              ccid: 'CCID',
              comment: 'COMMENT',
            },
          ],
          historyLines: [
            {
              addedVersion: '0100',
              line: 30,
              removedVersion: '',
              lineLength: 92,
            },
            {
              addedVersion: '0104',
              line: 31,
              removedVersion: '',
              lineLength: 92,
            },
            {
              addedVersion: '0104',
              line: 32,
              removedVersion: '',
              lineLength: 92,
            },
            {
              addedVersion: '0101',
              line: 33,
              removedVersion: '0103',
              lineLength: 92,
            },
            {
              addedVersion: '0102',
              line: 34,
              removedVersion: '0104',
              lineLength: 92,
            },
          ],
        },
      };
    };

    const mockGetUri =
      (uriArg: Uri) =>
      (mockResult: (ElementChangeUriQuery & FragmentType) | Error) => {
        return sinon
          .stub(elementHistoryUri, 'fromElementChangeUri')
          .withArgs(uriArg)
          .returns(mockResult);
      };

    it('creates correct content for level 0100', async () => {
      mockGetUri(uri)({
        serviceId,
        searchLocationId,
        element,
        vvll: '0100',
        fragment: UNIQUE_ELEMENT_FRAGMENT,
      });
      const changeLevelContent = await getChangeLevelContent(
        dispatch,
        getElement,
        uri,
        historyTextValid
      );
      expect(changeLevelContent).toMatchSnapshot();
    });

    it('creates correct content for level 0101', async () => {
      mockGetUri(uri)({
        serviceId,
        searchLocationId,
        element,
        vvll: '0101',
        fragment: UNIQUE_ELEMENT_FRAGMENT,
      });
      const changeLevelContent = await getChangeLevelContent(
        dispatch,
        getElement,
        uri,
        historyTextValid
      );
      expect(changeLevelContent).toMatchSnapshot();
    });

    it('creates correct content for level 0103', async () => {
      mockGetUri(uri)({
        serviceId,
        searchLocationId,
        element,
        vvll: '0103',
        fragment: UNIQUE_ELEMENT_FRAGMENT,
      });
      const changeLevelContent = await getChangeLevelContent(
        dispatch,
        getElement,
        uri,
        historyTextValid
      );
      expect(changeLevelContent).toMatchSnapshot();
    });

    it('creates correct content for level 0104', async () => {
      mockGetUri(uri)({
        serviceId,
        searchLocationId,
        element,
        vvll: '0104',
        fragment: UNIQUE_ELEMENT_FRAGMENT,
      });
      const changeLevelContent = await getChangeLevelContent(
        dispatch,
        getElement,
        uri,
        historyTextValid
      );
      expect(changeLevelContent).toMatchSnapshot();
    });
  });
});
