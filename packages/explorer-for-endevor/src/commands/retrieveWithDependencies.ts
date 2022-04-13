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

import { logger, reporter } from '../globals';
import {
  filterElementNodes,
  isDefined,
  isError,
  groupBySearchLocationId,
} from '../utils';
import { ElementNode } from '../_doc/ElementTree';
import * as vscode from 'vscode';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import {
  saveElementIntoWorkspace,
  showSavedElementContent,
} from '../workspace';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { PromisePool } from 'promise-pool-tool';
import { isSignoutError, toSeveralTasksProgress } from '@local/endevor/utils';
import {
  getMaxParallelRequests,
  isAutomaticSignOut,
} from '../settings/settings';
import {
  MAX_PARALLEL_REQUESTS_DEFAULT,
  AUTOMATIC_SIGN_OUT_DEFAULT,
} from '../constants';
import { fromTreeElementUri } from '../uri/treeElementUri';
import {
  askForChangeControlValue,
  dialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  retrieveElementWithDependenciesWithoutSignout,
  retrieveElementWithDependenciesWithSignout,
} from '../endevor';
import { askToOverrideSignOutForElements } from '../dialogs/change-control/signOutDialogs';
import {
  Element,
  ActionChangeControlValue,
  ServiceInstance,
  ElementWithDependencies,
  Dependency,
  ElementContent,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import { SignoutError } from '@local/endevor/_doc/Error';
import { Action, Actions, SignedOutElementsPayload } from '../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';
import {
  DependencyRetrievalCompletedStatus,
  RetrieveElementWithDepsCommandCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  TelemetryEvents,
  TreeElementCommandArguments,
} from '../_doc/Telemetry';

type SelectedElementNode = ElementNode;
type SelectedMultipleNodes = ElementNode[];

export const retrieveWithDependencies = async (
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
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for automatic signout, the default ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead.`,
        `Reading settings error ${e.message}`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
      const groupedElementNodes = groupBySearchLocationId(elementNodes);
      for (const elementNodesGroup of Object.values(groupedElementNodes)) {
        await retrieveMultipleElementsWithDepsWithSignout(dispatch)(
          elementNodesGroup
        );
      }
      return;
    }
    await retrieveMultipleElementsWithDeps(elementNodes);
    return;
  } else if (elementNode) {
    logger.trace(
      `Retrieve element command was called for ${elementNode.name}.`
    );
    let autoSignOut: boolean;
    try {
      autoSignOut = isAutomaticSignOut();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for automatic signout, the default ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead.`,
        `Reading settings error ${e.message}`
      );
      autoSignOut = AUTOMATIC_SIGN_OUT_DEFAULT;
    }
    if (autoSignOut) {
      await retrieveSingleElementWithDepsWithSignout(dispatch)(elementNode);
      return;
    }
    await retrieveSingleElementWithDeps(elementNode);
    return;
  } else {
    return;
  }
};

const retrieveSingleElementWithDepsWithSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    element: Readonly<{
      name: string;
      uri: vscode.Uri;
    }>
  ): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.SINGLE_ELEMENT,
      },
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
    let endevorMaxRequestsNumber: number;
    try {
      endevorMaxRequestsNumber = getMaxParallelRequests();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for the Endevor pool size, the default ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
        `Reading settings error ${e.message}`
      );
      endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
    }
    const elementUri = fromTreeElementUri(element.uri);
    if (isError(elementUri)) {
      const error = elementUri;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
      );
      return;
    }
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: elementUri.searchLocation.ccid,
      comment: elementUri.searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(
        `CCID and Comment must be specified to sign out element ${element.name}.`
      );
      return;
    }
    const retrieveResult = await complexRetrieve(dispatch)(
      {
        service: elementUri.service,
        requestPoolMaxSize: endevorMaxRequestsNumber,
      },
      elementUri.searchLocation
    )(
      elementUri.serviceName,
      elementUri.searchLocationName,
      elementUri.element
    )(signoutChangeControlValue);
    if (!retrieveResult) {
      return;
    }
    const successDependencies = retrieveResult.dependencies
      .map((retrieveResult) => {
        const [element, dependency] = retrieveResult;
        const dependencyNotRetrieved = isError(dependency);
        if (dependencyNotRetrieved) {
          return undefined;
        }
        const successDependency: [Dependency, ElementContent] = [
          element,
          dependency,
        ];
        return successDependency;
      })
      .filter(isDefined);
    const errorsDependencies = retrieveResult.dependencies
      .map((retrieveResult) => {
        const [, dependency] = retrieveResult;
        const dependencyNotRetrieved = isError(dependency);
        if (dependencyNotRetrieved) {
          const error = dependency;
          return error;
        }
        return undefined;
      })
      .filter(isDefined);
    if (errorsDependencies.length) {
      logger.warn(
        `There were some issues during retrieving of the element ${element.name} dependencies.`,
        `There were some issues during retrieving of the element ${
          element.name
        } dependencies: ${JSON.stringify(
          errorsDependencies.map((error) => error.message)
        )}.`
      );
      errorsDependencies.forEach((error) => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
          status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
          error,
        });
      });
    }
    const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
      elementUri.serviceName,
      elementUri.searchLocationName
    )({
      mainElement: {
        element: elementUri.element,
        content: retrieveResult.content,
      },
      dependencies: successDependencies,
    });
    if (isError(saveResult)) {
      const error = saveResult;
      logger.error(
        `Unable to save the element ${element.name} into the file system.`,
        `Unable to save the element ${element.name} into the file system because of error ${error.message}.`
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
        `Unable to open the element ${element.name} for editing.`,
        `Unable to open the element ${element.name} for editing because of error ${error.message}.`
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
      dependenciesAmount: successDependencies.length,
    });
  };

const complexRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    { service, requestPoolMaxSize }: ServiceInstance,
    searchLocation: ElementSearchLocation
  ) =>
  (
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName,
    element: Element
  ) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementWithDependencies | undefined> => {
    const retrieveWithSignoutResult = await retrieveSingleElementWithSignout({
      service,
      requestPoolMaxSize,
    })(element)(signoutChangeControlValue);
    if (isSignoutError(retrieveWithSignoutResult)) {
      logger.warn(
        `Element ${element.name} and its dependencies cannot be retrieved with signout because the element is signed out to somebody else.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      });
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (overrideSignout) {
        logger.trace(
          `Override signout option was chosen, ${element.name} and its dependencies will be retrieved with override signout.`
        );
        const retrieveWithOverrideSignoutResult =
          await retrieveSingleElementWithOverrideSignout({
            service,
            requestPoolMaxSize,
          })(element)(signoutChangeControlValue);
        if (isError(retrieveWithOverrideSignoutResult)) {
          logger.warn(
            `Override signout retrieve was not successful, the copies of ${element.name} and its dependencies will be retrieved.`
          );
          const retrieveCopyResult = await retrieveSingleElementCopy({
            service,
            requestPoolMaxSize,
          })(element);
          if (isError(retrieveCopyResult)) {
            const error = retrieveCopyResult;
            logger.error(
              `Unable to retrieve the element ${element.name}.`,
              `${error.message}.`
            );
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
              status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
              error,
            });
            return;
          }
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
          });
          return retrieveCopyResult;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
        });
        await updateTreeAfterSuccessfulSignout(dispatch)({
          serviceName,
          service,
          searchLocationName,
          searchLocation,
          elements: [element],
        });
        return retrieveWithOverrideSignoutResult;
      } else {
        logger.trace(
          `Override signout option was not chosen, copy of ${element.name} and its dependencies will be retrieved.`
        );
        const retrieveCopyResult = await retrieveSingleElementCopy({
          service,
          requestPoolMaxSize,
        })(element);
        if (isError(retrieveCopyResult)) {
          const error = retrieveCopyResult;
          logger.error(
            `Unable to retrieve the element ${element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return;
        }
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
        return retrieveCopyResult;
      }
    }
    if (isError(retrieveWithSignoutResult)) {
      const error = retrieveWithSignoutResult;
      logger.error(
        `Unable to retrieve the element ${element.name}.`,
        `${error.message}.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
      return;
    }
    await updateTreeAfterSuccessfulSignout(dispatch)({
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements: [element],
    });
    return retrieveWithSignoutResult;
  };

const retrieveSingleElementWithSignout =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element and its dependencies with signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesWithSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element)({ signoutChangeControlValue });
    });
  };

const retrieveSingleElementWithOverrideSignout =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) =>
  (signoutChangeControlValue: ActionChangeControlValue) => {
    return withNotificationProgress(
      `Retrieving element and its dependencies with override signout : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesWithSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element)({ signoutChangeControlValue, overrideSignOut: true });
    });
  };

const retrieveSingleElementCopy =
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  (element: Element) => {
    return withNotificationProgress(
      `Retrieving element copy and its dependencies : ${element.name}`
    )(async (progressReporter) => {
      return retrieveElementWithDependenciesWithoutSignout(progressReporter)({
        service,
        requestPoolMaxSize,
      })(element);
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
        } dependencies: ${JSON.stringify(
          errors.map((error) => error.message)
        )}.`
      );
    }
    return saveMainElementResult;
  };

const retrieveSingleElementWithDeps = async (
  element: Readonly<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
    commandArguments: {
      type: TreeElementCommandArguments.SINGLE_ELEMENT,
    },
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
  let endevorMaxRequestsNumber: number;
  try {
    endevorMaxRequestsNumber = getMaxParallelRequests();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for the Endevor pool size, the default ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}`
    );
    endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
  }
  const elementUri = fromTreeElementUri(element.uri);
  if (isError(elementUri)) {
    const error = elementUri;
    logger.error(
      `Unable to retrieve the element ${element.name}.`,
      `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const retrieveResult = await retrieveSingleElementCopy({
    service: elementUri.service,
    requestPoolMaxSize: endevorMaxRequestsNumber,
  })(elementUri.element);
  if (isError(retrieveResult)) {
    const error = retrieveResult;
    logger.error(
      `Unable to retrieve the element ${element.name}.`,
      `${error.message}`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      status: RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const successDependencies = retrieveResult.dependencies
    .map((retrieveResult) => {
      const [element, dependency] = retrieveResult;
      const dependencyNotRetrieved = isError(dependency);
      if (dependencyNotRetrieved) {
        return undefined;
      }
      const successDependency: [Dependency, ElementContent] = [
        element,
        dependency,
      ];
      return successDependency;
    })
    .filter(isDefined);
  const errorsDependencies = retrieveResult.dependencies
    .map((retrieveResult) => {
      const [, dependency] = retrieveResult;
      const dependencyNotRetrieved = isError(dependency);
      if (dependencyNotRetrieved) {
        const error = dependency;
        return error;
      }
      return undefined;
    })
    .filter(isDefined);
  if (errorsDependencies.length) {
    logger.warn(
      `There were some issues during retrieving of the element ${element.name} dependencies.`,
      `There were some issues during retrieving of the element ${
        element.name
      } dependencies: ${JSON.stringify(
        errorsDependencies.map((error) => error.message)
      )}.`
    );
    errorsDependencies.forEach((error) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
        status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
        error,
      });
    });
  }
  const saveResult = await saveIntoWorkspaceWithDependencies(workspaceUri)(
    elementUri.serviceName,
    elementUri.searchLocationName
  )({
    mainElement: {
      element: elementUri.element,
      content: retrieveResult.content,
    },
    dependencies: successDependencies,
  });
  if (isError(saveResult)) {
    const error = saveResult;
    logger.error(
      `Unable to save the element ${element.name} into the file system.`,
      `Unable to save the element ${element.name} into the file system because of error ${error.message}.`
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
      `Unable to open the element ${element.name} for editing.`,
      `Unable to open the element ${element.name} for editing because of error ${error.message}.`
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
    dependenciesAmount: successDependencies.length,
  });
};

const retrieveMultipleElementsWithDeps = async (
  elements: ReadonlyArray<{
    name: string;
    uri: vscode.Uri;
  }>
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
    commandArguments: {
      type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
      elementsAmount: elements.length,
    },
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
  let endevorMaxRequestsNumber: number;
  try {
    endevorMaxRequestsNumber = getMaxParallelRequests();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for the Endevor pool size, the default ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
      `Reading settings error ${e.message}`
    );
    endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
  }
  const validElementUris = elements
    .map((element) => {
      const uriParams = fromTreeElementUri(element.uri);
      if (isError(uriParams)) {
        const error = uriParams;
        logger.trace(
          `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
        );
        return undefined;
      }
      return uriParams;
    })
    .filter(isDefined);
  const retrieveResults: ReadonlyArray<
    [ElementDetails, Error | ElementWithDependencies]
  > = await retrieveMultipleElementCopies(
    validElementUris.map((uri) => {
      return {
        serviceName: uri.serviceName,
        searchLocationName: uri.searchLocationName,
        element: uri.element,
        serviceInstance: {
          service: uri.service,
          requestPoolMaxSize: endevorMaxRequestsNumber,
        },
        searchLocation: uri.searchLocation,
      };
    })
  );
  retrieveResults
    .map((retrieveResult) => {
      const [elementDetails, elementWithDeps] = retrieveResult;
      const mainElementRetrieved = !isError(elementWithDeps);
      if (mainElementRetrieved) {
        const successRetrieve: [ElementDetails, ElementWithDependencies] = [
          elementDetails,
          elementWithDeps,
        ];
        return successRetrieve;
      }
      return undefined;
    })
    .filter(isDefined)
    .forEach(([elementDetails, elementWithDeps]) => {
      const dependencyErrors = elementWithDeps.dependencies
        .map((retrieveDependencyResult) => {
          const [, dependency] = retrieveDependencyResult;
          const dependencyWasRetrieved = !isError(dependency);
          if (dependencyWasRetrieved) return undefined;
          const error = dependency;
          return error;
        })
        .filter(isDefined);
      if (dependencyErrors.length) {
        logger.warn(
          `There were some issues during retrieving of the element ${elementDetails.element.name} dependencies.`,
          `There were some issues during retrieving of the element ${
            elementDetails.element.name
          } dependencies: ${JSON.stringify(
            dependencyErrors.map((error) => error.message)
          )}.`
        );
        dependencyErrors.forEach((dependencyError) => {
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
            status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
            error: dependencyError,
          });
        });
      }
    });
  const saveResults: ReadonlyArray<[ElementDetails, Error | vscode.Uri]> =
    await Promise.all(
      retrieveResults.map(async (retrieveResult) => {
        const [elementDetails, elementWithDeps] = retrieveResult;
        if (isError(elementWithDeps)) {
          return [elementDetails, elementWithDeps];
        }
        const successDependencies = elementWithDeps.dependencies
          .map((retrieveResult) => {
            const [element, dependency] = retrieveResult;
            const dependencyNotRetrieved = isError(dependency);
            if (dependencyNotRetrieved) {
              return undefined;
            }
            const successDependency: [Dependency, ElementContent] = [
              element,
              dependency,
            ];
            return successDependency;
          })
          .filter(isDefined);
        const saveResult = await saveIntoWorkspaceWithDependencies(
          workspaceUri
        )(
          elementDetails.serviceName,
          elementDetails.searchLocationName
        )({
          mainElement: {
            element: elementDetails.element,
            content: elementWithDeps.content,
          },
          dependencies: successDependencies,
        });
        if (isError(saveResult)) {
          const error = saveResult;
          return [
            elementDetails,
            new Error(
              `Unable to save the element ${elementDetails.element.name} into the file system because of error ${error.message}`
            ),
          ];
        }
        return [elementDetails, saveResult];
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
                  `Unable to show the element ${elementDetails.element.name} in the editor because of error ${error.message}`
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
  const errors: ReadonlyArray<[ElementDetails, Error]> = showResults
    .map(([elementDetails, result]) => {
      if (isError(result)) {
        const errorResult: [ElementDetails, Error] = [elementDetails, result];
        return errorResult;
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
      `There were some issues during retrieving of the elements ${elementNames}: ${[
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
  retrieveResults
    .map((retrieveResult) => {
      const [, elementWithDeps] = retrieveResult;
      const mainElementWasRetrieved = !isError(elementWithDeps);
      if (mainElementWasRetrieved) {
        return elementWithDeps;
      }
      return undefined;
    })
    .map((retrieveResult, index) => {
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
      return retrieveResult;
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
  ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
> => {
  const sequentialRetrieving = 1;
  return (
    await withNotificationProgress(
      `Retrieving elements: ${elements
        .map((validElementUri) => validElementUri.element.name)
        .join(', ')} copies with dependencies`
    )((progressReporter) => {
      return new PromisePool(
        elements.map(({ serviceInstance, element }) => {
          return async () => {
            return retrieveElementWithDependenciesWithoutSignout(
              toSeveralTasksProgress(progressReporter)(elements.length)
            )({
              service: serviceInstance.service,
              requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
            })(element);
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
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    elements: ReadonlyArray<{
      name: string;
      uri: vscode.Uri;
    }>
  ): Promise<void> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      commandArguments: {
        type: TreeElementCommandArguments.MULTIPLE_ELEMENTS,
        elementsAmount: elements.length,
      },
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
    let endevorMaxRequestsNumber: number;
    try {
      endevorMaxRequestsNumber = getMaxParallelRequests();
    } catch (e) {
      logger.warn(
        `Cannot read the settings value for the Endevor pool size, the default ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
        `Reading settings error: ${e.message}`
      );
      endevorMaxRequestsNumber = MAX_PARALLEL_REQUESTS_DEFAULT;
    }
    // we are 100% sure, that at least one element is selected
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstElementUriParams = fromTreeElementUri(elements[0]!.uri);
    if (isError(firstElementUriParams)) {
      const error = firstElementUriParams;
      logger.error(
        `Unable to show the change control value dialog.`,
        `Unable to show the change control value dialog because of an error ${error.message}.`
      );
      return;
    }
    const signoutChangeControlValue = await askForChangeControlValue({
      ccid: firstElementUriParams.searchLocation.ccid,
      comment: firstElementUriParams.searchLocation.comment,
    });
    if (dialogCancelled(signoutChangeControlValue)) {
      logger.error(`CCID and Comment must be specified to sign out elements.`);
      return;
    }
    const validElementUris = elements
      .map((element) => {
        const uriParams = fromTreeElementUri(element.uri);
        if (isError(uriParams)) {
          const error = uriParams;
          logger.trace(
            `Unable to retrieve the element ${element.name} because parsing of the element's URI failed with error ${error.message}.`
          );
          return undefined;
        }
        return uriParams;
      })
      .filter(isDefined);
    const retrieveResults: ReadonlyArray<
      [ElementDetails, Error | ElementWithDependencies]
    > = await complexMultipleRetrieve(dispatch)(
      validElementUris.map((uri) => {
        return {
          element: uri.element,
          searchLocationName: uri.searchLocationName,
          serviceName: uri.serviceName,
          serviceInstance: {
            service: uri.service,
            requestPoolMaxSize: endevorMaxRequestsNumber,
          },
          searchLocation: uri.searchLocation,
        };
      })
    )(signoutChangeControlValue);
    retrieveResults
      .map((retrieveResult) => {
        const [elementDetails, elementWithDeps] = retrieveResult;
        const mainElementRetrieved = !isError(elementWithDeps);
        if (mainElementRetrieved) {
          const successRetrieve: [ElementDetails, ElementWithDependencies] = [
            elementDetails,
            elementWithDeps,
          ];
          return successRetrieve;
        }
        return undefined;
      })
      .filter(isDefined)
      .forEach(([elementDetails, elementWithDeps]) => {
        const dependencyErrors = elementWithDeps.dependencies
          .map((retrieveDependencyResult) => {
            const [, dependency] = retrieveDependencyResult;
            const dependencyWasRetrieved = !isError(dependency);
            if (dependencyWasRetrieved) return undefined;
            const error = dependency;
            return error;
          })
          .filter(isDefined);
        if (dependencyErrors.length) {
          logger.warn(
            `There were some issues during retrieving of the element ${elementDetails.element.name} dependencies.`,
            `There were some issues during retrieving of the element ${
              elementDetails.element.name
            } dependencies: ${JSON.stringify(
              dependencyErrors.map((error) => error.message)
            )}.`
          );
          dependencyErrors.forEach((dependencyError) => {
            reporter.sendTelemetryEvent({
              type: TelemetryEvents.ERROR,
              errorContext:
                TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED,
              status: DependencyRetrievalCompletedStatus.GENERIC_ERROR,
              error: dependencyError,
            });
          });
        }
      });
    const saveResults: ReadonlyArray<[ElementDetails, Error | vscode.Uri]> =
      await Promise.all(
        retrieveResults.map(async (retrieveResult) => {
          const [elementDetails, elementWithDeps] = retrieveResult;
          if (isError(elementWithDeps)) {
            return [elementDetails, elementWithDeps];
          }
          const successDependencies = elementWithDeps.dependencies
            .map((retrieveResult) => {
              const [element, dependency] = retrieveResult;
              const dependencyNotRetrieved = isError(dependency);
              if (dependencyNotRetrieved) {
                return undefined;
              }
              const successDependency: [Dependency, ElementContent] = [
                element,
                dependency,
              ];
              return successDependency;
            })
            .filter(isDefined);
          const saveResult = await saveIntoWorkspaceWithDependencies(
            workspaceUri
          )(
            elementDetails.serviceName,
            elementDetails.searchLocationName
          )({
            mainElement: {
              element: elementDetails.element,
              content: elementWithDeps.content,
            },
            dependencies: successDependencies,
          });
          if (isError(saveResult)) {
            const error = saveResult;
            return [
              elementDetails,
              new Error(
                `Unable to save the element ${elementDetails.element.name} into the file system because of error ${error.message}`
              ),
            ];
          }
          return [elementDetails, saveResult];
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
                    `Unable to show the element ${elementDetails.element.name} in the editor because of error ${error.message}`
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
    const errors: ReadonlyArray<[ElementDetails, Error]> = showResults
      .map(([elementDetails, result]) => {
        if (isError(result)) {
          const errorResult: [ElementDetails, Error] = [elementDetails, result];
          return errorResult;
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
        `There were some issues during retrieving of the elements ${elementNames}: ${[
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
    retrieveResults
      .map((retrieveResult) => {
        const [, elementWithDeps] = retrieveResult;
        const mainElementWasRetrieved = !isError(elementWithDeps);
        if (mainElementWasRetrieved) {
          return elementWithDeps;
        }
        return undefined;
      })
      .map((retrieveResult, index) => {
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
        return retrieveResult;
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
  serviceName: EndevorServiceName;
  searchLocationName: ElementLocationName;
  serviceInstance: ServiceInstance;
  element: Element;
  searchLocation: ElementSearchLocation;
}>;

const complexMultipleRetrieve =
  (dispatch: (action: Action) => Promise<void>) =>
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
  > => {
    const retrieveWithSignoutResult = await retrieveMultipleElementsWithSignout(
      validElementUris
    )(signoutChangeControlValue);
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
    genericErrorsAfterSignoutRetrieve.forEach(([_, error]) =>
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
    logger.warn(
      `Elements ${signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )} with their dependencies cannot be retrieved with signout because the elements are signed out to somebody else.`
    );
    signoutErrorsAfterSignoutRetrieve.forEach(() =>
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
      })
    );
    const overrideSignout = await askToOverrideSignOutForElements(
      signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )
    );
    if (!overrideSignout) {
      logger.trace(
        `Override signout option was not chosen, ${signoutErrorsAfterSignoutRetrieve.map(
          (elementDetails) => elementDetails.element.name
        )} copies will be retrieved.`
      );
      const signedOutElements = toSignedOutElementsPayload([
        ...successRetrievedElementsWithSignout.map(
          ([signedOutElement]) => signedOutElement
        ),
      ]);
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      const retrieveCopiesResult = await retrieveMultipleElementCopies(
        signoutErrorsAfterSignoutRetrieve
      );
      allErrors(retrieveCopiesResult).forEach(([_, error]) => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
      });
      withoutErrors(retrieveCopiesResult).forEach(() => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
        });
      });
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveCopiesResult,
      ];
    }
    logger.trace(
      `Override signout option was chosen, ${signoutErrorsAfterSignoutRetrieve.map(
        (elementDetails) => elementDetails.element.name
      )} will be retrieved with override signout.`
    );
    const retrieveWithOverrideSignoutResult =
      await retrieveMultipleElementsWithOverrideSignout(
        signoutErrorsAfterSignoutRetrieve
      )(signoutChangeControlValue);
    const successRetrievedElementsWithOverrideSignout = withoutErrors(
      retrieveWithOverrideSignoutResult
    );
    const notRetrievedElementsWithOverrideSignout = allErrors(
      retrieveWithOverrideSignoutResult
    );
    const secondAttemptWasSuccessful =
      !notRetrievedElementsWithOverrideSignout.length;
    if (secondAttemptWasSuccessful) {
      const signedOutElements = toSignedOutElementsPayload(
        [
          ...successRetrievedElementsWithSignout,
          ...successRetrievedElementsWithOverrideSignout,
        ].map(([signedOutElement]) => signedOutElement)
      );
      successRetrievedElementsWithOverrideSignout.forEach(() => {
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
          context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
        });
      });
      await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
      return [
        ...successRetrievedElementsWithSignout,
        ...genericErrorsAfterSignoutRetrieve,
        ...retrieveWithOverrideSignoutResult,
      ];
    }
    logger.warn(
      `Override signout retrieve was not successful, the copies of ${notRetrievedElementsWithOverrideSignout.map(
        ([elementDetails]) => elementDetails.element.name
      )} will be retrieved.`
    );
    const signedOutElements = toSignedOutElementsPayload(
      [
        ...successRetrievedElementsWithSignout,
        ...successRetrievedElementsWithOverrideSignout,
      ].map(([signedOutElement]) => signedOutElement)
    );
    await updateTreeAfterSuccessfulSignout(dispatch)(signedOutElements);
    const retrieveCopiesResult = await retrieveMultipleElementCopies(
      notRetrievedElementsWithOverrideSignout.map(
        ([elementDetails]) => elementDetails
      )
    );
    allErrors(retrieveCopiesResult).forEach(([_, error]) => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
        error,
      });
    });
    withoutErrors(retrieveCopiesResult).forEach(() => {
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS,
      });
    });
    return [
      ...successRetrievedElementsWithSignout,
      ...genericErrorsAfterSignoutRetrieve,
      ...successRetrievedElementsWithOverrideSignout,
      ...retrieveCopiesResult,
    ];
  };

const signoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
): ReadonlyArray<ElementDetails> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isSignoutError(retrieveResult)) {
        return elementDetails;
      }
      return undefined;
    })
    .filter(isDefined);
};

const genericErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult) && !isSignoutError(retrieveResult)) {
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          retrieveResult,
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const allErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
): ReadonlyArray<[ElementDetails, Error]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        const mappedValue: [ElementDetails, Error] = [
          elementDetails,
          retrieveResult,
        ];
        return mappedValue;
      }
      return undefined;
    })
    .filter(isDefined);
};

const withoutErrors = (
  input: ReadonlyArray<[ElementDetails, Error | ElementWithDependencies]>
): ReadonlyArray<[ElementDetails, ElementWithDependencies]> => {
  return input
    .map((result) => {
      const [elementDetails, retrieveResult] = result;
      if (isError(retrieveResult)) {
        return undefined;
      }
      const mappedValue: [ElementDetails, ElementWithDependencies] = [
        elementDetails,
        retrieveResult,
      ];
      return mappedValue;
    })
    .filter(isDefined);
};

const retrieveMultipleElementsWithSignout =
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<
      [ElementDetails, ElementWithDependencies | Error | SignoutError]
    >
  > => {
    const sequentialRetrieving = 1;
    return (
      await withNotificationProgress(
        `Retrieving elements: ${validElementUris
          .map((validElementUri) => validElementUri.element.name)
          .join(', ')} with signout and dependencies`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map(({ serviceInstance, element }) => {
            return async () => {
              return retrieveElementWithDependenciesWithSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )({
                service: serviceInstance.service,
                requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
              })(element)({ signoutChangeControlValue });
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

const retrieveMultipleElementsWithOverrideSignout =
  (validElementUris: ReadonlyArray<ElementDetails>) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<
    ReadonlyArray<[ElementDetails, ElementWithDependencies | Error]>
  > => {
    const sequentialRetrieving = 1;
    return (
      await withNotificationProgress(
        `Retrieving elements: ${validElementUris
          .map((validElementUri) => validElementUri.element.name)
          .join(', ')} with override signout and dependencies`
      )((progressReporter) => {
        return new PromisePool(
          validElementUris.map(({ serviceInstance, element }) => {
            return async () => {
              return retrieveElementWithDependenciesWithSignout(
                toSeveralTasksProgress(progressReporter)(
                  validElementUris.length
                )
              )({
                service: serviceInstance.service,
                requestPoolMaxSize: serviceInstance.requestPoolMaxSize,
              })(element)({ signoutChangeControlValue, overrideSignOut: true });
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
    const saveResult = await saveElementIntoWorkspace(workspaceUri)(
      serviceName,
      locationName
    )(element, elementContent);
    if (isError(saveResult)) {
      const error = saveResult;
      return error;
    }
    const savedFileUri = saveResult;
    return savedFileUri;
  };

const showElementInEditor = async (
  fileUri: vscode.Uri
): Promise<void | Error> => {
  const showResult = await showSavedElementContent(fileUri);
  if (isError(showResult)) {
    const error = showResult;
    return error;
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
  return signedOutElements.reduce((accum, signedOutElement) => {
    return {
      serviceName: signedOutElement.serviceName,
      service: signedOutElement.serviceInstance.service,
      searchLocationName: signedOutElement.searchLocationName,
      searchLocation: signedOutElement.searchLocation,
      elements: [...accum.elements, signedOutElement.element],
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
