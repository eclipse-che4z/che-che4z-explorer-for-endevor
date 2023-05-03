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

import { logger } from './globals';
import * as endevor from '@local/endevor/endevor';
import { ErrorResponseType, Service } from '@local/endevor/_doc/Endevor';
import { formatWithNewLines } from './utils';
import { Credential } from '@local/endevor/_doc/Credential';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';

export const getApiVersion = endevor.getApiVersion(logger);
export const getConfigurations = endevor.getConfigurations(logger);
export const getAuthenticationToken = endevor.getAuthenticationToken(logger);
export const validateCredentials =
  (progress: ProgressReporter) =>
  (connectionDetails: Omit<Service, 'credential'>) =>
  (configuration: string) =>
  async (credential: Credential): Promise<boolean | Error> => {
    const response = await endevor.getAllEnvironmentStages(logger)(progress)({
      ...connectionDetails,
      credential,
    })(configuration)();
    if (isErrorEndevorResponse(response)) {
      const errorResponse = response;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to validate Endevor credentials because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          return false;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
        case ErrorResponseType.GENERIC_ERROR:
          return error;
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
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
export const generateElementInPlace = endevor.generateElementInPlace(logger);
export const generateSubsystemElementsInPlace =
  endevor.generateSubSystemElementsInPlace(logger);
export const generateElementWithCopyBack =
  endevor.generateElementWithCopyBack(logger);
export const retrieveElementComponents =
  endevor.retrieveElementComponents(logger);
export const retrieveElementFirstFound =
  endevor.retrieveElementFirstFound(logger);
export const printElement = endevor.printElement(logger);
export const printListing = endevor.printListing(logger);
export const printHistory = endevor.printHistory(logger);
export const updateElement = endevor.updateElement(logger);
export const retrieveElement = endevor.retrieveElementWithoutSignout(logger);
export const retrieveElementWithSignout =
  endevor.retrieveElementWithSignout(logger);
export const signOutElement = endevor.signOutElement(logger);
export const signInElement = endevor.signInElement(logger);
export const addElement = endevor.addElement(logger);
export const downloadReportById = endevor.downloadReportById(logger);
