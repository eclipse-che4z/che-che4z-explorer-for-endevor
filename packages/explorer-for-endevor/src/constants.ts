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
export const AUTH_WITH_TOKEN_SETTING = 'authWithToken';
export const AUTH_WITH_TOKEN_SETTING_DEFAULT = true;
export const MAX_PARALLEL_REQUESTS_SETTING = 'maxParallelRequests';
export const MAX_PARALLEL_REQUESTS_DEFAULT = 4;

export const PROFILES_CONFIGURATION = 'profiles';
export const SYNC_WITH_PROFILES_SETTING = 'keepInSync';
export const SYNC_WITH_PROFILES_DEFAULT = true;

export const WORKSPACE_SYNC_SETTING = 'workspaceSync';
export const WORKSPACE_SYNC_DEFAULT = false;

export const TREE_VIEW_ID = `${COMMAND_PREFIX}.treeView`;
export const TREE_VIEW_INITIALIZED_CONTEXT_NAME = `${TREE_VIEW_ID}.initialized`;

export const ELM_HISTORY_VIEW_ID = `${COMMAND_PREFIX}.elementHistoryView`;

export const ACTIVITY_VIEW_ID = `${COMMAND_PREFIX}.activityView`;

export const FILE_EXT_RESOLUTION_SETTING = 'fileExtensionResolution';
export const ELM_NAME_VALUE = 'Element name only';
export const TYPE_EXT_VALUE = 'Endevor type file extension only';
export const TYPE_EXT_OR_NAME_VALUE =
  'Endevor type file extension or type name';
export const FILE_EXT_RESOLUTION_DEFAULT = TYPE_EXT_OR_NAME_VALUE;

export const CURRENT_CHANGE_LEVEL = 'current';

export const ENCODING = 'UTF-8';
export const BUFFER_ENCODING = 'utf-8';

export const SCM_ID = `${COMMAND_PREFIX}.${SCM_PREFIX}`;
export const SCM_LABEL = 'Endevor';

export const SCM_LOCAL_DIR = '.endevor';
export const SCM_METADATA_FILE = 'metadata.json';

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

export const DIFF_EDITOR_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.editedElements`;
export const SCM_STATUS_CONTEXT_NAME = `${COMMAND_PREFIX}.scm.status`;

export const UNIQUE_ELEMENT_FRAGMENT = 'SOME_UNIQUE_STRING';

export const EDIT_DIR = '.edit';

export const ZE_API_MIN_VERSION = '2.2.1';
export const ZOWE_PROFILE_DESCRIPTION = 'Zowe config';

export const FILTER_DELIMITER = ',';
export const FILTER_WILDCARD_ZERO_OR_MORE = '*';
export const FILTER_WILDCARD_SINGLE = '%';
export const FILTER_VALUE_DEFAULT = FILTER_WILDCARD_ZERO_OR_MORE;

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

export const DEFAULT_TREE_IN_PLACE_SEARCH_MODE = false;

export const DEFAULT_SHOW_EMPTY_TYPES_MODE = false;

// Retrieve with dependencies is split into 4 parts:
// 1. Retrieve main element
// 2. Get main element component info
// 3. Look for dependencies in the map
// 4. Retrieve dependencies
// There can be additional part in case we are retrieving with signout
export const RETRIEVE_PROGRESS_PARTS_NUM = 4;
