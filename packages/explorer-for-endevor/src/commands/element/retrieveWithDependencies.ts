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

import { reporter } from '../../globals';
import {
  filterElementNodes,
  isDefined,
  isError,
  getElementExtension,
  parseFilePath,
  formatWithNewLines,
  isUnique,
} from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import * as vscode from 'vscode';
import {
  createNewWorkspaceDirectory,
  getWorkspaceUri,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import {
  showFileContent,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import {
  fromEndevorMapPath,
  isErrorEndevorResponse,
  toSearchPath,
  toSeveralTasksProgress,
} from '@local/endevor/utils';
import {
  isAutomaticSignOut,
  getMaxParallelRequests,
  getFileExtensionResolution,
} from '../../settings/settings';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../../dialogs/change-control/endevorChangeControlDialogs';
import {
  retrieveElementComponentsAndLogActivity,
  retrieveElementAndLogActivity,
  retrieveElementWithSignoutAndLogActivity,
  searchForElementsInPlaceAndLogActivity,
} from '../../api/endevor';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import {
  Element,
  ActionChangeControlValue,
  Dependency,
  ElementContent,
  ErrorResponseType,
  RetrieveElementWithSignoutResponse,
  RetrieveElementWithoutSignoutResponse,
  Component,
} from '@local/endevor/_doc/Endevor';
import {
  Action,
  Actions,
  SignedOutElementsPayload,
} from '../../store/_doc/Actions';
import {
  DependencyRetrievalCompletedStatus,
  RetrieveElementWithDepsCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import path = require('path');
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { ProgressReporter } from '@local/vscode-wrapper/_doc/window';
import { Content } from '@local/endevor/_ext/Endevor';
import { groupBySearchLocationId } from '../utils';
import { RETRIEVE_PROGRESS_PARTS_NUM } from '../../constants';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { EndevorId } from '../../store/_doc/v2/Store';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveWithDependencies =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async (elementNode?: SelectedElementNode, nodes?: SelectedMultipleNodes) => {
    const logger = createEndevorLogger();
    if (nodes && nodes.length) {
      const elementNodes = filterElementNodes(nodes);
      logger.trace(
        `Retrieve element command was called for ${elementNodes
          .map((node) => {
            const element = node.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${node.name}`;
          })
          .join(',\n')}.`
      );

      if (isAutomaticSignOut()) {
        const groupedElementNodes = groupBySearchLocationId(elementNodes);
        for (const elementNodesGroup of Object.values(groupedElementNodes)) {
          await retrieveMultipleElementsWithDepsWithSignout(
            dispatch,
            getConnectionConfiguration
          )(elementNodesGroup);
        }
        return;
      }
      await retrieveMultipleElementsWithDeps(
        dispatch,
        getConnectionConfiguration
      )(elementNodes);
      return;
    } else if (elementNode) {
      logger.updateContext({
        serviceId: elementNode.serviceId,
        searchLocationId: elementNode.searchLocationId,
      });
      logger.traceWithDetails(
        `Retrieve element command was called for ${elementNode.element.environment}/${elementNode.element.stageNumber}/${elementNode.element.system}/${elementNode.element.subSystem}/${elementNode.element.type}/${elementNode.name}.`
      );
      if (isAutomaticSignOut()) {
        await retrieveSingleElementWithDepsWithSignout(
          dispatch,
          getConnectionConfiguration
        )(elementNode);
        return;
      }
      await retrieveSingleElementWithDeps(
        dispatch,
        getConnectionConfiguration
      )(elementNode);
      return;
    } else {
      return;
    }
  };

const retrieveSingleElementWithDepsWithSignout =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out element ${name}.`,
        'Retrieve element with dependencies command cancelled.'
      );
      return;
    }
    await withNotificationProgress(
      `Retrieving element ${name} with dependencies`
    )(async (progressReporter) => {
      const multiTaskProgressReporter = toSeveralTasksProgress(
        progressReporter
      )(RETRIEVE_PROGRESS_PARTS_NUM + 1);
      let retrieveMainElementResponse = await complexRetrieve(dispatch)(
        multiTaskProgressReporter
      )(
        serviceId,
        searchLocationId
      )(service)(element)(signoutChangeControlValue);
      if (isErrorEndevorResponse(retrieveMainElementResponse)) {
        const mainElementErrorResponse = retrieveMainElementResponse;
        // TODO: format using all possible error details
        const mainElementError = new Error(
          `Unable to retrieve element with sign out with dependencies ${
            element.environment
          }/${element.stageNumber}/${element.system}/${element.subSystem}/${
            element.type
          }/${element.name} because of error:${formatWithNewLines(
            mainElementErrorResponse.details.messages
          )}`
        );
        switch (mainElementErrorResponse.type) {
          case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
            retrieveMainElementResponse = await retrieveSingleElementCopy(
              dispatch
            )(multiTaskProgressReporter)(
              serviceId,
              searchLocationId
            )(service)(element);
            if (isErrorEndevorResponse(retrieveMainElementResponse)) {
              const mainElementCopyErrorResponse = retrieveMainElementResponse;
              const mainElementCopyError = new Error(
                `Unable to retrieve copy of element ${element.environment}/${
                  element.stageNumber
                }/${element.system}/${element.subSystem}/${element.type}/${
                  element.name
                } because of error:${formatWithNewLines(
                  mainElementCopyErrorResponse.details.messages
                )}`
              );
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
                status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
                error: mainElementCopyError,
              });
              logger.errorWithDetails(
                `Unable to retrieve a copy of element ${element.name}.`,
                `${mainElementCopyError.message}.`
              );
              return;
            }
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
              context:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
            });
            break;
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.errorWithDetails(
              'Endevor credentials are incorrect or expired.',
              `${mainElementError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.errorWithDetails(
              'Unable to connect to Endevor Web Services.',
              `${mainElementError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            logger.errorWithDetails(
              `Unable to retrieve element with sign out ${element.name}.`,
              `${mainElementError.message}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          default:
            throw new UnreachableCaseError(mainElementErrorResponse.type);
        }
      }
      const componentsResponse = await retrieveSingleElementComponents(
        dispatch
      )(multiTaskProgressReporter)(
        serviceId,
        searchLocationId
      )(service)(element);
      if (isErrorEndevorResponse(componentsResponse)) {
        const componentsErrorResponse = componentsResponse;
        // TODO: format using all possible error details
        const componentsError = new Error(
          `Unable to retrieve components for element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${
            element.type
          }/${name} because of error:${formatWithNewLines(
            componentsErrorResponse.details.messages
          )}`
        );
        switch (componentsErrorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.errorWithDetails(
              'Endevor credentials are incorrect or expired.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.errorWithDetails(
              'Unable to connect to Endevor Web Services.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            // TODO: think about a better way to log dep errors
            // logger.error(
            //   `Unable to retrieve dependencies for element ${name}.`,
            //   `${componentsError.message}.`
            // );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            break;
          default:
            throw new UnreachableCaseError(componentsErrorResponse.type);
        }
      }
      const dependencies = isErrorEndevorResponse(componentsResponse)
        ? []
        : await retrieveDependenciesInfo(dispatch)(multiTaskProgressReporter)(
            serviceId,
            searchLocationId
          )(
            service,
            endevorMaxRequestsNumber
          )(componentsResponse.result);
      const dependencyWithContentResponses =
        await retrieveMultipleElementCopies(dispatch)(
          multiTaskProgressReporter
        )(
          dependencies
            .map(([, dependency]) => {
              if (isError(dependency)) return;
              return {
                serviceId,
                searchLocationId,
                element: dependency,
                service,
                endevorMaxRequestsNumber,
                searchLocation,
              };
            })
            .filter(isDefined)
        );
      const dependencyErrors = dependencies
        .map(([, result]) => {
          if (isError(result)) return result;
          return undefined;
        })
        .filter(isDefined);
      dependencyWithContentResponses.map(([, retrieveResponse]) => {
        if (isErrorEndevorResponse(retrieveResponse)) {
          const errorResponse = retrieveResponse;
          // TODO: format using all possible error details
          // TODO add more dependency info (name, type, etc.) to the error message
          const error = new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${
              element.type
            }/${name} dependency content because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          dependencyErrors.push(error);
        }
      });
      if (dependencyErrors.length) {
        logger.warnWithDetails(
          `There were some issues during retrieving of element ${name} dependencies.`,
          `There were some issues during retrieving of element ${
            element.environment
          }/${element.stageNumber}/${element.system}/${element.subSystem}/${
            element.type
          }/${name} dependencies:${[
            '',
            dependencyErrors.map((error) => error.message),
          ].join('\n')}.`
        );
        dependencyErrors.forEach((error) => {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
            status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
            error,
          });
        });
      }
      const successfulDependencies = dependencyWithContentResponses
        .map((dependency) => {
          if (isError(dependency)) return;
          const [element, retrieveResponse] = dependency;
          if (isErrorEndevorResponse(retrieveResponse)) return;
          const elementsWithContent: [Element, string] = [
            element.element,
            retrieveResponse.result.content,
          ];
          return elementsWithContent;
        })
        .filter(isDefined);
      const saveResult = await saveIntoWorkspaceWithDependencies(logger)(
        workspaceUri
      )(
        serviceId.name,
        searchLocationId.name
      )({
        mainElement: {
          element,
          content: retrieveMainElementResponse.result.content,
        },
        dependencies: successfulDependencies,
      });
      if (isError(saveResult)) {
        const error = saveResult;
        logger.errorWithDetails(
          `Unable to save element ${name} into the file system.`,
          `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} into the file system because of error:\n${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      }
      const savedElementUri = saveResult;
      const showResult = await showElementInEditor(savedElementUri);
      if (isError(showResult)) {
        const error = showResult;
        logger.errorWithDetails(
          `Unable to open element ${name} for editing.`,
          `Unable to open element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} for editing because of error:\n${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status: RetrieveElementWithDepsCommandCompletedStatus.SUCCESS,
        dependenciesAmount: successfulDependencies.length,
      });
    });
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      dispatch
    )(progressReporter)(
      serviceId,
      searchLocationId
    )(service)(element)(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveWithSignoutResponse)) {
      const errorResponse = retrieveWithSignoutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
          );
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen`);
            progressReporter.report({
              increment: 100,
              message: progressReporter.message,
            });
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithOverrideSignout(dispatch)(
              progressReporter
            )(
              serviceId,
              searchLocationId
            )(service)(element)(signoutChangeControlValue);
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return retrieveWithOverrideSignoutResponse;
        }
        default:
          progressReporter.report({
            increment: 100,
            message: progressReporter.message,
          });
          return errorResponse;
      }
    }
    progressReporter.report({
      increment: 100,
      message: progressReporter.message,
    });
    await updateTreeAfterSuccessfulSignout(dispatch)({
      serviceId,
      searchLocationId,
      elements: [element],
    });
    return retrieveWithSignoutResponse;
  };

const retrieveSingleElementWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    progressReporter.message = 'Retrieving with signout ...';
    return retrieveElementWithSignoutAndLogActivity(
      setLogActivityContext(dispatch, {
        serviceId,
        searchLocationId,
        element,
      })
    )(progressReporter)(service)(element)({
      signoutChangeControlValue,
    });
  };

const retrieveSingleElementWithOverrideSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    progressReporter.message = 'Retrieving with override signout ...';
    return retrieveElementWithSignoutAndLogActivity(
      setLogActivityContext(dispatch, {
        serviceId,
        searchLocationId,
        element,
      })
    )(progressReporter)(service)(element)({
      signoutChangeControlValue,
      overrideSignOut: true,
    });
  };

const retrieveSingleElementCopy =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) => {
    progressReporter.message = `Retrieving element ${element.name} ...`;
    return retrieveElementAndLogActivity(
      setLogActivityContext(dispatch, {
        serviceId,
        searchLocationId,
        element,
      })
    )(progressReporter)(service)(element);
  };

const retrieveSingleElementComponents =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) => {
    progressReporter.message = `Getting list of components for ${element.name} ...`;
    return retrieveElementComponentsAndLogActivity(
      setLogActivityContext(dispatch, {
        serviceId,
        searchLocationId,
        element,
      })
    )(progressReporter)(service)(element);
  };

const saveIntoWorkspaceWithDependencies =
  (logger: EndevorLogger) =>
  (workspaceUri: vscode.Uri) =>
  (serviceName: string, locationName: string) =>
  async (elementWithDeps: {
    mainElement: {
      element: Element;
      content: ElementContent;
    };
    dependencies: ReadonlyArray<[Dependency, ElementContent]>;
  }): Promise<vscode.Uri | Error> => {
    const saveMainElementResult = await saveIntoWorkspace(workspaceUri)(
      serviceName,
      locationName
    )(elementWithDeps.mainElement.element, elementWithDeps.mainElement.content);
    if (isError(saveMainElementResult)) {
      const error = saveMainElementResult;
      return error;
    }
    const dependenciesSaveResult = await Promise.all(
      elementWithDeps.dependencies.map((dependentElement) => {
        const [element, content] = dependentElement;
        return saveIntoWorkspace(workspaceUri)(serviceName, locationName)(
          element,
          content
        );
      })
    );
    const errors = dependenciesSaveResult
      .map((value) => {
        if (isError(value)) return value;
        return undefined;
      })
      .filter(isDefined);
    if (errors.length) {
      const mainElement = elementWithDeps.mainElement.element;
      logger.warn(
        `There were some issues during saving of element ${elementWithDeps.mainElement.element.name} dependencies.`,
        `There were some issues during saving of element ${
          mainElement.environment
        }/${mainElement.stageNumber}/${mainElement.system}/${
          mainElement.subSystem
        }/${mainElement.type}/${mainElement.name} dependencies:${[
          '',
          errors.map((error) => error.message),
        ].join('\n')}.`
      );
    }
    return saveMainElementResult;
  };

const retrieveSingleElementWithDeps =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    await withNotificationProgress(
      `Retrieving element ${name} with dependencies`
    )(async (progressReporter) => {
      const multiTaskProgressReporter = toSeveralTasksProgress(
        progressReporter
      )(RETRIEVE_PROGRESS_PARTS_NUM);
      const retrieveMainElementResponse = await retrieveSingleElementCopy(
        dispatch
      )(multiTaskProgressReporter)(
        serviceId,
        searchLocationId
      )(service)(element);
      if (isErrorEndevorResponse(retrieveMainElementResponse)) {
        const mainElementErrorResponse = retrieveMainElementResponse;
        // TODO: format using all possible error details
        const mainElementError = new Error(
          `Unable to retrieve element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${
            element.type
          }/${name} because of error:${formatWithNewLines(
            mainElementErrorResponse.details.messages
          )}`
        );
        switch (mainElementErrorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.errorWithDetails(
              'Endevor credentials are incorrect or expired.',
              `${mainElementError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.errorWithDetails(
              'Unable to connect to Endevor Web Services.',
              `${mainElementError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            logger.errorWithDetails(
              `Unable to retrieve element ${name}.`,
              `${mainElementError.message}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementError,
            });
            return;
          default:
            throw new UnreachableCaseError(mainElementErrorResponse.type);
        }
      }
      const componentsResponse = await retrieveSingleElementComponents(
        dispatch
      )(multiTaskProgressReporter)(
        serviceId,
        searchLocationId
      )(service)(element);
      if (isErrorEndevorResponse(componentsResponse)) {
        const componentsErrorResponse = componentsResponse;
        // TODO: format using all possible error details
        const componentsError = new Error(
          `Unable to retrieve components for element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${element.type}/${
            element.name
          } because of error:${formatWithNewLines(
            componentsErrorResponse.details.messages
          )}`
        );
        switch (componentsErrorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.errorWithDetails(
              'Endevor credentials are incorrect or expired.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.errorWithDetails(
              'Unable to connect to Endevor Web Services.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.GENERIC_ERROR:
            // TODO: think about a better way to log dep errors
            // logger.error(
            //   `Unable to retrieve dependencies for element ${name}.`,
            //   `${componentsError.message}.`
            // );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            break;
          default:
            throw new UnreachableCaseError(componentsErrorResponse.type);
        }
      }
      const dependencies = isErrorEndevorResponse(componentsResponse)
        ? []
        : await retrieveDependenciesInfo(dispatch)(multiTaskProgressReporter)(
            serviceId,
            searchLocationId
          )(
            service,
            getMaxParallelRequests()
          )(componentsResponse.result);
      const dependencyWithContentResponses =
        await retrieveMultipleElementCopies(dispatch)(
          multiTaskProgressReporter
        )(
          dependencies
            .map(([, dependency]) => {
              if (isError(dependency)) return;
              return {
                serviceId,
                searchLocationId,
                element: dependency,
                service,
                searchLocation,
              };
            })
            .filter(isDefined)
        );
      const dependencyErrors = dependencies
        .map(([, result]) => {
          if (isError(result)) return result;
          return undefined;
        })
        .filter(isDefined);
      dependencyWithContentResponses.map(([, retrieveResponse]) => {
        if (isErrorEndevorResponse(retrieveResponse)) {
          const errorResponse = retrieveResponse;
          // TODO: format using all possible error details
          // TODO add more dependency info (name, type, etc.) to the error message
          const error = new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } dependency content because of error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          dependencyErrors.push(error);
        }
      });
      if (dependencyErrors.length) {
        logger.warnWithDetails(
          `There were some issues during retrieving of element ${name} dependencies.`,
          `There were some issues during retrieving of element ${
            element.environment
          }/${element.stageNumber}/${element.system}/${element.subSystem}/${
            element.type
          }/${element.name} dependencies:${[
            '',
            dependencyErrors.map((error) => error.message),
          ].join('\n')}.`
        );
        dependencyErrors.forEach((error) => {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
            status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
            error,
          });
        });
      }
      const successfulDependencies = dependencyWithContentResponses
        .map((dependency) => {
          if (isError(dependency)) return;
          const [element, retrieveResponse] = dependency;
          if (isErrorEndevorResponse(retrieveResponse)) return;
          const elementsWithContent: [Element, string] = [
            element.element,
            retrieveResponse.result.content,
          ];
          return elementsWithContent;
        })
        .filter(isDefined);
      const saveResult = await saveIntoWorkspaceWithDependencies(logger)(
        workspaceUri
      )(
        serviceId.name,
        searchLocationId.name
      )({
        mainElement: {
          element,
          content: retrieveMainElementResponse.result.content,
        },
        dependencies: successfulDependencies,
      });
      if (isError(saveResult)) {
        const error = saveResult;
        logger.errorWithDetails(
          `Unable to save element ${name} into the file system.`,
          `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} into the file system because of an error:\n${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      }
      const savedElementUri = saveResult;
      const showResult = await showElementInEditor(savedElementUri);
      if (isError(showResult)) {
        const error = showResult;
        logger.errorWithDetails(
          `Unable to open element ${name} for editing.`,
          `Unable to open element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} for editing because of an error:\n${error.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return;
      }
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status: RetrieveElementWithDepsCommandCompletedStatus.SUCCESS,
        dependenciesAmount: successfulDependencies.length,
      });
    });
  };

const retrieveMultipleElementsWithDeps =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    const logger = createEndevorLogger();
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { name, serviceId, searchLocationId, element } = elementNode;
      const connectionParams = await getConnectionConfiguration(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service } = connectionParams;
      elementDetails.push({
        element,
        service,
        serviceId,
        searchLocationId,
      });
    }
    const validElementDetails = elementDetails
      .map((element) => {
        if (isError(element)) {
          return undefined;
        }
        return element;
      })
      .filter(isDefined);
    await withNotificationProgress(
      `Retrieving elements ${elementNodes
        .map((node) => node.name)
        .join(', ')} with dependencies`
    )(async (progressReporter) => {
      const multiTaskProgressReporter = toSeveralTasksProgress(
        progressReporter
      )(
        RETRIEVE_PROGRESS_PARTS_NUM * elementNodes.length - elementNodes.length
      );
      const mainElementRetrieveResponses: ReadonlyArray<
        [ElementDetails, RetrieveElementWithoutSignoutResponse]
      > = await retrieveMultipleElementCopies(dispatch)(
        multiTaskProgressReporter
      )(validElementDetails.map((element) => element));
      const errors: Array<[ElementDetails, Error]> = [];
      const successfulResults = mainElementRetrieveResponses
        .map(([elementDetails, mainElementRetrieveResponse]) => {
          const mainElementRetrieved = !isErrorEndevorResponse(
            mainElementRetrieveResponse
          );
          if (mainElementRetrieved) {
            const successRetrieve: [ElementDetails, Content] = [
              elementDetails,
              mainElementRetrieveResponse.result.content,
            ];
            return successRetrieve;
          }
          const mainElementErrorResponse = mainElementRetrieveResponse;
          const element = elementDetails.element;
          // TODO: format using all possible error details
          const mainElementError = new Error(
            `Unable to retrieve element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } because of aerror:${formatWithNewLines(
              mainElementErrorResponse.details.messages
            )}`
          );
          switch (mainElementErrorResponse.type) {
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
              errors.push([elementDetails, mainElementError]);
              // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
              return;
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              errors.push([elementDetails, mainElementError]);
              // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
              return;
            case ErrorResponseType.GENERIC_ERROR:
              errors.push([elementDetails, mainElementError]);
              return;
            default:
              throw new UnreachableCaseError(mainElementErrorResponse.type);
          }
        })
        .filter(isDefined);
      const elementsWithDeps: {
        mainElement: {
          details: ElementDetails;
          content: string;
        };
        dependencies: [Element, string][];
      }[] = [];
      for (const [elementDetails, retrieveResult] of successfulResults) {
        logger.updateContext({
          serviceId: elementDetails.serviceId,
          searchLocationId: elementDetails.searchLocationId,
        });
        const componentsResponse = await retrieveSingleElementComponents(
          dispatch
        )(multiTaskProgressReporter)(
          elementDetails.serviceId,
          elementDetails.searchLocationId
        )(elementDetails.service)(elementDetails.element);
        if (isErrorEndevorResponse(componentsResponse)) {
          const componentsErrorResponse = componentsResponse;
          const element = elementDetails.element;
          // TODO: format using all possible error details
          const componentsError = new Error(
            `Unable to retrieve components for element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } because of error:${formatWithNewLines(
              componentsErrorResponse.details.messages
            )}`
          );
          switch (componentsErrorResponse.type) {
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
              logger.errorWithDetails(
                'Endevor credentials are incorrect or expired.',
                `${componentsError.message}.`
              );
              // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              return;
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              logger.errorWithDetails(
                'Unable to connect to Endevor Web Services.',
                `${componentsError.message}.`
              );
              // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              return;
            case ErrorResponseType.GENERIC_ERROR:
              // TODO: think about a better way to log dep errors
              // logger.error(
              //   `Unable to retrieve dependencies for element ${elementDetails.element.name}.`,
              //   `${componentsError.message}.`
              // );
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              break;
            default:
              throw new UnreachableCaseError(componentsErrorResponse.type);
          }
        }
        const dependencies = isErrorEndevorResponse(componentsResponse)
          ? []
          : await retrieveDependenciesInfo(dispatch)(multiTaskProgressReporter)(
              elementDetails.serviceId,
              elementDetails.searchLocationId
            )(
              elementDetails.service,
              getMaxParallelRequests()
            )(componentsResponse.result);
        const dependencyWithContentResponses =
          await retrieveMultipleElementCopies(dispatch)(
            multiTaskProgressReporter
          )(
            dependencies
              .map(([, dependency]) => {
                if (isError(dependency)) return;
                return {
                  serviceId: elementDetails.serviceId,
                  searchLocationId: elementDetails.searchLocationId,
                  element: dependency,
                  service: elementDetails.service,
                };
              })
              .filter(isDefined)
          );
        const dependencyErrors = dependencies
          .map(([, result]) => {
            if (isError(result)) return result;
            return undefined;
          })
          .filter(isDefined);
        dependencyWithContentResponses.map(([, retrieveResponse]) => {
          if (isErrorEndevorResponse(retrieveResponse)) {
            const errorResponse = retrieveResponse;
            const element = elementDetails.element;
            // TODO: format using all possible error details
            // TODO add more dependency info (name, type, etc.) to the error message
            const error = new Error(
              `Unable to retrieve element ${element.environment}/${
                element.stageNumber
              }/${element.system}/${element.subSystem}/${element.type}/${
                element.name
              } dependency content because of error:${formatWithNewLines(
                errorResponse.details.messages
              )}`
            );
            dependencyErrors.push(error);
          }
        });
        if (dependencyErrors.length) {
          const dependencyElement = elementDetails.element;
          logger.warnWithDetails(
            `There were some issues during retrieving of element ${elementDetails.element.name} dependencies.`,
            `There were some issues during retrieving of element ${
              dependencyElement.environment
            }/${dependencyElement.stageNumber}/${dependencyElement.system}/${
              dependencyElement.subSystem
            }/${dependencyElement.type}/${
              dependencyElement.name
            } dependencies:${[
              '',
              dependencyErrors.map((error) => error.message),
            ].join('\n')}.`
          );
          dependencyErrors.forEach((error) => {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
              status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
              error,
            });
          });
        }
        const successfulDependencies = dependencyWithContentResponses
          .map((dependency) => {
            if (isError(dependency)) return;
            const [element, retrieveResponse] = dependency;
            if (isErrorEndevorResponse(retrieveResponse)) return;
            const elementsWithContent: [Element, string] = [
              element.element,
              retrieveResponse.result.content,
            ];
            return elementsWithContent;
          })
          .filter(isDefined);
        elementsWithDeps.push({
          mainElement: {
            details: elementDetails,
            content: retrieveResult,
          },
          dependencies: successfulDependencies,
        });
      }
      const saveResults: ReadonlyArray<[ElementDetails, Error | vscode.Uri]> =
        await Promise.all(
          elementsWithDeps.map(async (result) => {
            const saveResult = await saveIntoWorkspaceWithDependencies(logger)(
              workspaceUri
            )(
              result.mainElement.details.serviceId.name,
              result.mainElement.details.searchLocationId.name
            )({
              mainElement: {
                element: result.mainElement.details.element,
                content: result.mainElement.content,
              },
              dependencies: result.dependencies,
            });
            if (isError(saveResult)) {
              const error = saveResult;
              const element = result.mainElement.details.element;
              return [
                result.mainElement.details,
                new Error(
                  `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} into the file system because of error:\n${error.message}`
                ),
              ];
            }
            return [result.mainElement.details, saveResult];
          })
        );
      // show text editors only in sequential order (concurrency: 1)
      const sequentialShowing = 1;
      const showResults: ReadonlyArray<[ElementDetails, Error | void]> =
        await new PromisePool(
          saveResults.map(([elementDetails, result]) => {
            const showElementCallback: () => Promise<
              [ElementDetails, Error | void]
            > = async () => {
              if (!isError(result)) {
                const savedElementUri = result;
                const showResult = await showElementInEditor(savedElementUri);
                if (isError(showResult)) {
                  const error = showResult;
                  const element = elementDetails.element;
                  return [
                    elementDetails,
                    new Error(
                      `Unable to show element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} in the editor because of error:\n${error.message}`
                    ),
                  ];
                }
                return [elementDetails, showResult];
              }
              return [elementDetails, result];
            };
            return showElementCallback;
          }),
          {
            concurrency: sequentialShowing,
          }
        ).start();
      showResults.map(([elementDetails, result]) => {
        if (isError(result)) {
          errors.push([elementDetails, result]);
        }
      });
      if (errors.length) {
        const elementNames = errors
          .map(([elementDetails]) => elementDetails.element.name)
          .join(', ');
        const elementPaths = errors
          .map(([elementDetails]) => {
            const element = elementDetails.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
          })
          .join(',\n ');
        logger.error(
          `There were some issues during retrieving of elements ${elementNames}.`,
          `There were some issues during retrieving of elements ${elementPaths}:${[
            '',
            errors.map(([, error]) => error.message),
          ].join('\n')}.`
        );
      }
      errors.forEach(([, error]) => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
      });
      mainElementRetrieveResponses
        .map((retrieveResponse) => {
          const [, mainElementRetrieveResponse] = retrieveResponse;
          const mainElementRetrieved = !isErrorEndevorResponse(
            mainElementRetrieveResponse
          );
          if (mainElementRetrieved) {
            const mainElementSuccessfulResponse = mainElementRetrieveResponse;
            return mainElementSuccessfulResponse;
          }
          return undefined;
        })
        .map((_, index) => {
          const saveResult = saveResults[index];
          if (saveResult) {
            const [, savedUri] = saveResult;
            const elementWasNotSaved = isError(savedUri);
            if (elementWasNotSaved) return undefined;
          }
          const showResult = showResults[index];
          if (showResult) {
            const [, shownElement] = showResult;
            const elementWasNotShown = isError(shownElement);
            if (elementWasNotShown) return undefined;
          }
          return elementsWithDeps[index];
        })
        .filter(isDefined)
        .forEach((elementWithDeps) => {
          const successDependencies = elementWithDeps.dependencies.filter(
            ([, dependencyResult]) => !isError(dependencyResult)
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
            status: RetrieveElementWithDepsCommandCompletedStatus.SUCCESS,
            dependenciesAmount: successDependencies.length,
          });
        });
    });
  };

const retrieveMultipleElementCopies =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  async (
    elements: ReadonlyArray<ElementDetails>
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithoutSignoutResponse]>
  > => {
    const sequentialRetrieving = 1;
    const compProgressReporter = toSeveralTasksProgress(progressReporter)(
      elements.length
    );
    compProgressReporter.message = `Retrieving elements ${elements
      .map((validElementUri) => validElementUri.element.name)
      .join(', ')} ...`;
    return (
      await new PromisePool(
        elements.map((element) => {
          return async () => {
            return retrieveElementAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId: element.serviceId,
                searchLocationId: element.searchLocationId,
                element: element.element,
              })
            )(compProgressReporter)(element.service)(element.element);
          };
        }),
        {
          concurrency: sequentialRetrieving,
        }
      ).start()
    ).map((elementContentWithDeps, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [elements[index]!, elementContentWithDeps];
    });
  };

const retrieveMultipleElementsWithDepsWithSignout =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >
  ) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    const logger = createEndevorLogger();
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementNode = elementNodes[0]!;
    const connectionParams = await getConnectionConfiguration(
      firstElementNode.serviceId,
      firstElementNode.searchLocationId
    );
    if (!connectionParams) return;
    const { searchLocation } = connectionParams;
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: searchLocation.ccid,
      comment: searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        'CCID and Comment must be specified to sign out elements.',
        'Retrieve element with dependencies command cancelled.'
      );
      return;
    }
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { element } = elementNode;
      const connectionParams = await getConnectionConfiguration(
        elementNode.serviceId,
        elementNode.searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${elementNode.name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service } = connectionParams;
      elementDetails.push({
        element,
        service,
        serviceId: elementNode.serviceId,
        searchLocationId: elementNode.searchLocationId,
      });
    }
    const validElementDetails = elementDetails
      .map((element) => {
        if (isError(element)) {
          return undefined;
        }
        return element;
      })
      .filter(isDefined);
    await withNotificationProgress(
      `Retrieving elements ${elementNodes
        .map((node) => node.name)
        .join(', ')} with dependencies`
    )(async (progressReporter) => {
      const multiTaskProgressReporter = toSeveralTasksProgress(
        progressReporter
      )(RETRIEVE_PROGRESS_PARTS_NUM * elementNodes.length);
      const retrieveMainElementResponses: ReadonlyArray<
        [ElementDetails, RetrieveElementWithSignoutResponse]
      > = await complexMultipleRetrieve(logger)(dispatch)(
        multiTaskProgressReporter
      )(endevorMaxRequestsNumber)(
        validElementDetails.map((element) => element)
      )(signoutChangeControlValue);
      const allResults = await new PromisePool(
        retrieveMainElementResponses.map((retrieveResponse) => {
          const retrieveMainElementCallback: () => Promise<
            [ElementDetails, Error | string]
          > = async () => {
            const [elementDetails, mainElementRetrieveResponse] =
              retrieveResponse;
            if (!isErrorEndevorResponse(mainElementRetrieveResponse)) {
              const successfulRetrieveResult: [ElementDetails, Content] = [
                elementDetails,
                mainElementRetrieveResponse.result.content,
              ];
              return successfulRetrieveResult;
            }
            const mainElementErrorResponse = mainElementRetrieveResponse;
            const element = elementDetails.element;
            // TODO: format using all possible error details
            const mainElementError = new Error(
              `Unable to retrieve element ${element.environment}/${
                element.stageNumber
              }/${element.system}/${element.subSystem}/${element.type}/${
                element.name
              } because of error:${formatWithNewLines(
                mainElementErrorResponse.details.messages
              )}`
            );
            switch (mainElementErrorResponse.type) {
              case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
                const retrieveCopyResponse = await retrieveSingleElementCopy(
                  dispatch
                )(multiTaskProgressReporter)(
                  elementDetails.serviceId,
                  elementDetails.searchLocationId
                )(elementDetails.service)(elementDetails.element);
                if (isErrorEndevorResponse(retrieveCopyResponse)) {
                  const copyErrorResponse = retrieveCopyResponse;
                  const element = elementDetails.element;
                  const copyError = new Error(
                    `Unable to retrieve copy of ${element.environment}/${
                      element.stageNumber
                    }/${element.system}/${element.subSystem}/${element.type}/${
                      element.name
                    } because of error:${formatWithNewLines(
                      copyErrorResponse.details.messages
                    )}`
                  );
                  reporter.sendTelemetryEvent({
                    type: TelemetryEvents.ERROR,
                    errorContext:
                      TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
                    status:
                      SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
                    error: copyError,
                  });
                  return [elementDetails, copyError];
                }
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
                  context:
                    TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
                  status:
                    SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
                });
                return [elementDetails, retrieveCopyResponse.result.content];
              }
              case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
              case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
                // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
                return [elementDetails, mainElementError];
              case ErrorResponseType.CERT_VALIDATION_ERROR:
              case ErrorResponseType.CONNECTION_ERROR:
                // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
                return [elementDetails, mainElementError];
              case ErrorResponseType.GENERIC_ERROR:
                return [elementDetails, mainElementError];
              default:
                throw new UnreachableCaseError(mainElementErrorResponse.type);
            }
          };
          return retrieveMainElementCallback;
        }),
        {
          concurrency: endevorMaxRequestsNumber,
        }
      ).start();
      const elementsWithDeps: {
        mainElement: {
          details: ElementDetails;
          content: string;
        };
        dependencies: [Element, string][];
      }[] = [];
      const errors: Array<[ElementDetails, Error]> = [];
      for (const [elementDetails, retrieveResult] of allResults) {
        logger.updateContext({
          serviceId: elementDetails.serviceId,
          searchLocationId: elementDetails.searchLocationId,
        });
        const dependencyErrors: Error[] = [];
        if (isError(retrieveResult)) {
          errors.push([elementDetails, retrieveResult]);
          continue;
        }
        const componentsResponse = await retrieveSingleElementComponents(
          dispatch
        )(multiTaskProgressReporter)(
          elementDetails.serviceId,
          elementDetails.searchLocationId
        )(elementDetails.service)(elementDetails.element);
        if (isErrorEndevorResponse(componentsResponse)) {
          const componentsErrorResponse = componentsResponse;
          const element = elementDetails.element;
          // TODO: format using all possible error details
          const componentsError = new Error(
            `Unable to retrieve components for element ${element.environment}/${
              element.stageNumber
            }/${element.system}/${element.subSystem}/${element.type}/${
              element.name
            } because of error:${formatWithNewLines(
              componentsErrorResponse.details.messages
            )}`
          );
          switch (componentsErrorResponse.type) {
            case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
            case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
              logger.errorWithDetails(
                'Endevor credentials are incorrect or expired.',
                `${componentsError.message}.`
              );
              // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              return;
            case ErrorResponseType.CERT_VALIDATION_ERROR:
            case ErrorResponseType.CONNECTION_ERROR:
              logger.errorWithDetails(
                'Unable to connect to Endevor Web Services.',
                `${componentsError.message}.`
              );
              // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              return;
            case ErrorResponseType.GENERIC_ERROR:
              // TODO: think about a better way to log dep errors
              // logger.error(
              //   `Unable to retrieve dependencies for element ${elementDetails.element.name}.`,
              //   `${componentsError.message}.`
              // );
              reporter.sendTelemetryEvent({
                type: TelemetryEvents.ERROR,
                errorContext:
                  TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
                status:
                  RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
                error: componentsError,
              });
              break;
            default:
              throw new UnreachableCaseError(componentsErrorResponse.type);
          }
        }
        const dependencies = isErrorEndevorResponse(componentsResponse)
          ? []
          : await retrieveDependenciesInfo(dispatch)(multiTaskProgressReporter)(
              elementDetails.serviceId,
              elementDetails.searchLocationId
            )(
              elementDetails.service,
              endevorMaxRequestsNumber
            )(componentsResponse.result);
        const dependencyWithContentResponses =
          await retrieveMultipleElementCopies(dispatch)(
            multiTaskProgressReporter
          )(
            dependencies
              .map(([, dependency]) => {
                if (isError(dependency)) {
                  const error = dependency;
                  dependencyErrors.push(error);
                  return;
                }
                return {
                  serviceId: elementDetails.serviceId,
                  searchLocationId: elementDetails.searchLocationId,
                  element: dependency,
                  service: elementDetails.service,
                };
              })
              .filter(isDefined)
          );
        dependencyWithContentResponses.map(([, retrieveResponse]) => {
          if (isErrorEndevorResponse(retrieveResponse)) {
            const errorResponse = retrieveResponse;
            const element = elementDetails.element;
            // TODO: format using all possible error details
            const error = new Error(
              `Unable to retrieve element ${element.environment}/${
                element.stageNumber
              }/${element.system}/${element.subSystem}/${element.type}/${
                element.name
              } dependency content because of error:${formatWithNewLines(
                errorResponse.details.messages
              )}`
            );
            dependencyErrors.push(error);
          }
        });
        if (dependencyErrors.length) {
          const dependencyElement = elementDetails.element;
          logger.warnWithDetails(
            `There were some issues during retrieving of element ${elementDetails.element.name} dependencies.`,
            `There were some issues during retrieving of element ${
              dependencyElement.environment
            }/${dependencyElement.stageNumber}/${dependencyElement.system}/${
              dependencyElement.subSystem
            }/${dependencyElement.type}/${
              dependencyElement.name
            } dependencies:${[
              '',
              dependencyErrors.map((error) => error.message),
            ].join('\n')}.`
          );
          dependencyErrors.forEach((error) => {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
              status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
              error,
            });
          });
        }
        const successfulDependencies = dependencyWithContentResponses
          .map((dependency) => {
            if (isError(dependency)) return;
            const [element, retrieveResponse] = dependency;
            if (isErrorEndevorResponse(retrieveResponse)) return;
            const elementsWithContent: [Element, string] = [
              element.element,
              retrieveResponse.result.content,
            ];
            return elementsWithContent;
          })
          .filter(isDefined);
        elementsWithDeps.push({
          mainElement: {
            details: elementDetails,
            content: retrieveResult,
          },
          dependencies: successfulDependencies,
        });
      }
      const saveResults: ReadonlyArray<[ElementDetails, Error | vscode.Uri]> =
        await Promise.all(
          elementsWithDeps.map(async (result) => {
            const saveResult = await saveIntoWorkspaceWithDependencies(logger)(
              workspaceUri
            )(
              result.mainElement.details.serviceId.name,
              result.mainElement.details.searchLocationId.name
            )({
              mainElement: {
                element: result.mainElement.details.element,
                content: result.mainElement.content,
              },
              dependencies: result.dependencies,
            });
            if (isError(saveResult)) {
              const error = saveResult;
              const element = result.mainElement.details.element;
              return [
                result.mainElement.details,
                new Error(
                  `Unable to save element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} into the file system because of error:\n${error.message}`
                ),
              ];
            }
            return [result.mainElement.details, saveResult];
          })
        );
      // show text editors only in sequential order (concurrency: 1)
      const sequentialShowing = 1;
      const showResults: ReadonlyArray<[ElementDetails, Error | void]> =
        await new PromisePool(
          saveResults.map(([elementDetails, result]) => {
            const showElementCallback: () => Promise<
              [ElementDetails, Error | void]
            > = async () => {
              if (!isError(result)) {
                const savedElementUri = result;
                const showResult = await showElementInEditor(savedElementUri);
                if (isError(showResult)) {
                  const error = showResult;
                  const element = elementDetails.element;
                  return [
                    elementDetails,
                    new Error(
                      `Unable to show element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} in the editor because of error:\n${error.message}`
                    ),
                  ];
                }
                return [elementDetails, showResult];
              }
              return [elementDetails, result];
            };
            return showElementCallback;
          }),
          {
            concurrency: sequentialShowing,
          }
        ).start();
      showResults
        .map(([elementDetails, result]) => {
          if (isError(result)) {
            errors.push([elementDetails, result]);
          }
          return undefined;
        })
        .filter(isDefined);
      if (errors.length) {
        const elementNames = errors
          .map(([elementDetails]) => elementDetails.element.name)
          .join(', ');
        const elementPaths = errors
          .map(([elementDetails]) => {
            const element = elementDetails.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
          })
          .join(',\n ');
        logger.error(
          `There were some issues during retrieving of elements ${elementNames}.`,
          `There were some issues during retrieving of elements ${elementPaths}:${[
            '',
            errors.map(([, error]) => error.message),
          ].join('\n')}.`
        );
      }
      errors.forEach(([, error]) => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext:
            TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
          status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
      });
      retrieveMainElementResponses
        .map((retrieveResponse) => {
          const [, mainElementRetrieveResponse] = retrieveResponse;
          const mainElementRetrieved = !isError(mainElementRetrieveResponse);
          if (mainElementRetrieved) {
            const mainElementSuccessfulResponse = mainElementRetrieveResponse;
            return mainElementSuccessfulResponse;
          }
          return undefined;
        })
        .map((_, index) => {
          const saveResult = saveResults[index];
          if (saveResult) {
            const [, savedUri] = saveResult;
            const elementWasNotSaved = isError(savedUri);
            if (elementWasNotSaved) return undefined;
          }
          const showResult = showResults[index];
          if (showResult) {
            const [, shownElement] = showResult;
            const elementWasNotShown = isError(shownElement);
            if (elementWasNotShown) return undefined;
          }
          return elementsWithDeps[index];
        })
        .filter(isDefined)
        .forEach((elementWithDeps) => {
          const successDependencies = elementWithDeps.dependencies.filter(
            ([, dependencyResult]) => !isError(dependencyResult)
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
            status: RetrieveElementWithDepsCommandCompletedStatus.SUCCESS,
            dependenciesAmount: successDependencies.length,
          });
        });
    });
  };

type ElementDetails = Readonly<{
  serviceId: EndevorId;
  searchLocationId: EndevorId;
  service: EndevorAuthorizedService;
  element: Element;
}>;

const complexMultipleRetrieve =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (endevorMaxRequestsNumber: number) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      dispatch
    )(progressReporter)(endevorMaxRequestsNumber)(validElementUris)(
      signoutChangeControlValue
    );
    const successRetrievedElementsWithSignout = withoutErrors(
      retrieveWithSignoutResult
    );
    const notRetrievedElementsWithSignout = allErrors(
      retrieveWithSignoutResult
    );
    const firstAttemptWasSuccessful = !notRetrievedElementsWithSignout.length;
    if (firstAttemptWasSuccessful) {
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      progressReporter.report({
        increment: 100 * validElementUris.length,
        message: progressReporter.message,
      });
      return retrieveWithSignoutResult;
    }
    const genericErrorsAfterSignoutRetrieve = genericErrors(
      retrieveWithSignoutResult
    );
    genericErrorsAfterSignoutRetrieve.forEach(([, error]) =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext:
          TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED,
        status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
        error,
      })
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      logger.trace(
        `Unable to retrieve elements ${notRetrievedElementsWithSignout
          .map(([elementDetails]) => {
            const element = elementDetails.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
          })
          .join(',\n ')} with signout.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      progressReporter.report({
        increment: 100 * validElementUris.length,
        message: progressReporter.message,
      });
      return retrieveWithSignoutResult;
    }
    const signoutErrorsAfterSignoutRetrieve = signoutErrors(
      retrieveWithSignoutResult
    );
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve
        .map((elementDetails) => elementDetails.element.name)
        .join(
          ', '
        )} cannot be retrieved with signout because the elements are signed out to somebody else.`
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve
          .map((elementDetails) => {
            const element = elementDetails.element;
            return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
          })
          .join(', ')} copies will be retrieved.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      progressReporter.report({
        increment: 100 * validElementUris.length,
        message: progressReporter.message,
      });
      return retrieveWithSignoutResult;
    }
    logger.trace(
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve
        .map((elementDetails) => {
          const element = elementDetails.element;
          return `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}`;
        })
        .join(',\n ')} will be retrieved with override signout.`
    );
    progressReporter.report({
      increment:
        100 *
        (validElementUris.length - signoutErrorsAfterSignoutRetrieve.length),
      message: progressReporter.message,
    });
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(dispatch)(
        progressReporter
      )(signoutErrorsAfterSignoutRetrieve)(signoutChangeControlValue);
    const successRetrievedElementsWithOverrideSignout = withoutErrors(
      retrieveWithOverrideSignoutResult
    );
    const signedOutElements = toSignedOutElementsPayload([
      ...[
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map(([signedOutElement]) => signedOutElement),
    ]);
    await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    return [
      ...successRetrievedElementsWithSignout,
      ...successRetrievedElementsWithOverrideSignout,
    ];
  };

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
): ReadonlyArray<ElementDetails> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        switch (errorResponse.type) {
          case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
            return elementDetails;
          default:
            return undefined;
        }
      }
      return undefined;
    })
    .filter(isDefined);
};

const genericErrors = (
  input: ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const element = elementDetails.element;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${element.type}/${
            element.name
          } with sign out because of error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        if (errorResponse.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR) {
          return undefined;
        }
        const mappedValue: [ElementDetails, Error] = [elementDetails, error];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const allErrors = (
  input: ReadonlyArray<
    [
      ElementDetails,
      RetrieveElementWithSignoutResponse | RetrieveElementWithSignoutResponse
    ]
  >
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        const errorResponse = retrieveResponse;
        const element = elementDetails.element;
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve element ${element.environment}/${
            element.stageNumber
          }/${element.system}/${element.subSystem}/${element.type}/${
            element.name
          } with sign out because of error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        const mappedValue: [ElementDetails, Error] = [elementDetails, error];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const withoutErrors = (
  input: ReadonlyArray<
    [
      ElementDetails,
      RetrieveElementWithSignoutResponse | RetrieveElementWithSignoutResponse
    ]
  >
): ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResponse] = result;
      if (isErrorEndevorResponse(retrieveResponse)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, RetrieveElementWithSignoutResponse] =
        [elementDetails, retrieveResponse];
      return mappedValue;
    })
    .filter(isDefined);
};

const retrieveMultipleElementsWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (endevorMaxRequestsNumber: number) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const multiProgressReporter = toSeveralTasksProgress(progressReporter)(
      validElementUris.length
    );
    multiProgressReporter.message = `Retrieving elements ${validElementUris
      .map((element) => element.element.name)
      .join(', ')} with signout ...`;
    return (
      await new PromisePool(
        validElementUris.map((element) => {
          return async () => {
            return retrieveElementWithSignoutAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId: element.serviceId,
                searchLocationId: element.searchLocationId,
                element: element.element,
              })
            )(multiProgressReporter)(element.service)(element.element)({
              signoutChangeControlValue,
            });
          };
        }),
        {
          concurrency: endevorMaxRequestsNumber,
        }
      ).start()
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [validElementUris[index]!, retrievedContent];
    });
  };

const retrieveMultipleElementsWithOverrideSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const sequentialRetrieving = 1;
    const multiProgressReporter = toSeveralTasksProgress(progressReporter)(
      validElementUris.length
    );
    multiProgressReporter.message = `Retrieving elements ${validElementUris
      .map((validElementUri) => validElementUri.element.name)
      .join(', ')} with override signout ...`;
    return (
      await new PromisePool(
        validElementUris.map((element) => {
          return async () => {
            return retrieveElementWithSignoutAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId: element.serviceId,
                searchLocationId: element.searchLocationId,
                element: element.element,
              })
            )(
              toSeveralTasksProgress(progressReporter)(validElementUris.length)
            )(element.service)(element.element)({
              signoutChangeControlValue,
              overrideSignOut: true,
            });
          };
        }),
        {
          concurrency: sequentialRetrieving,
        }
      ).start()
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [validElementUris[index]!, retrievedContent];
    });
  };

const saveIntoWorkspace =
  (workspaceUri: vscode.Uri) =>
  (serviceName: string, locationName: string) =>
  async (
    element: Element,
    elementContent: string
  ): Promise<vscode.Uri | Error> => {
    const file = toFileDescription(element)(serviceName, locationName);
    const elementDir = file.workspaceDirectoryPath;
    const directoryToSave = await createNewWorkspaceDirectory(workspaceUri)(
      elementDir
    );
    const saveResult = await saveFileIntoWorkspaceFolder(directoryToSave)(
      file,
      elementContent
    );
    if (isError(saveResult)) {
      const error = saveResult;
      return error;
    }
    const savedFileUri = saveResult;
    return savedFileUri;
  };

const toFileDescription =
  (element: Element) => (serviceName: string, locationName: string) => {
    const elementDir = path.join(
      `/`,
      serviceName,
      locationName,
      element.system,
      element.subSystem,
      element.type
    );
    const fileExtResolution = getFileExtensionResolution();
    switch (fileExtResolution) {
      case FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME:
        return {
          fileName: element.name,
          fileExtension: getElementExtension(element),
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_TYPE_EXT:
        return {
          fileName: element.name,
          fileExtension: element.extension,
          workspaceDirectoryPath: elementDir,
        };
      case FileExtensionResolutions.FROM_NAME: {
        const { fileName, fileExtension } = parseFilePath(element.name);
        return {
          fileName,
          fileExtension,
          workspaceDirectoryPath: elementDir,
        };
      }
      default:
        throw new UnreachableCaseError(fileExtResolution);
    }
  };

const showElementInEditor = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  try {
    await showFileContent(fileUri);
  } catch (error) {
    return new Error(
      `Unable to open file ${fileUri.fsPath} because of error:\n${error.message}`
    );
  }
};

const toSignedOutElementsPayload = (
  signedOutElements: ReadonlyArray<ElementDetails>
): SignedOutElementsPayload => {
  // The accumulator should contain only elements, everything else will be filled within the reducer.
  // This is the most understandable way to initialize the accumulator.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const accumulator: SignedOutElementsPayload = {
    elements: [],
  } as unknown as SignedOutElementsPayload;
  return signedOutElements.reduce((acc, signedOutElement) => {
    return {
      serviceId: signedOutElement.serviceId,
      service: signedOutElement.service,
      searchLocationId: signedOutElement.searchLocationId,
      elements: [...acc.elements, signedOutElement.element],
    };
  }, accumulator);
};

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (actionPayload: SignedOutElementsPayload): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      ...actionPayload,
    });
  };

const retrieveDependenciesInfo =
  (dispatch: (action: Action) => Promise<void>) =>
  (progressReporter: ProgressReporter) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService, requestPoolMaxSize: number) =>
  async (
    components: ReadonlyArray<Component>
  ): Promise<ReadonlyArray<[Component, Element | Error]>> => {
    const dependenciesNumber = components.length;
    const allSearchPaths = components
      .map((components) => toSearchPath(components))
      .filter(isUnique);
    const allSearchLocations = allSearchPaths
      .map((components) => fromEndevorMapPath(components))
      .filter(isDefined);
    const dependenciesReporter: ProgressReporter =
      toSeveralTasksProgress(progressReporter)(dependenciesNumber);
    dependenciesReporter.message = 'Looking for dependencies ...';
    const elementsResult = await new PromisePool(
      allSearchLocations.map((searchLocationDetails) => () => {
        return searchForElementsInPlaceAndLogActivity(
          setLogActivityContext(dispatch, {
            serviceId,
            searchLocationId,
          })
        )(dependenciesReporter)(service)({
          environment: searchLocationDetails.environment,
          stageNumber: searchLocationDetails.stageNumber,
        })(
          searchLocationDetails.system,
          searchLocationDetails.subSystem,
          searchLocationDetails.type
        );
      }),
      {
        concurrency: requestPoolMaxSize,
      }
    ).start();
    const resultsPerLocation = elementsResult
      .map((response, index) => {
        const searchPath = allSearchPaths[index];
        if (!searchPath) return;
        return { searchPath, response };
      })
      .filter(isDefined);
    return components.map((component) => {
      const existingLocation = resultsPerLocation.find(
        (result) => result.searchPath === toSearchPath(component)
      );
      if (!existingLocation) {
        return [
          component,
          new Error(
            `Unable to fetch dependency info for component ${component.system}/${component.subSystem}/${component.type}/${component.id}`
          ),
        ];
      }
      if (isErrorEndevorResponse(existingLocation.response)) {
        // TODO work with new error responses, not errors
        return [
          component,
          new Error(
            `Unable to fetch dependency info for component ${
              component.system
            }/${component.subSystem}/${component.type}/${
              component.id
            } because of error:${[
              '',
              ...existingLocation.response.details.messages,
            ].join('\n')}`
          ),
        ];
      }
      const element = existingLocation.response.result.find(
        (element) =>
          element.id === component.id || element.name === component.id
      );
      if (!element)
        return [
          component,
          new Error(
            `Unable to fetch dependency info for component ${component.system}/${component.subSystem}/${component.type}/${component.id}`
          ),
        ];
      return [component, element];
    });
  };
