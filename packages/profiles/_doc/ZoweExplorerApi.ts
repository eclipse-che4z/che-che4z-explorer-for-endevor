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

export type ZoweExplorerExtenderApi = {
  getProfilesCache: () => {
    getProfiles: (profileType?: string) => ReadonlyArray<unknown> | undefined;
    getDefaultProfile: (profileType?: string) => unknown | undefined;
    registerCustomProfilesType: (profileType: string) => void;
  };
  initForZowe: (
    profileType: string,
    profileTypeConfigurations?: ReadonlyArray<unknown>
  ) => Promise<void>;
  reloadProfiles: (profileType?: string) => Promise<void>;
};

export type ZoweExplorerApi = {
  getExplorerExtenderApi: () => ZoweExplorerExtenderApi | undefined;
};
