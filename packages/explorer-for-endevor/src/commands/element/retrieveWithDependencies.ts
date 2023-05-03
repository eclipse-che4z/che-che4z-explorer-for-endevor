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

import { logger, reporter } from '../../globals';
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
  retrieveElementComponents,
  retrieveElement,
  retrieveElementWithSignout,
  searchForElementsInPlace,
} from '../../endevor';
import { askToOverrideSignOutForElements } from '../../dialogs/change-control/signOutDialogs';
import {
  Element,
  ActionChangeControlValue,
  Dependency,
  ElementContent,
  ErrorResponseType,
  RetrieveElementWithSignoutResponse,
  RetrieveElementWithoutSignoutResponse,
  Value,
  Component,
  Service,
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
  TreeElementCommandArguments,
} from '../../_doc/Telemetry';
import { Id } from '../../store/storage/_doc/Storage';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import path = require('path');
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { ProgressReporter } from '@local/vscode-wrapper/_doc/window';
import { Content } from '@local/endevor/_ext/Endevor';
import {
  ConnectionConfigurations,
  getConnectionConfiguration,
  groupBySearchLocationId,
} from '../utils';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

type ServiceInstance = Readonly<{
  service: Service;
  configurationName: Value;
  requestPoolMaxSize: number;
}>;

export const retrieveWithDependencies = async (
  configurations: ConnectionConfigurations,
  dispatch: (action: Action) => Promise<void>,
  elementNode?: SelectedElementNode,
  nodes?: SelectedMultipleNodes
) => {
  if (nodes && nodes.length) {
    const elementNodes = filterElementNodes(nodes);
    logger.trace(
      `Retrieve element command was called for ${elementNodes
        .map((node) => node.name)
        .join(',')}.`
    );
    if (isAutomaticSignOut()) {
      const groupedElementNodes = groupBySearchLocationId(elementNodes);
      for (const elementNodesGroup of Object.values(groupedElementNodes)) {
        await retrieveMultipleElementsWithDepsWithSignout(
          configurations,
          dispatch
        )(elementNodesGroup);
      }
      return;
    }
    await retrieveMultipleElementsWithDeps(configurations)(elementNodes);
    return;
  } else if (elementNode) {
    logger.trace(
      `Retrieve element command was called for ${elementNode.name}.`
    );
    if (isAutomaticSignOut()) {
      await retrieveSingleElementWithDepsWithSignout(
        configurations,
        dispatch
      )(elementNode);
      return;
    }
    await retrieveSingleElementWithDeps(configurations)(elementNode);
    return;
  } else {
    return;
  }
};

const retrieveSingleElementWithDepsWithSignout =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: TreeElementCommandArguments.SINGLE_ELEMENT,
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
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
    let retrieveMainElementResponse = await complexRetrieve(dispatch)(
      {
        configurationName: configuration,
        service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      },
      searchLocation
    )(
      serviceId,
      searchLocationId,
      element
    )(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveMainElementResponse)) {
      const mainElementErrorResponse = retrieveMainElementResponse;
      // TODO: format using all possible error details
      const mainElementError = new Error(
        `Unable to retrieve the element with sign out with dependencies ${
          element.name
        } because of an error:${formatWithNewLines(
          mainElementErrorResponse.details.messages
        )}`
      );
      switch (mainElementErrorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          retrieveMainElementResponse = await retrieveSingleElementCopy({
            configurationName: configuration,
            service,
            requestPoolMaxSize: endevorMaxRequestsNumber,
          })(element);
          if (isErrorEndevorResponse(retrieveMainElementResponse)) {
            const mainElementCopyErrorResponse = retrieveMainElementResponse;
            const mainElementCopyError = new Error(
              `Unable to retrieve copy of the element ${
                element.name
              } because of an error:${formatWithNewLines(
                mainElementCopyErrorResponse.details.messages
              )}`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
              error: mainElementCopyError,
            });
            logger.error(mainElementCopyError.message);
            return;
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
          });
          break;
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${mainElementError.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${mainElementError.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to retrieve element with sign out ${element.name}.`,
            `${mainElementError.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        default:
          throw new UnreachableCaseError(mainElementErrorResponse.type);
      }
    }
    const componentsResponse = await retrieveSingleElementComponents({
      configurationName: configuration,
      service,
      requestPoolMaxSize: endevorMaxRequestsNumber,
    })(element);
    if (isErrorEndevorResponse(componentsResponse)) {
      const componentsErrorResponse = componentsResponse;
      // TODO: format using all possible error details
      const componentsError = new Error(
        `Unable to retrieve components for element ${name} because of an error:${formatWithNewLines(
          componentsErrorResponse.details.messages
        )}`
      );
      switch (componentsErrorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${componentsError.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: componentsError,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${componentsError.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
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
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: componentsError,
          });
          break;
        default:
          throw new UnreachableCaseError(componentsErrorResponse.type);
      }
    }
    const dependencies = isErrorEndevorResponse(componentsResponse)
      ? []
      : await withNotificationProgress(
          `Retrieving element ${name} dependencies ...`
        )(async (progressReporter) => {
          return retrieveDependenciesInfo(progressReporter)({
            configurationName: configuration,
            service,
            requestPoolMaxSize: endevorMaxRequestsNumber,
          })(configuration)(componentsResponse.result);
        });
    const dependencyWithContentResponses = await retrieveMultipleElementCopies(
      dependencies
        .map(([, dependency]) => {
          if (isError(dependency)) return;
          return {
            serviceId,
            searchLocationId,
            element: dependency,
            configuration,
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
          `Unable to retrieve the element ${name} dependency content because of an error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        dependencyErrors.push(error);
      }
    });
    if (dependencyErrors.length) {
      logger.warn(
        `There were some issues during retrieving of the element ${name} dependencies.`,
        `There were some issues during retrieving of the element ${name} dependencies:${[
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
    const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
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
      logger.error(
        `Unable to save the element ${name} into the file system.`,
        `Unable to save the element ${name} into the file system because of an error:\n${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${name} for editing.`,
        `Unable to open the element ${name} for editing because of an error:\n${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceInstance: ServiceInstance, _searchLocation: ElementSearchLocation) =>
  (serviceId: Id, searchLocationId: Id, element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<RetrieveElementWithSignoutResponse> => {
    const retrieveWithSignoutResponse = await retrieveSingleElementWithSignout(
      serviceInstance
    )(element)(signoutChangeControlValue);
    if (isErrorEndevorResponse(retrieveWithSignoutResponse)) {
      const errorResponse = retrieveWithSignoutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `Element ${element.name} cannot be retrieved with signout because the element is signed out to somebody else.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
          });
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be retrieved with override signout.`
          );
          const retrieveWithOverrideSignoutResponse =
            await retrieveSingleElementWithOverrideSignout(serviceInstance)(
              element
            )(signoutChangeControlValue);
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return retrieveWithOverrideSignoutResponse;
        }
        default:
          return errorResponse;
      }
    }
    await updateTreeAfterSuccessfulSignout(dispatch)({
      serviceId,
      searchLocationId,
      elements: [element],
    });
    return retrieveWithSignoutResponse;
  };

const retrieveSingleElementWithSignout =
  (serviceInstance: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(
        serviceInstance.service
      )(serviceInstance.configurationName)(element)({
        signoutChangeControlValue,
      });
    });
  };

const retrieveSingleElementWithOverrideSignout =
  (serviceInstance: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element ${element.name} with override signout ...`
    )(async (progressReporter) => {
      return retrieveElementWithSignout(progressReporter)(
        serviceInstance.service
      )(serviceInstance.configurationName)(element)({
        signoutChangeControlValue,
        overrideSignOut: true,
      });
    });
  };

const retrieveSingleElementCopy =
  (serviceInstance: ServiceInstance) => (element: Element) => {
    return withNotificationProgress(`Retrieving element ${element.name} ...`)(
      async (progressReporter) => {
        return retrieveElement(progressReporter)(serviceInstance.service)(
          serviceInstance.configurationName
        )(element);
      }
    );
  };

const retrieveSingleElementComponents =
  (serviceInstance: ServiceInstance) => (element: Element) => {
    return withNotificationProgress(
      `Retrieving element ${element.name} components ...`
    )(async (progressReporter) => {
      return retrieveElementComponents(progressReporter)(
        serviceInstance.service
      )(serviceInstance.configurationName)(element);
    });
  };

const saveIntoWorkspaceWithDependencies =
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
      logger.warn(
        `There were some issues during saving of the element ${elementWithDeps.mainElement.element.name} dependencies.`,
        `There were some issues during saving of the element ${
          elementWithDeps.mainElement.element.name
        } dependencies:${['', errors.map((error) => error.message)].join(
          '\n'
        )}.`
      );
    }
    return saveMainElementResult;
  };

const retrieveSingleElementWithDeps =
  (configurations: ConnectionConfigurations) =>
  async ({
    name,
    serviceId,
    searchLocationId,
    element,
  }: Readonly<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: TreeElementCommandArguments.SINGLE_ELEMENT,
      autoSignOut: false,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const connectionParams = await getConnectionConfiguration(configurations)(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, configuration, searchLocation } = connectionParams;
    const retrieveMainElementResponse = await retrieveSingleElementCopy({
      configurationName: configuration,
      service,
      requestPoolMaxSize: endevorMaxRequestsNumber,
    })(element);
    if (isErrorEndevorResponse(retrieveMainElementResponse)) {
      const mainElementErrorResponse = retrieveMainElementResponse;
      // TODO: format using all possible error details
      const mainElementError = new Error(
        `Unable to retrieve the element ${name} because of an error:${formatWithNewLines(
          mainElementErrorResponse.details.messages
        )}`
      );
      switch (mainElementErrorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${mainElementError.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${mainElementError.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR:
          logger.error(
            `Unable to retrieve the element ${name}.`,
            `${mainElementError.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: mainElementError,
          });
          return;
        default:
          throw new UnreachableCaseError(mainElementErrorResponse.type);
      }
    }
    const componentsResponse = await retrieveSingleElementComponents({
      configurationName: configuration,
      service,
      requestPoolMaxSize: endevorMaxRequestsNumber,
    })(element);
    if (isErrorEndevorResponse(componentsResponse)) {
      const componentsErrorResponse = componentsResponse;
      // TODO: format using all possible error details
      const componentsError = new Error(
        `Unable to retrieve components for element ${name} because of an error:${formatWithNewLines(
          componentsErrorResponse.details.messages
        )}`
      );
      switch (componentsErrorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.error(
            'Endevor credentials are incorrect or expired.',
            `${componentsError.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: componentsError,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.error(
            'Unable to connect to Endevor Web Services.',
            `${componentsError.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext:
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
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
              TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
            error: componentsError,
          });
          break;
        default:
          throw new UnreachableCaseError(componentsErrorResponse.type);
      }
    }
    const dependencies = isErrorEndevorResponse(componentsResponse)
      ? []
      : await withNotificationProgress(
          `Retrieving element ${name} dependencies ...`
        )(async (progressReporter) => {
          return retrieveDependenciesInfo(progressReporter)({
            configurationName: configuration,
            service,
            requestPoolMaxSize: endevorMaxRequestsNumber,
          })(configuration)(componentsResponse.result);
        });
    const dependencyWithContentResponses = await retrieveMultipleElementCopies(
      dependencies
        .map(([, dependency]) => {
          if (isError(dependency)) return;
          return {
            serviceId,
            searchLocationId,
            element: dependency,
            service,
            configuration,
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
          `Unable to retrieve the element ${name} dependency content because of an error:${formatWithNewLines(
            errorResponse.details.messages
          )}`
        );
        dependencyErrors.push(error);
      }
    });
    if (dependencyErrors.length) {
      logger.warn(
        `There were some issues during retrieving of the element ${name} dependencies.`,
        `There were some issues during retrieving of the element ${name} dependencies:${[
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
    const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
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
      logger.error(
        `Unable to save the element ${name} into the file system.`,
        `Unable to save the element ${name} into the file system because of an error:\n${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    const savedElementUri = saveResult;
    const showResult = await showElementInEditor(savedElementUri);
    if (isError(showResult)) {
      const error = showResult;
      logger.error(
        `Unable to open the element ${name} for editing.`,
        `Unable to open the element ${name} for editing because of an error:\n${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
  };

const retrieveMultipleElementsWithDeps =
  (configurations: ConnectionConfigurations) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elementNodes.length,
      autoSignOut: false,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status:
          RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR,
        error,
      });
      return;
    }
    const endevorMaxRequestsNumber = getMaxParallelRequests();
    const elementDetails: Array<ElementDetails | Error> = [];
    for (const elementNode of elementNodes) {
      const { name, serviceId, searchLocationId, element } = elementNode;
      const connectionParams = await getConnectionConfiguration(configurations)(
        serviceId,
        searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve the element ${name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service, configuration, searchLocation } = connectionParams;
      elementDetails.push({
        element,
        service,
        configuration,
        searchLocation,
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
    const mainElementRetrieveResponses: ReadonlyArray<
      [ElementDetails, RetrieveElementWithoutSignoutResponse]
    > = await retrieveMultipleElementCopies(
      validElementDetails.map((element) => element)
    );
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
        // TODO: format using all possible error details
        const mainElementError = new Error(
          `Unable to retrieve the element ${
            elementDetails.element.name
          } because of an error:${formatWithNewLines(
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
      const componentsResponse = await retrieveSingleElementComponents({
        configurationName: elementDetails.configuration,
        service: elementDetails.service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      })(elementDetails.element);
      if (isErrorEndevorResponse(componentsResponse)) {
        const componentsErrorResponse = componentsResponse;
        // TODO: format using all possible error details
        const componentsError = new Error(
          `Unable to retrieve components for element ${
            elementDetails.element.name
          } because of an error:${formatWithNewLines(
            componentsErrorResponse.details.messages
          )}`
        );
        switch (componentsErrorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.error(
              'Endevor credentials are incorrect or expired.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.error(
              'Unable to connect to Endevor Web Services.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
        : await withNotificationProgress(
            `Retrieving element ${elementDetails.element.name} dependencies ...`
          )(async (progressReporter) => {
            return retrieveDependenciesInfo(progressReporter)({
              configurationName: elementDetails.configuration,
              service: elementDetails.service,
              requestPoolMaxSize: endevorMaxRequestsNumber,
            })(elementDetails.configuration)(componentsResponse.result);
          });
      const dependencyWithContentResponses =
        await retrieveMultipleElementCopies(
          dependencies
            .map(([, dependency]) => {
              if (isError(dependency)) return;
              return {
                serviceId: elementDetails.serviceId,
                searchLocationId: elementDetails.searchLocationId,
                element: dependency,
                configuration: elementDetails.configuration,
                service: elementDetails.service,
                requestPoolMaxSize: endevorMaxRequestsNumber,
                searchLocation: elementDetails.searchLocation,
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
            `Unable to retrieve the element ${
              elementDetails.element.name
            } dependency content because of an error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          dependencyErrors.push(error);
        }
      });
      if (dependencyErrors.length) {
        logger.warn(
          `There were some issues during retrieving of the element ${elementDetails.element.name} dependencies.`,
          `There were some issues during retrieving of the element ${
            elementDetails.element.name
          } dependencies:${[
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
          const saveResult = await saveIntoWorkspaceWithDependencies(
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
            return [
              result.mainElement.details,
              new Error(
                `Unable to save the element ${result.mainElement.details.element.name} into the file system because of an error:\n${error.message}`
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
                return [
                  elementDetails,
                  new Error(
                    `Unable to show the element ${elementDetails.element.name} in the editor because of an error:\n${error.message}`
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
      logger.error(
        `There were some issues during retrieving of the elements ${elementNames}.`,
        `There were some issues during retrieving of the elements ${elementNames}:${[
          '',
          errors.map(([, error]) => error.message),
        ].join('\n')}.`
      );
    }
    errors.forEach(([, error]) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
  };

const retrieveMultipleElementCopies = async (
  elements: ReadonlyArray<ElementDetails>
): Promise<
  ReadonlyArray<[ElementDetails, RetrieveElementWithoutSignoutResponse]>
> => {
  const sequentialRetrieving = 1;
  return (
    await withNotificationProgress(
      `Retrieving elements ${elements
        .map((validElementUri) => validElementUri.element.name)
        .join(', ')} ...`
    )((progressReporter) => {
      return new PromisePool(
        elements.map((element) => {
          return async () => {
            return retrieveElement(progressReporter)(element.service)(
              element.configuration
            )(element.element);
          };
        }),
        {
          concurrency: sequentialRetrieving,
        }
      ).start();
    })
  ).map((elementContentWithDeps, index) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return [elements[index]!, elementContentWithDeps];
  });
};

const retrieveMultipleElementsWithDepsWithSignout =
  (
    configurations: ConnectionConfigurations,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (elementNodes: ReadonlyArray<ElementNode>): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elementNodes.length,
      autoSignOut: true,
    });
    const workspaceUri = await getWorkspaceUri();
    if (!workspaceUri) {
      const error = new Error(
        'At least one workspace in this project should be opened to retrieve elements'
      );
      logger.error(`${error.message}.`);
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
    const connectionParams = await getConnectionConfiguration(configurations)(
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
      const connectionParams = await getConnectionConfiguration(configurations)(
        elementNode.serviceId,
        elementNode.searchLocationId
      );
      if (!connectionParams) {
        elementDetails.push(
          new Error(
            `Unable to retrieve the element ${elementNode.name} because of missing connection configuration`
          )
        );
        continue;
      }
      const { service, configuration, searchLocation } = connectionParams;
      elementDetails.push({
        element,
        service,
        configuration,
        searchLocation,
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
    const retrieveMainElementResponses: ReadonlyArray<
      [ElementDetails, RetrieveElementWithSignoutResponse]
    > = await complexMultipleRetrieve(dispatch)(endevorMaxRequestsNumber)(
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
          // TODO: format using all possible error details
          const mainElementError = new Error(
            `Unable to retrieve the element ${
              elementDetails.element.name
            } because of an error:${formatWithNewLines(
              mainElementErrorResponse.details.messages
            )}`
          );
          switch (mainElementErrorResponse.type) {
            case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
              const retrieveCopyResponse = await retrieveSingleElementCopy({
                configurationName: elementDetails.configuration,
                service: elementDetails.service,
                requestPoolMaxSize: endevorMaxRequestsNumber,
              })(elementDetails.element);
              if (isErrorEndevorResponse(retrieveCopyResponse)) {
                const copyErrorResponse = retrieveCopyResponse;
                const copyError = new Error(
                  `Unable to retrieve copy of ${
                    elementDetails.element.name
                  } because of an error:${formatWithNewLines(
                    copyErrorResponse.details.messages
                  )}`
                );
                reporter.sendTelemetryEvent({
                  type: TelemetryEvents.ERROR,
                  errorContext:
                    TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
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
                status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
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
      const dependencyErrors: Error[] = [];
      if (isError(retrieveResult)) {
        errors.push([elementDetails, retrieveResult]);
        continue;
      }
      const componentsResponse = await retrieveSingleElementComponents({
        configurationName: elementDetails.configuration,
        service: elementDetails.service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      })(elementDetails.element);
      if (isErrorEndevorResponse(componentsResponse)) {
        const componentsErrorResponse = componentsResponse;
        // TODO: format using all possible error details
        const componentsError = new Error(
          `Unable to retrieve components for element ${
            elementDetails.element.name
          } because of an error:${formatWithNewLines(
            componentsErrorResponse.details.messages
          )}`
        );
        switch (componentsErrorResponse.type) {
          case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
          case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
            logger.error(
              'Endevor credentials are incorrect or expired.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
              status:
                RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
              error: componentsError,
            });
            return;
          case ErrorResponseType.CERT_VALIDATION_ERROR:
          case ErrorResponseType.CONNECTION_ERROR:
            logger.error(
              'Unable to connect to Endevor Web Services.',
              `${componentsError.message}.`
            );
            // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
                TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
        : await withNotificationProgress(
            `Retrieving dependencies for element ${elementDetails.element.name} ...`
          )(async (progressReporter) => {
            return retrieveDependenciesInfo(progressReporter)({
              configurationName: elementDetails.configuration,
              service: elementDetails.service,
              requestPoolMaxSize: endevorMaxRequestsNumber,
            })(elementDetails.configuration)(componentsResponse.result);
          });
      const dependencyWithContentResponses =
        await retrieveMultipleElementCopies(
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
                configuration: elementDetails.configuration,
                service: elementDetails.service,
                searchLocation: elementDetails.searchLocation,
              };
            })
            .filter(isDefined)
        );
      dependencyWithContentResponses.map(([, retrieveResponse]) => {
        if (isErrorEndevorResponse(retrieveResponse)) {
          const errorResponse = retrieveResponse;
          // TODO: format using all possible error details
          // TODO add more dependency info (name, type, etc.) to the error message
          const error = new Error(
            `Unable to retrieve the element ${
              elementDetails.element.name
            } dependency content because of an error:${formatWithNewLines(
              errorResponse.details.messages
            )}`
          );
          dependencyErrors.push(error);
        }
      });
      if (dependencyErrors.length) {
        logger.warn(
          `There were some issues during retrieving of the element ${elementDetails.element.name} dependencies.`,
          `There were some issues during retrieving of the element ${
            elementDetails.element.name
          } dependencies:${[
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
          const saveResult = await saveIntoWorkspaceWithDependencies(
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
            return [
              result.mainElement.details,
              new Error(
                `Unable to save the element ${result.mainElement.details.element.name} into the file system because of an error:\n${error.message}`
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
                return [
                  elementDetails,
                  new Error(
                    `Unable to show the element ${elementDetails.element.name} in the editor because of an error:\n${error.message}`
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
      logger.error(
        `There were some issues during retrieving of the elements ${elementNames}.`,
        `There were some issues during retrieving of the elements ${elementNames}:${[
          '',
          errors.map(([, error]) => error.message),
        ].join('\n')}.`
      );
    }
    errors.forEach(([, error]) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
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
  };

type ElementDetails = Readonly<{
  serviceId: Id;
  searchLocationId: Id;
  service: Service;
  configuration: Value;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

const complexMultipleRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (endevorMaxRequestsNumber: number) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      endevorMaxRequestsNumber
    )(validElementUris)(signoutChangeControlValue);
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
      return retrieveWithSignoutResult;
    }
    const genericErrorsAfterSignoutRetrieve = genericErrors(
      retrieveWithSignoutResult
    );
    genericErrorsAfterSignoutRetrieve.forEach(([, error]) =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
        error,
      })
    );
    const allErrorsAreGeneric =
      genericErrorsAfterSignoutRetrieve.length ===
      notRetrievedElementsWithSignout.length;
    if (allErrorsAreGeneric) {
      logger.trace(
        `Unable to retrieve the elements ${notRetrievedElementsWithSignout
          .map(([elementDetails]) => elementDetails.element.name)
          .join(', ')} with signout.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    const signoutErrorsAfterSignoutRetrieve = signoutErrors(
      retrieveWithSignoutResult
    );
    signoutErrorsAfterSignoutRetrieve.forEach(() =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      })
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
          .map((elementDetails) => elementDetails.element.name)
          .join(', ')} copies will be retrieved.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return retrieveWithSignoutResult;
    }
    logger.trace(
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve
        .map((elementDetails) => elementDetails.element.name)
        .join(', ')} will be retrieved with override signout.`
    );
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(
        signoutErrorsAfterSignoutRetrieve
      )(signoutChangeControlValue);
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
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve the element ${
            elementDetails.element.name
          } with sign out because of an error:${formatWithNewLines(
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
        // TODO: format using all possible error details
        const error = new Error(
          `Unable to retrieve the element ${
            elementDetails.element.name
          } with sign out because of an error:${formatWithNewLines(
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
  (endevorMaxRequestsNumber: number) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    return (
      await withNotificationProgress(
        `Retrieving elements ${validElementUris
          .map((element) => element.element.name)
          .join(', ')} with signout ...`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )(element.service)(element.configuration)(element.element)({
                signoutChangeControlValue,
              });
            };
          }),
          {
            concurrency: endevorMaxRequestsNumber,
          }
        ).start();
      })
    ).map((retrievedContent, index) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [validElementUris[index]!, retrievedContent];
    });
  };

const retrieveMultipleElementsWithOverrideSignout =
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, RetrieveElementWithSignoutResponse]>
  > => {
    const sequentialRetrieving = 1;
    return (
      await withNotificationProgress(
        `Retrieving elements ${validElementUris
          .map((validElementUri) => validElementUri.element.name)
          .join(', ')} with override signout ...`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map((element) => {
            return async () => {
              return retrieveElementWithSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )(element.service)(element.configuration)(element.element)({
                signoutChangeControlValue,
                overrideSignOut: true,
              });
            };
          }),
          {
            concurrency: sequentialRetrieving,
          }
        ).start();
      })
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
      `Unable to open the file ${fileUri.fsPath} because of an error:\n${error.message}`
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
      searchLocation: signedOutElement.searchLocation,
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
  (progressReporter: ProgressReporter) =>
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (configuration: Value) =>
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
    const elementsResult = await new PromisePool(
      allSearchLocations.map((searchLocation) => () => {
        return searchForElementsInPlace(dependenciesReporter)(service)(
          configuration
        )({
          environment: searchLocation.environment,
          stageNumber: searchLocation.stageNumber,
        })(
          searchLocation.system,
          searchLocation.subSystem,
          searchLocation.type
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
            `Unable to fetch dependency info for the component ${component.system}/${component.subSystem}/${component.type}/${component.id}`
          ),
        ];
      }
      if (isErrorEndevorResponse(existingLocation.response)) {
        // TODO work with new error responses, not errors
        return [
          component,
          new Error(
            `Unable to fetch dependency info for the component ${
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
            `Unable to fetch dependency info for the component ${component.system}/${component.subSystem}/${component.type}/${component.id}`
          ),
        ];
      return [component, element];
    });
  };
