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

import { COMMAND_PREFIX, SYNC_PREFIX } from '../constants';

export const CommandId = {
  CLEANUP_STORAGE: `${COMMAND_PREFIX}.cleanupStorage`,
  SUBMIT_ISSUE: `${COMMAND_PREFIX}.submitIssue`,
  PRINT_ELEMENT: `${COMMAND_PREFIX}.printElement`,
  PRINT_LISTING: `${COMMAND_PREFIX}.printListing`,
  REFRESH_TREE_VIEW: `${COMMAND_PREFIX}.refreshTreeView`,
  ADD_SERVICE_AND_LOCATION: `${COMMAND_PREFIX}.addServiceAndLocation`,
  ADD_NEW_SERVICE: `${COMMAND_PREFIX}.addNewService`,
  ADD_NEW_SEARCH_LOCATION: `${COMMAND_PREFIX}.addNewSearchLocation`,
  HIDE_SEARCH_LOCATION: `${COMMAND_PREFIX}.hideSearchLocation`,
  HIDE_SERVICE: `${COMMAND_PREFIX}.hideService`,
  DELETE_SERVICE: `${COMMAND_PREFIX}.deleteService`,
  DELETE_SEARCH_LOCATION: `${COMMAND_PREFIX}.deleteSearchLocation`,
  VIEW_ELEMENT_DETAILS: `${COMMAND_PREFIX}.viewElementDetails`,
  ADD_ELEMENT_FROM_FILE_SYSTEM: `${COMMAND_PREFIX}.addElementFromFileSystem`,
  RETRIEVE_ELEMENT: `${COMMAND_PREFIX}.retrieveElement`,
  RETRIEVE_WITH_DEPENDENCIES: `${COMMAND_PREFIX}.retrieveElementWithDependencies`,
  QUICK_EDIT_ELEMENT: `${COMMAND_PREFIX}.editElement`,
  GENERATE_ELEMENT: `${COMMAND_PREFIX}.generateElement`,
  GENERATE_ELEMENT_WITH_COPY_BACK: `${COMMAND_PREFIX}.generateElementWithCopyBack`,
  GENERATE_ELEMENT_WITH_NO_SOURCE: `${COMMAND_PREFIX}.generateElementWithNoSource`,
  UPLOAD_ELEMENT: `${COMMAND_PREFIX}.uploadElement`,
  DISCARD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.discardChanges`,
  UPLOAD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.acceptChanges`,
  SIGN_OUT_ELEMENT: `${COMMAND_PREFIX}.signOutElement`,
  SIGN_IN_ELEMENT: `${COMMAND_PREFIX}.signInElement`,
  MIGRATE_LOCATIONS: `${COMMAND_PREFIX}.migrateLocationsFromSettings`,
  EDIT_CONNECTION_DETAILS: `${COMMAND_PREFIX}.editConnectionDetails`,
  TEST_CONNECTION_DETAILS: `${COMMAND_PREFIX}.testConnectionDetails`,
  EDIT_CREDENTIALS: `${COMMAND_PREFIX}.editCredentials`,

  // sync commands
  INIT_WORKSPACE: `${COMMAND_PREFIX}.${SYNC_PREFIX}.initWorkspace`,
  SYNC_WORKSPACE: `${COMMAND_PREFIX}.${SYNC_PREFIX}.syncWorkspace`,
  PULL_FROM_ENDEVOR: `${COMMAND_PREFIX}.${SYNC_PREFIX}.pullFromEndevor`,
  SHOW_ADDED_ELEMENT: `${COMMAND_PREFIX}.${SYNC_PREFIX}.showAddedElement`,
  SHOW_DELETED_ELEMENT: `${COMMAND_PREFIX}.${SYNC_PREFIX}.showDeletedElement`,
  SHOW_MODIFIED_ELEMENT: `${COMMAND_PREFIX}.${SYNC_PREFIX}.showModifiedElement`,
  SHOW_CONFLICTED_ELEMENT: `${COMMAND_PREFIX}.${SYNC_PREFIX}.showConflictedElement`,
  OPEN_ELEMENT: `${COMMAND_PREFIX}.${SYNC_PREFIX}.openElement`,
  DISCARD_CHANGES: `${COMMAND_PREFIX}.${SYNC_PREFIX}.discardChanges`,
  DISCARD_ALL_CHANGES: `${COMMAND_PREFIX}.${SYNC_PREFIX}.discardAllChanges`,
  REVERT_SECTION_CHANGE: `${COMMAND_PREFIX}.${SYNC_PREFIX}.revertSectionChange`,
  CONFIRM_CONFLICT_RESOLUTION: `${COMMAND_PREFIX}.${SYNC_PREFIX}.confirmConflictResolution`,
  CONFIRM_ALL_CONFLICT_RESOLUTIONS: `${COMMAND_PREFIX}.${SYNC_PREFIX}.confirmAllConflictResolutions`,
};
