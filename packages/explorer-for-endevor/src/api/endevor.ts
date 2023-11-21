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

import { logger } from '../globals';
import * as endevor from '@local/endevor/endevor';
import {
  ActionChangeControlValue,
  Dataset,
  Element,
  ElementData,
  ElementDataWithFingerprint,
  ElementMapPath,
  ElementTypeMapPath,
  EndevorResponse,
  EnvironmentStageMapPath,
  ErrorResponseType,
  GenerateSignOutParams,
  GenerateWithCopyBackParams,
  Member,
  MoveParams,
  SignOutParams,
  SubSystemMapPath,
} from '@local/endevor/_doc/Endevor';
import { formatWithNewLines } from '../utils';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorAuthorizedService,
  EndevorUnauthorizedService,
} from './_doc/Endevor';

export const getApiVersionAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  async (service: EndevorUnauthorizedService) => {
    const response = await endevor.getApiVersion(logger)(progress)(
      service.location
    )(service.rejectUnauthorized);
    logActivity('Fetching Endevor Web Services API version')(response);
    return response;
  };

export const getConfigurationsAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  async (service: EndevorUnauthorizedService) => {
    const response = await endevor.getConfigurations(logger)(progress)(
      service.location
    )(service.rejectUnauthorized);
    logActivity('Fetching configurations')(response);
    return response;
  };

export const getAuthenticationTokenAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  async (service: EndevorAuthorizedService) => {
    const response = await endevor.getAuthenticationToken(logger)(progress)(
      service
    )(service.configuration);
    logActivity('Authenticating to Endevor')(response);
    return response;
  };

export const validateCredentials =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  async (service: EndevorAuthorizedService): Promise<boolean | Error> => {
    const response = await endevor.getAuthenticationToken(logger)(progress)(
      service
    )(service.configuration);
    logActivity('Validating Endevor credentials')(response);
    if (isErrorEndevorResponse(response)) {
      const errorResponse = response;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to validate Endevor credentials because of error:${formatWithNewLines(
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

export const fetchElement =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: Element): Promise<ReadonlyArray<Element> | Error> => {
    const environmentStageMapPath: EnvironmentStageMapPath = {
      environment: element.environment,
      stageNumber: element.stageNumber,
    };
    const elementFetchResponse = await searchForElementsInPlaceAndLogActivity(
      logActivity
    )(progress)(service)(environmentStageMapPath)(
      element.system,
      element.subSystem,
      element.type,
      element.id
    );
    if (isErrorEndevorResponse(elementFetchResponse)) {
      const errorResponse = elementFetchResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to fetch element ${element.environment}/${
          element.stageNumber
        }/${element.system}/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.trace(`${error.message}.`);
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          error.name = `Endevor credentials are incorrect or expired.`;
          return error;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          error.name = `Unable to connect to Endevor Web Services.`;
          return error;
        case ErrorResponseType.GENERIC_ERROR: {
          error.name = `Unable to fetch element ${element.name}.`;
          return error;
        }
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    return elementFetchResponse.result;
  };

export const getAllEnvironmentStagesAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (environmentSearchParams?: Partial<EnvironmentStageMapPath>) => {
    const response = await endevor.getAllEnvironmentStages(logger)(progress)(
      service
    )(service.configuration)(environmentSearchParams);
    logActivity('Fetching environment stages')(response);
    return response;
  };
export const searchForSystemsFromEnvironmentStageAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentStageMap: EnvironmentStageMapPath) =>
  async (system?: string) => {
    const response = await endevor.searchForSystemsFromEnvironmentStage(logger)(
      progress
    )(service)(service.configuration)(environmentStageMap)(system);
    logActivity('Fetching systems')(response);
    return response;
  };
export const searchForSubSystemsFromEnvironmentStageAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentStageMap: EnvironmentStageMapPath) =>
  async (system?: string, subsystem?: string) => {
    const response = await endevor.searchForSubSystemsFromEnvironmentStage(
      logger
    )(progress)(service)(service.configuration)(environmentStageMap)(
      system,
      subsystem
    );
    logActivity('Fetching subsystems')(response);
    return response;
  };
export const searchForAllMembersFromDatasetAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (dataset: Dataset) => {
    const response = await endevor.getMembersFromDataset(logger)(progress)(
      service
    )(service.configuration)(dataset);
    logActivity(`Fetching members from dataset ${dataset.name}`)(response);
    return response;
  };
export const searchForAllElementsAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentStageMap: EnvironmentStageMapPath) =>
  async (
    system?: string,
    subsystem?: string,
    type?: string,
    element?: string
  ) => {
    const response = await endevor.searchForAllElements(logger)(progress)(
      service
    )(service.configuration)(environmentStageMap)(
      system,
      subsystem,
      type,
      element
    );
    logActivity('Fetching elements')(response);
    return response;
  };
export const searchForFirstFoundElementsAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentStageMap: EnvironmentStageMapPath) =>
  async (
    system?: string,
    subsystem?: string,
    type?: string,
    element?: string
  ) => {
    const response = await endevor.searchForFirstFoundElements(logger)(
      progress
    )(service)(service.configuration)(environmentStageMap)(
      system,
      subsystem,
      type,
      element
    );
    logActivity('Fetching elements')(response);
    return response;
  };
export const searchForElementsInPlaceAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentStageMap: EnvironmentStageMapPath) =>
  async (
    system?: string,
    subsystem?: string,
    type?: string,
    element?: string
  ) => {
    const response = await endevor.searchForElementsInPlace(logger)(progress)(
      service
    )(service.configuration)(environmentStageMap)(
      system,
      subsystem,
      type,
      element
    );
    logActivity('Fetching elements in place')(response);
    return response;
  };

export const moveElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (elementSearchParams: ElementMapPath) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (moveParams: MoveParams) => {
    const response = await endevor.moveElements(logger)(progress)(service)(
      service.configuration
    )(elementSearchParams)(actionChangeControlParams)(moveParams);
    logActivity('Moving element')(response);
    return response;
  };

export const generateElementInPlaceAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (elementSearchParams: ElementMapPath) =>
  (processorGroup: string | undefined) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (signOutParams?: GenerateSignOutParams) => {
    const response = await endevor.generateElementInPlace(logger)(progress)(
      service
    )(service.configuration)(elementSearchParams)(processorGroup)(
      actionChangeControlParams
    )(signOutParams);
    logActivity('Generating element in place')(response);
    return response;
  };
export const generateElementWithCopyBackAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (elementSearchParams: ElementMapPath) =>
  (processorGroup: string | undefined) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  (copyBackParams?: GenerateWithCopyBackParams) =>
  async (signOutParams?: GenerateSignOutParams) => {
    const response = await endevor.generateElementWithCopyBack(logger)(
      progress
    )(service)(service.configuration)(elementSearchParams)(processorGroup)(
      actionChangeControlParams
    )(copyBackParams)(signOutParams);
    logActivity('Generating element with copyback')(response);
    return response;
  };

export const generateSubsystemElementsInPlaceAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (subSystemSearchParams: SubSystemMapPath) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (signOutParams?: GenerateSignOutParams) => {
    const response = await endevor.generateSubSystemElementsInPlace(logger)(
      progress
    )(service)(service.configuration)(subSystemSearchParams)(
      actionChangeControlParams
    )(signOutParams);
    // TODO: make an action name generation more universal
    logActivity(
      `Generating elements in subsystem ${subSystemSearchParams.subSystem}`
    )(response);
    return response;
  };

export const printElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.printElement(logger)(progress)(service)(
      service.configuration
    )(element);
    logActivity('Printing element')(response);
    return response;
  };
export const printMemberAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (member: Member) => {
    const response = await endevor.printMember(logger)(progress)(service)(
      service.configuration
    )(member);
    logActivity(`Printing member ${member.name} from ${member.dataset.name}`)(
      response
    );
    return response;
  };
export const printListingAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.printListing(logger)(progress)(service)(
      service.configuration
    )(element);
    logActivity('Printing a listing for element')(response);
    return response;
  };

export const updateElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (element: ElementMapPath) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (elementData: ElementDataWithFingerprint) => {
    const response = await endevor.updateElement(logger)(progress)(service)(
      service.configuration
    )(element)(actionChangeControlParams)(elementData);
    logActivity('Updating element')(response);
    return response;
  };

export const retrieveElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.retrieveElementWithoutSignout(logger)(
      progress
    )(service)(service.configuration)(element);
    logActivity('Retrieving element')(response);
    return response;
  };
export const retrieveElementWithSignoutAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (element: ElementMapPath) =>
  async (signOutParams: SignOutParams) => {
    const response = await endevor.retrieveElementWithSignout(logger)(progress)(
      service
    )(service.configuration)(element)(signOutParams);
    logActivity('Retrieving element with signout')(response);
    return response;
  };
export const retrieveElementFirstFoundAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.retrieveElementFirstFound(logger)(progress)(
      service
    )(service.configuration)(element);
    logActivity('Retrieving first found elements')(response);
    return response;
  };

export const retrieveElementComponentsAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.retrieveElementComponents(logger)(progress)(
      service
    )(service.configuration)(element);
    logActivity('Fetching components for element')(response);
    return response;
  };

export const signOutElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (element: ElementMapPath) =>
  async (signOutParams: SignOutParams) => {
    const response = await endevor.signOutElement(logger)(progress)(service)(
      service.configuration
    )(element)(signOutParams);
    logActivity('Signing out element')(response);
    return response;
  };

export const signInElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (element: ElementMapPath) => {
    const response = await endevor.signInElement(logger)(progress)(service)(
      service.configuration
    )(element);
    logActivity('Signing in element')(response);
    return response;
  };

export const addElementAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (element: ElementMapPath) =>
  (processorGroup: string | undefined) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (elementData: ElementData) => {
    const response = await endevor.addElement(logger)(progress)(service)(
      service.configuration
    )(element)(processorGroup)(actionChangeControlParams)(elementData);
    logActivity('Adding element')(response);
    return response;
  };

export const getProcessorGroupsByTypeAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (service: EndevorAuthorizedService) =>
  (progress: ProgressReporter) =>
  (typeMapPath: Partial<ElementTypeMapPath>) =>
  async (procGroup?: string) => {
    const response = await endevor.searchForProcessorGroupsInPlace(logger)(
      progress
    )(service)(service.configuration)(typeMapPath, procGroup);
    logActivity('Fetching processor groups')(response);
    return response;
  };

export const searchForTypesInPlaceAndLogActivity =
  (
    logActivity: (
      actionName: string
    ) => <E extends ErrorResponseType | undefined, R>(
      response: EndevorResponse<E, R>
    ) => void
  ) =>
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  (environmentSearchParams: Partial<EnvironmentStageMapPath>) =>
  async (typeParams: { system?: string; type?: string }) => {
    const response = await endevor.searchForElementTypesInPlace(logger)(
      progress
    )(service)(service.configuration)(environmentSearchParams)(
      typeParams.system,
      typeParams.type
    );
    logActivity('Fetching type info')(response);
    return response;
  };

export const downloadReportById =
  (progress: ProgressReporter) =>
  (service: EndevorAuthorizedService) =>
  async (reportId: string): Promise<string | void> =>
    endevor.downloadReportById(logger)(progress)(service)(
      service.configuration
    )(reportId);
