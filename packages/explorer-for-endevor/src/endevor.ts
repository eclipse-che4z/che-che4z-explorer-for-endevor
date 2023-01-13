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
import { Service } from '@local/endevor/_doc/Endevor';
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
export const searchForSystemsInPlace = endevor.searchForSystemsInPlace(logger);
export const searchForSystemsFromEnvironmentStage =
  endevor.searchForSystemsFromEnvironmentStage(logger);
export const searchForSubSystemsInPlace =
  endevor.searchForSubSystemsInPlace(logger);
export const searchForSubSystemsFromEnvironmentStage =
  endevor.searchForSubSystemsFromEnvironmentStage(logger);
export const searchForAllElements = endevor.searchForAllElements(logger);
export const searchForElementsInPlace =
  endevor.searchForElementsInPlace(logger);
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
