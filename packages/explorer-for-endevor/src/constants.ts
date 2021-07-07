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

export const COMMAND_PREFIX = 'e4e';
export const OUTPUT_CHANNEL_NAME = 'Explorer for Endevor';

export const ENDEVOR_CONFIGURATION = 'endevor';
export const LOCATIONS_SETTING = 'locations';
export const LOCATIONS_DEFAULT = [];
export const EDIT_FOLDER_SETTING = 'editDownloadFolder';
export const EDIT_FOLDER_DEFAULT = '.e4e';
export const MAX_PARALLEL_REQUESTS_SETTING = 'maxParallelRequests';
export const MAX_PARALLEL_REQUESTS_DEFAULT = 4;

export const ENDEVOR_V2_BASE_PATH = '/EndevorService/api/v2/';

export const TREE_VIEW_ID = `${COMMAND_PREFIX}.elmTreeView`;

export const ENCODING = 'UTF-8';

export const DIFF_EDITOR_WHEN_CONTEXT_NAME = `${COMMAND_PREFIX}.editedFolders`;
