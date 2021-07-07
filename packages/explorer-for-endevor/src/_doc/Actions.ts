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

import { Credential } from '@local/endevor/_doc/Credential';
import { ElementTree } from './ElementTree';
import { LocationConfig } from './settings';

export const enum Actions {
  DUMMY_NOOP = 'DUMMY/NOOP',
  ENDEVOR_CREDENTIAL_ADDED = 'CREDENTIAL/ADDED',
  LOCATION_CONFIG_CHANGED = 'LOCATIONS/CHANGED',
  ELEMENT_TREE_ADDED = 'ELEMENT_TREE_ADDED',
  REFRESH = 'REFRESH',
  EDIT_FOLDER_CHANGED = 'EDIT_FOLDER/CHANGED',
}

interface DummyAction {
  type: Actions.DUMMY_NOOP;
}

interface LocationConfigChanged {
  type: Actions.LOCATION_CONFIG_CHANGED;
  payload: ReadonlyArray<LocationConfig>;
}

interface EndevorCredentialAdded {
  type: Actions.ENDEVOR_CREDENTIAL_ADDED;
  serviceName: string;
  credential: Credential;
}

interface ElementTreeAdded {
  type: Actions.ELEMENT_TREE_ADDED;
  tree: ElementTree;
}

interface Refresh {
  type: Actions.REFRESH;
  payload: ReadonlyArray<LocationConfig>;
}

interface EditFolderChanged {
  type: Actions.EDIT_FOLDER_CHANGED;
  payload: string | undefined;
}

export type Action =
  | DummyAction
  | EndevorCredentialAdded
  | LocationConfigChanged
  | ElementTreeAdded
  | Refresh
  | EditFolderChanged;
