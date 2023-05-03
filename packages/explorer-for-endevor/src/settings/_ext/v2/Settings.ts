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

import * as t from 'io-ts';
import {
  ELM_NAME_VALUE,
  TYPE_EXT_OR_NAME_VALUE,
  TYPE_EXT_VALUE,
} from '../../../constants';

export type AutoSignOut = t.TypeOf<typeof AutoSignOut>;
export type AuthWithToken = t.TypeOf<typeof AuthWithToken>;
export type SyncWithProfiles = t.TypeOf<typeof SyncWithProfiles>;

export type MaxParallelRequests = t.TypeOf<typeof MaxParallelRequests>;

export type WorkspaceSync = t.TypeOf<typeof WorkspaceSync>;

export type FileExtensionsResolution = t.TypeOf<
  typeof FileExtensionsResolution
>;

export const AutoSignOut = t.boolean;
export const AuthWithToken = t.boolean;
export const SyncWithProfiles = t.boolean;

export const MaxParallelRequests = t.number;

export const FileExtensionsResolution = t.union([
  t.literal(ELM_NAME_VALUE),
  t.literal(TYPE_EXT_VALUE),
  t.literal(TYPE_EXT_OR_NAME_VALUE),
]);

export const WorkspaceSync = t.boolean;
