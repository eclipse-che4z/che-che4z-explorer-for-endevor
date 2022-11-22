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

import { logger } from './globals';
import * as endevor from '@local/endevor/endevor';
import { ElementSearchLocation, Service } from '@local/endevor/_doc/Endevor';
import {
  EndevorConfiguration,
  EndevorId,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from './store/_doc/v2/Store';
import { EndevorClient } from './_doc/EndevorClient';
import { isError } from './utils';
import { Credential } from '@local/endevor/_doc/Credential';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { isWrongCredentialsError } from '@local/endevor/utils';

export const getApiVersion = endevor.getApiVersion(logger);
export const getConfigurations = endevor.getConfigurations(logger);
export const validateCredentials =
  (progress: ProgressReporter) =>
  (connectionDetails: Omit<Service, 'credential'>) =>
  (configuration: string) =>
  async (credential: Credential): Promise<boolean | Error> => {
    const result = await endevor.getAllEnvironmentStages(logger)(progress)({
      ...connectionDetails,
      credential,
    })(configuration)();
    if (isWrongCredentialsError(result)) return false;
    if (isError(result)) return result;
    return true;
  };
export const getAllEnvironmentStages = endevor.getAllEnvironmentStages(logger);
export const getAllSystems = endevor.getAllSystems(logger);
export const getAllSubSystems = endevor.getAllSubSystems(logger);
export const searchForAllElements = endevor.searchForAllElements(logger);
export const viewElement = endevor.viewElement(logger);
export const retrieveElement = endevor.retrieveElementWithoutSignout(logger);
export const generateElementInPlace = endevor.generateElementInPlace(logger);
export const generateElementWithCopyBack =
  endevor.generateElementWithCopyBack(logger);
export const retrieveElementWithDependenciesWithoutSignout =
  endevor.retrieveElementWithDependenciesWithoutSignout(logger);
export const retrieveElementWithDependenciesWithSignout =
  endevor.retrieveElementWithDependenciesWithSignout(logger);
export const retrieveElementWithFingerprint =
  endevor.retrieveElementWithFingerprint(logger);
export const printElement = endevor.printElement(logger);
export const printListing = endevor.printListing(logger);
export const updateElement = endevor.updateElement(logger);
export const retrieveElementWithoutSignout =
  endevor.retrieveElementWithoutSignout(logger);
export const retrieveElementWithSignout =
  endevor.retrieveElementWithSignout(logger);
export const signOutElement = endevor.signOutElement(logger);
export const signInElement = endevor.signInElement(logger);
export const addElement = endevor.addElement(logger);

const getServiceAndSearchLocation =
  (
    getConnectionDetails: (
      id: EndevorId
    ) => Promise<ValidEndevorConnection | undefined>,
    getEndevorConfiguration: (
      serviceId?: EndevorId,
      searchLocationId?: EndevorId
    ) => Promise<EndevorConfiguration | undefined>,
    getCredential: (
      connection: ValidEndevorConnection,
      configuration: EndevorConfiguration
    ) => (
      credentialId: EndevorId
    ) => Promise<ValidEndevorCredential | undefined>,
    getSearchLocation: (
      id: EndevorId
    ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>
  ) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<[Service, ElementSearchLocation] | Error> => {
    const connectionDetails = await getConnectionDetails(serviceId);
    if (!connectionDetails)
      return new Error(
        `Unable to resolve the Endevor connection ${serviceId.name}`
      );
    const configuration = await getEndevorConfiguration(
      serviceId,
      searchLocationId
    );
    if (!configuration)
      return new Error(
        `Unable to resolve the Endevor location ${searchLocationId.name}`
      );
    const credential = await getCredential(
      connectionDetails,
      configuration
    )(serviceId);
    if (!credential)
      return new Error(
        `Unable to resolve the Endevor credential ${serviceId.name}`
      );
    const searchLocation = await getSearchLocation(searchLocationId);
    if (!searchLocation)
      return new Error(
        `Unable to resolve the inventory location ${searchLocationId.name}`
      );
    return [
      {
        ...connectionDetails.value,
        credential: credential.value,
      },
      {
        configuration,
        ...searchLocation,
      },
    ];
  };

export const makeEndevorClient = (
  getConnectionDetails: (
    id: EndevorId
  ) => Promise<ValidEndevorConnection | undefined>,
  getEndevorConfiguration: (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ) => Promise<EndevorConfiguration | undefined>,
  getCredential: (
    connection: ValidEndevorConnection,
    configuration: EndevorConfiguration
  ) => (credentialId: EndevorId) => Promise<ValidEndevorCredential | undefined>,
  getSearchLocation: (
    id: EndevorId
  ) => Promise<Omit<ElementSearchLocation, 'configuration'> | undefined>
): EndevorClient => {
  return {
    getAllEnvironmentStages:
      (progress) => (serviceId) => async (searchLocationId) => {
        const result = await getServiceAndSearchLocation(
          getConnectionDetails,
          getEndevorConfiguration,
          getCredential,
          getSearchLocation
        )(serviceId, searchLocationId);
        if (isError(result)) return result;
        const [service, searchLocation] = result;
        return endevor.getAllEnvironmentStages(logger)(progress)(service)(
          searchLocation.configuration
        )();
      },
    getAllSystems: (progress) => (serviceId) => async (searchLocationId) => {
      const result = await getServiceAndSearchLocation(
        getConnectionDetails,
        getEndevorConfiguration,
        getCredential,
        getSearchLocation
      )(serviceId, searchLocationId);
      if (isError(result)) return result;
      const [service, searchLocation] = result;
      return endevor.getAllSystems(logger)(progress)(service)(
        searchLocation.configuration
      )();
    },
    getAllSubSystems: (progress) => (serviceId) => async (searchLocationId) => {
      const result = await getServiceAndSearchLocation(
        getConnectionDetails,
        getEndevorConfiguration,
        getCredential,
        getSearchLocation
      )(serviceId, searchLocationId);
      if (isError(result)) return result;
      const [service, searchLocation] = result;
      return endevor.getAllSubSystems(logger)(progress)(service)(
        searchLocation.configuration
      )();
    },
    searchForAllElements:
      (progress) => (serviceId) => async (searchLocationId) => {
        const result = await getServiceAndSearchLocation(
          getConnectionDetails,
          getEndevorConfiguration,
          getCredential,
          getSearchLocation
        )(serviceId, searchLocationId);
        if (isError(result)) return result;
        const [service, searchLocation] = result;
        return endevor.searchForAllElements(logger)(progress)(service)(
          searchLocation
        );
      },
  };
};
