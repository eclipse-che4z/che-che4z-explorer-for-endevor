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

export const UNKNOWN_VERSION = '0.0.0';

export const COMMAND_PREFIX = 'e4e';
export const OUTPUT_CHANNEL_NAME = 'Explorer for Endevor';

export const ENDEVOR_CONFIGURATION = 'endevor';
export const AUTOMATIC_SIGN_OUT_SETTING = 'automaticSignOut';
export const AUTOMATIC_SIGN_OUT_DEFAULT = false;
export const MAX_PARALLEL_REQUESTS_SETTING = 'maxParallelRequests';
export const MAX_PARALLEL_REQUESTS_DEFAULT = 4;

export const PROFILES_CONFIGURATION = 'profiles';
export const SYNC_WITH_PROFILES_SETTING = 'keepInSync';
export const SYNC_WITH_PROFILES_DEFAULT = true;

export const TREE_VIEW_ID = `${COMMAND_PREFIX}.treeView`;

export const FILE_EXT_RESOLUTION_SETTING = 'fileExtensionResolution';
export const ELM_NAME_VALUE = 'Element name only';
export const TYPE_EXT_VALUE = 'Endevor type file extension only';
export const TYPE_EXT_OR_NAME_VALUE =
  'Endevor type file extension or type name';
export const FILE_EXT_RESOLUTION_DEFAULT = TYPE_EXT_OR_NAME_VALUE;

export const ENCODING = 'UTF-8';

export const DIFF_EDITOR_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.editedFolders`;

export const UNIQUE_ELEMENT_FRAGMENT = 'SOME_UNIQUE_STRING';

export const EDIT_DIR = '.edit';

export const EXTENSION_ISSUES_PAGE = pkgjson.bugs.url;

export const ZE_API_MIN_VERSION = '2.2.1';
export const ZOWE_PROFILE_DESCRIPTION = 'Zowe config';

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
