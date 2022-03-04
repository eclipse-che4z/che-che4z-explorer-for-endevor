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

import pkgjson = require('../package.json');

export const EXT_ID = `${pkgjson.publisher}.${pkgjson.name}`;
export const EXT_VERSION = pkgjson.version;

export const COMMAND_PREFIX = 'e4e';
export const OUTPUT_CHANNEL_NAME = 'Explorer for Endevor';

export const ENDEVOR_CONFIGURATION = 'endevor';
export const LOCATIONS_SETTING = 'locations';
export const LOCATIONS_DEFAULT = [];
export const EDIT_FOLDER_SETTING = 'editDownloadFolder';
export const EDIT_FOLDER_DEFAULT = '.e4e';
export const AUTOMATIC_SIGN_OUT_SETTING = 'automaticSignOut';
export const AUTOMATIC_SIGN_OUT_DEFAULT = false;
export const MAX_PARALLEL_REQUESTS_SETTING = 'maxParallelRequests';
export const MAX_PARALLEL_REQUESTS_DEFAULT = 4;

export const ENDEVOR_V2_BASE_PATH = '/EndevorService/api/v2/';

export const TREE_VIEW_ID = `${COMMAND_PREFIX}.elmTreeView`;

export const ENCODING = 'UTF-8';

export const DIFF_EDITOR_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.editedFolders`;

export const UNIQUE_ELEMENT_FRAGMENT = 'SOME_UNIQUE_STRING';
// ms
// the same time, as VSCode uses to hide notification
export const NOTIFICATION_TIMEOUT = 15000;

export const ENDEVOR_MESSAGE_CODE_PREFIXES = [
  'ACMB',
  'ACMO',
  'ACMQ',
  'ACMR',
  'ANAL',
  'API',
  'BC1P',
  'ENAP',
  'B1E',
  'B1NM',
  'B1TS',
  'BTSQ',
  'C1A',
  'C1C',
  'C1B',
  'C1E',
  'C1F',
  'C1G',
  'C1I',
  'C1L',
  'C1P',
  'C1R',
  'C1X',
  'C1U',
  'C1V',
  'C1Y',
  'C2FM',
  'CIIO',
  'ECAP',
  'ENB',
  'ENB',
  'ENC',
  'END',
  'EWS',
  'ENI',
  'ENM',
  'FPVL',
  'FUPD',
  'IMGR',
  'JLOG',
  'JRCV',
  'MCS',
  'PDM',
  'PKEX',
  'PKMR',
  'RDLT',
  'SCHK',
  'SHP',
  'SMGR',
  'SYN',
  'VAL',
  'VSI',
];
