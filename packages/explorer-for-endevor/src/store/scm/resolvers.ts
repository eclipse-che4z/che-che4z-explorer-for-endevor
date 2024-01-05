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

import {
  ExistingEndevorServiceDescriptions,
  State,
  ValidEndevorSearchLocationDescriptions,
} from '../_doc/v2/Store';
import { Id } from '../storage/_doc/Storage';
import {
  getDefaultLocationProfile,
  getDefaultServiceProfile,
  getLastUsedSearchLocation,
  getLastUsedService,
} from '../store';
import {
  askForService,
  dialogCancelled as serviceDialogCancelled,
} from '../../dialogs/locations/endevorServiceDialogs';
import {
  askForSearchLocation,
  dialogCancelled as locationDialogCancelled,
} from '../../dialogs/locations/endevorSearchLocationDialogs';
import { createEndevorLogger } from '../../logger';

export type SyncServiceLocation = {
  serviceId: Id;
  searchLocationId: Id;
};

export type GetCurrentSyncServiceLocation = () => Promise<
  SyncServiceLocation | undefined
>;
export const resolveCurrentSyncServiceLocation = async (
  serviceLocationGetter: ReadonlyArray<GetCurrentSyncServiceLocation>
): Promise<SyncServiceLocation | undefined> => {
  for (const getServiceLocation of serviceLocationGetter) {
    const serviceLocation = await getServiceLocation();
    if (serviceLocation) return serviceLocation;
  }
  return undefined;
};
export const defineCurrentSyncServiceLocationResolutionOrder = (
  getState: () => State,
  getValidServiceDescriptions: () => Promise<ExistingEndevorServiceDescriptions>,
  getValidSearchLocationDescriptions: () => ValidEndevorSearchLocationDescriptions
): ReadonlyArray<GetCurrentSyncServiceLocation> => {
  return [
    async () => {
      const lastUsedServiceId = getLastUsedService(getState)?.id;
      const lastUsedLocationId = getLastUsedSearchLocation(getState)?.id;
      if (lastUsedServiceId && lastUsedLocationId)
        return {
          serviceId: lastUsedServiceId,
          searchLocationId: lastUsedLocationId,
        };
      return;
    },
    async () => {
      const defaultServiceProfile = getDefaultServiceProfile(getState);
      const defaultLocationProfile = getDefaultLocationProfile(getState);
      if (defaultServiceProfile && defaultLocationProfile)
        return {
          serviceId: defaultServiceProfile.id,
          searchLocationId: defaultLocationProfile.id,
        };
      return;
    },
    async () => {
      const logger = createEndevorLogger();
      const serviceDialogResult = await askForService(
        await getValidServiceDescriptions(),
        getLastUsedService(getState)?.id,
        'Last Used'
      );
      if (serviceDialogCancelled(serviceDialogResult)) {
        logger.trace('No Endevor connection was selected.');
        return;
      }
      const serviceId = serviceDialogResult.id;
      logger.updateContext({ serviceId });
      const locationDialogResult = await askForSearchLocation(
        getValidSearchLocationDescriptions(),
        getLastUsedSearchLocation(getState)?.id,
        'Last Used'
      );
      if (locationDialogCancelled(locationDialogResult)) {
        logger.trace('No Endevor inventory location was selected.');
        return;
      }
      const searchLocationId = locationDialogResult.id;
      return { serviceId, searchLocationId };
    },
  ];
};
