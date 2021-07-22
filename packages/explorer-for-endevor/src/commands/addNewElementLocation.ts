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

import {
  askForElementLocationOrCreateNew,
  dialogCancelled,
  locationChosen,
} from '../dialogs/locations/endevorElementLocationDialogs';
import { logger } from '../globals';
import { addElementLocation, getLocations } from '../settings/settings';
import { getInstanceNames } from '../endevor';
import { ServiceNode } from '../_doc/ElementTree';
import { getEndevorServiceByName } from '../services/services';
import {
  createEndevorElementLocation,
  getElementLocationNames,
} from '../element-locations/elementLocations';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { Credential } from '@local/endevor/_doc/Credential';
import { Action } from '../_doc/Actions';
import { resolveCredential } from '../credentials/credentials';
import { isError } from '@local/profiles/utils';

export const addNewElementLocation = (
  getCredentialFromStore: (name: string) => Credential | undefined,
  dispatch: (action: Action) => void
) => async ({ name: serviceName }: ServiceNode): Promise<void> => {
  logger.trace('Add a New Location Profile was called.');
  const service = await getEndevorServiceByName(
    serviceName,
    resolveCredential(serviceName, getCredentialFromStore, dispatch)
  );
  if (!service) {
    return;
  }
  const allLocations = await getElementLocationNames();
  if (isError(allLocations)) {
    const error = allLocations;
    logger.error(
      `Failed to fetch existing element locations because of: ${error.message}`
    );
    return;
  }
  const alreadyAddedElementLocations = getLocations()
    .filter((location) => location.service === serviceName)
    .flatMap((location) => location.elementLocations);
  const unusedLocations = await filterForUnusedLocations(
    allLocations,
    alreadyAddedElementLocations
  );
  const dialogResult = await askForElementLocationOrCreateNew({
    unusedLocations,
    allLocations,
  })(() =>
    withNotificationProgress('Fetching instances')((progressReporter) =>
      getInstanceNames(progressReporter)(service.location)(
        service.rejectUnauthorized
      )
    )
  );
  if (dialogCancelled(dialogResult)) {
    logger.trace('No location profile was selected or newly created.');
    return;
  } else {
    let locationName;
    if (locationChosen(dialogResult)) {
      locationName = dialogResult;
    } else {
      const createdLocation = dialogResult;
      locationName = createdLocation.name;
      try {
        await createEndevorElementLocation(locationName, createdLocation.value);
      } catch (error) {
        logger.error(
          `Something went wrong with location profile: ${locationName} saving`,
          error.message
        );
        return;
      }
    }
    return addElementLocation(locationName, serviceName);
  }
};

const filterForUnusedLocations = async (
  allLocations: ReadonlyArray<string>,
  alreadyAddedLocations: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> => {
  return allLocations.filter(
    (location) => !alreadyAddedLocations.includes(location)
  );
};
