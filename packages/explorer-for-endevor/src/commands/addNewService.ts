/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import { isError } from '@local/profiles/utils';
import {
  askForServiceOrCreateNew,
  dialogCancelled,
  serviceChosen,
} from '../dialogs/locations/endevorServiceDialogs';
import { logger } from '../globals';
import {
  createEndevorService,
  getEndevorServiceNames,
} from '../services/services';
import {
  addService,
  getLocations as getUsedEndevorServices,
} from '../settings/settings';

export const addNewService = async (): Promise<void> => {
  logger.trace('Add a New Profile called.');
  const allServices = await getEndevorServiceNames();
  if (isError(allServices)) {
    const error = allServices;
    logger.error(
      `Failed to fetch existing services because of: ${error.message}`
    );
    return;
  }
  const dialogResult = await askForServiceOrCreateNew({
    hiddenServices: filterForUnusedServices(allServices),
    allServices,
  });
  if (dialogCancelled(dialogResult)) {
    logger.trace('No profile was selected or newly created.');
    return;
  } else {
    let serviceName;
    if (serviceChosen(dialogResult)) {
      serviceName = dialogResult;
    } else {
      const createdService = dialogResult;
      serviceName = createdService.name;
      try {
        await createEndevorService(serviceName, createdService.value);
      } catch (err) {
        logger.error(
          `Something went wrong with profile: ${serviceName} saving`,
          err.message
        );
        return;
      }
    }
    return addService(serviceName);
  }
};

const filterForUnusedServices = (
  allServices: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const usedServices = getUsedEndevorServices().map(
    (usedService) => usedService.service
  );
  return allServices.filter(
    (service) => !usedServices.find((usedService) => usedService === service)
  );
};
