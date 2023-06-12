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

import { COMMAND_PREFIX, SYNC_PREFIX } from '../constants';

export const CommandId = {
  CLEANUP_STORAGE: `${COMMAND_PREFIX}.cleanupStorage`,
  DUMP_STORAGE: `${COMMAND_PREFIX}.dumpStorageData`,
  MIGRATE_LOCATIONS: `${COMMAND_PREFIX}.migrateLocationsFromSettings`,
  SUBMIT_ISSUE: `${COMMAND_PREFIX}.submitIssue`,
  CHANGE_HISTORY_LEVEL: `${COMMAND_PREFIX}.changeHistoryLevel`,
  REFRESH_TREE_VIEW: `${COMMAND_PREFIX}.refreshTreeView`,
  REFRESH_HISTORY_TREE_VIEW: `${COMMAND_PREFIX}.refreshHistoryTreeView`,

  // service commands
  ADD_SERVICE_AND_LOCATION: `${COMMAND_PREFIX}.addServiceAndLocation`,
  ADD_NEW_SERVICE: `${COMMAND_PREFIX}.addNewService`,
  EDIT_SERVICE: `${COMMAND_PREFIX}.editService`,
  HIDE_SERVICE: `${COMMAND_PREFIX}.hideService`,
  DELETE_SERVICE: `${COMMAND_PREFIX}.deleteService`,
  EDIT_CONNECTION_DETAILS: `${COMMAND_PREFIX}.editConnectionDetails`,
  TEST_CONNECTION_DETAILS: `${COMMAND_PREFIX}.testConnectionDetails`,
  EDIT_CREDENTIALS: `${COMMAND_PREFIX}.editCredentials`,

  // location commands
  ADD_NEW_SEARCH_LOCATION: `${COMMAND_PREFIX}.addNewSearchLocation`,
  HIDE_SEARCH_LOCATION: `${COMMAND_PREFIX}.hideSearchLocation`,
  DELETE_SEARCH_LOCATION: `${COMMAND_PREFIX}.deleteSearchLocation`,

  // element commands
  VIEW_ELEMENT_DETAILS: `${COMMAND_PREFIX}.viewElementDetails`,
  ADD_ELEMENT_FROM_FILE_SYSTEM: `${COMMAND_PREFIX}.addElementFromFileSystem`,
  RETRIEVE_ELEMENT: `${COMMAND_PREFIX}.retrieveElement`,
  RETRIEVE_WITH_DEPENDENCIES: `${COMMAND_PREFIX}.retrieveElementWithDependencies`,
  QUICK_EDIT_ELEMENT: `${COMMAND_PREFIX}.editElement`,
  GENERATE_ELEMENT: `${COMMAND_PREFIX}.generateElement`,
  GENERATE_ELEMENT_WITH_COPY_BACK: `${COMMAND_PREFIX}.generateElementWithCopyBack`,
  GENERATE_ELEMENT_WITH_NO_SOURCE: `${COMMAND_PREFIX}.generateElementWithNoSource`,
  GENERATE_SUBSYSTEM_ELEMENTS: `${COMMAND_PREFIX}.generateSubsystemElements`,
  UPLOAD_ELEMENT: `${COMMAND_PREFIX}.uploadElement`,
  DISCARD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.discardChanges`,
  UPLOAD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.acceptChanges`,
  SIGN_OUT_ELEMENT: `${COMMAND_PREFIX}.signOutElement`,
  SIGN_IN_ELEMENT: `${COMMAND_PREFIX}.signInElement`,
  SHOW_FIRST_FOUND: `${COMMAND_PREFIX}.showFirstFoundElements`,
  SHOW_IN_PLACE: `${COMMAND_PREFIX}.showElementsInPlace`,
  PRINT_ELEMENT: `${COMMAND_PREFIX}.printElement`,
  PRINT_LISTING: `${COMMAND_PREFIX}.printListing`,
  PRINT_HISTORY: `${COMMAND_PREFIX}.printHistory`,

  // filter commands
  CLEAR_SEARCH_LOCATION_FILTERS: `${COMMAND_PREFIX}.clearSearchLocationFilters`,
  FILTER_SEARCH_LOCATION_BY_ELEMENT_NAME: `${COMMAND_PREFIX}.filterSearchLocationByElementName`,
  FILTER_SEARCH_LOCATION_BY_ELEMENT_TYPE: `${COMMAND_PREFIX}.filterSearchLocationByElementType`,
  FILTER_SEARCH_LOCATION_BY_ELEMENT_CCID: `${COMMAND_PREFIX}.filterSearchLocationByElementCcid`,
  CLEAR_SEARCH_LOCATION_FILTER: `${COMMAND_PREFIX}.clearSearchLocationFilter`,
  CLEAR_SEARCH_LOCATION_FILTER_VALUE: `${COMMAND_PREFIX}.clearSearchLocationFilterValue`,
  EDIT_SEARCH_LOCATION_FILTER: `${COMMAND_PREFIX}.editSearchLocationFilter`,

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
