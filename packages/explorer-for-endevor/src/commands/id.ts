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

import { COMMAND_PREFIX } from '../constants';

export const CommandId = {
  PRINT_ELEMENT: `${COMMAND_PREFIX}.printElement`,
  PRINT_LISTING: `${COMMAND_PREFIX}.printListing`,
  REFRESH_TREE_VIEW: `${COMMAND_PREFIX}.refreshTreeView`,
  ADD_NEW_SERVICE: `${COMMAND_PREFIX}.addNewService`,
  ADD_NEW_ELEMENT_LOCATION: `${COMMAND_PREFIX}.addNewElementLocation`,
  HIDE_ELEMENT_LOCATION: `${COMMAND_PREFIX}.hideElementLocation`,
  HIDE_SERVICE: `${COMMAND_PREFIX}.hideService`,
  VIEW_ELEMENT_DETAILS: `${COMMAND_PREFIX}.viewElementDetails`,
  ADD_ELEMENT_FROM_FILE_SYSTEM: `${COMMAND_PREFIX}.addElementFromFileSystem`,
  RETRIEVE_ELEMENT: `${COMMAND_PREFIX}.retrieveElement`,
  RETRIEVE_WITH_DEPENDENCIES: `${COMMAND_PREFIX}.retrieveElementWithDependencies`,
  QUICK_EDIT_ELEMENT: `${COMMAND_PREFIX}.editElement`,
  GENERATE_ELEMENT: `${COMMAND_PREFIX}.generateElement`,
  UPLOAD_ELEMENT: `${COMMAND_PREFIX}.uploadElement`,
  DISCARD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.discardChanges`,
  UPLOAD_COMPARED_ELEMENT: `${COMMAND_PREFIX}.diff.acceptChanges`,
  SIGN_OUT_ELEMENT: `${COMMAND_PREFIX}.signOutElement`,
  SIGN_IN_ELEMENT: `${COMMAND_PREFIX}.signInElement`,
};
