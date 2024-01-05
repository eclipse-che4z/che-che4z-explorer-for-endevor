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

import { EndevorServiceName } from '../settings/_doc/Settings';
import { Action } from '../store/_doc/Actions';
import {
  EndevorId,
  EndevorLocationName,
  EndevorServiceDescriptions,
  ExistingEndevorServiceDescriptions,
  ValidEndevorConnection,
  ValidEndevorSearchLocationDescriptions,
} from '../store/_doc/v2/Store';
import { addNewSearchLocation } from './location/addNewSearchLocation';
import { addNewServiceCommand } from './service/addNewService';

export const addServiceAndLocationCommand = async (
  dispatch: (action: Action) => Promise<void>,
  serviceConfigurations: {
    getAllServiceNames: () => ReadonlyArray<EndevorServiceName>;
    getValidServiceDescriptions: () => Promise<ExistingEndevorServiceDescriptions>;
  },
  configurations: {
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<ValidEndevorConnection | undefined>;
    getServiceDescriptionsBySearchLocationId: (
      searchLocationId: EndevorId
    ) => Promise<EndevorServiceDescriptions>;
    getSearchLocationNames: () => ReadonlyArray<EndevorLocationName>;
    getValidSearchLocationDescriptionsForService: (
      serviceId: EndevorId
    ) => ValidEndevorSearchLocationDescriptions;
    getValidUsedServiceDescriptions: () => Promise<ExistingEndevorServiceDescriptions>;
  }
) => {
  const serviceId = await addNewServiceCommand(dispatch, serviceConfigurations);
  if (serviceId) {
    await addNewSearchLocation(dispatch, configurations)(serviceId);
  }
};
