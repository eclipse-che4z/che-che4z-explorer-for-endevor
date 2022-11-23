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
export const SYNC_PREFIX = 'sync';
export const SCM_PREFIX = 'scm';
export const GROUP_PREFIX = 'group';
export const OUTPUT_CHANNEL_NAME = 'Explorer for Endevor';

export const ENDEVOR_CONFIGURATION = 'endevor';
export const EXPERIMENTAL_CONFIGURATION = `${ENDEVOR_CONFIGURATION}.experimental`;
export const AUTOMATIC_SIGN_OUT_SETTING = 'automaticSignOut';
export const AUTOMATIC_SIGN_OUT_DEFAULT = false;
export const MAX_PARALLEL_REQUESTS_SETTING = 'maxParallelRequests';
export const MAX_PARALLEL_REQUESTS_DEFAULT = 4;

export const PROFILES_CONFIGURATION = 'profiles';
export const SYNC_WITH_PROFILES_SETTING = 'keepInSync';
export const SYNC_WITH_PROFILES_DEFAULT = true;

export const WORKSPACE_SYNC_SETTING = 'workspaceSync';
export const WORKSPACE_SYNC_DEFAULT = false;

export const TREE_VIEW_ID = `${COMMAND_PREFIX}.treeView`;

export const FILE_EXT_RESOLUTION_SETTING = 'fileExtensionResolution';
export const ELM_NAME_VALUE = 'Element name only';
export const TYPE_EXT_VALUE = 'Endevor type file extension only';
export const TYPE_EXT_OR_NAME_VALUE =
  'Endevor type file extension or type name';
export const FILE_EXT_RESOLUTION_DEFAULT = TYPE_EXT_OR_NAME_VALUE;

export const ENCODING = 'UTF-8';
export const BUFFER_ENCODING = 'utf-8';

export const SCM_ID = `${COMMAND_PREFIX}.${SCM_PREFIX}`;
export const SCM_LABEL = 'Endevor';

export const SCM_CHANGES_GROUP_ID = `${COMMAND_PREFIX}.${SCM_PREFIX}.${GROUP_PREFIX}.changes`;
export const SCM_CHANGES_GROUP_LABEL = 'Changes';

export const SCM_MERGE_CHANGES_GROUP_ID = `${COMMAND_PREFIX}.${SCM_PREFIX}.${GROUP_PREFIX}.mergeChanges`;
export const SCM_MERGE_CHANGES_GROUP_LABEL = 'Merge Changes';

export const SCM_RESOURCE_ADDED_LETTER = 'A';
export const SCM_RESOURCE_ADDED_TOOLTIP = 'Endevor Element Added';
export const SCM_RESOURCE_ADDED_COLOR = 'gitDecoration.addedResourceForeground';

export const SCM_RESOURCE_DELETED_LETTER = 'D';
export const SCM_RESOURCE_DELETED_TOOLTIP = 'Endevor Element Deleted';
export const SCM_RESOURCE_DELETED_COLOR =
  'gitDecoration.deletedResourceForeground';

export const SCM_RESOURCE_MODIFIED_LETTER = 'M';
export const SCM_RESOURCE_MODIFIED_TOOLTIP = 'Endevor Element Changed';
export const SCM_RESOURCE_MODIFIED_COLOR =
  'gitDecoration.stageModifiedResourceForeground';

export const SCM_RESOURCE_CONFLICTED_LETTER = '!';
export const SCM_RESOURCE_CONFLICTED_TOOLTIP =
  'Endevor Element Changes in Conflict';
export const SCM_RESOURCE_CONFLICTED_COLOR =
  'gitDecoration.conflictingResourceForeground';

export const SCM_VIEW_ID = 'workbench.scm';

export const DIFF_EDITOR_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.editedFolders`;
export const EXT_ACTIVATED_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.activated`;
export const SCM_STATUS_CONTEXT_NAME = `${COMMAND_PREFIX}.scm.status`;

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

export const ENDEVOR_CREDENTIAL_VALIDATION_LIMIT = 2;
