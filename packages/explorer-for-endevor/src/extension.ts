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

import { logger, reporter } from './globals'; // this import has to be first, it initializes global state
import * as vscode from 'vscode';
import {
  AUTOMATIC_SIGN_OUT_DEFAULT,
  MAX_PARALLEL_REQUESTS_DEFAULT,
  TREE_VIEW_ID,
} from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import { make as makeStore, toState } from './store/store';
import {
  watchForLocations,
  getLocations,
  getTempEditFolder,
  watchForSettingChanges,
  isAutomaticSignOut,
  getMaxParallelRequests,
} from './settings/settings';
import {
  Extension,
  TextDocumentSavedHandler,
} from '@local/extension/_doc/Extension';
import { CommandId } from './commands/id';
import { printElement } from './commands/printElement';
import { printListingCommand } from './commands/printListing';
import { addNewService } from './commands/addNewService';
import {
  ElementNode,
  LocationNode,
  Node,
  ServiceNode,
} from './_doc/ElementTree';
import { addNewElementLocation } from './commands/addNewElementLocation';
import { hideElementLocation } from './commands/hideElementLocation';
import { hideService } from './commands/hideService';
import { viewElementDetails } from './commands/viewElementDetails';
import { retrieveElementCommand } from './commands/retrieveElement';
import { retrieveWithDependencies } from './commands/retrieveWithDependencies';
import { editElementCommand } from './commands/edit/editElementCommand';
import { uploadElementCommand } from './commands/uploadElement';
import { signOutElementCommand } from './commands/signOutElement';
import { signInElementCommand } from './commands/signInElement';
import { cleanTempEditDirectory } from './workspace';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import { isError } from './utils';
import { generateElementInPlaceCommand } from './commands/generateElementInPlace';
import { generateElementWithCopyBackCommand } from './commands/generateElementWithCopyBack';
import { listingContentProvider } from './view/listingContentProvider';
import { Actions } from './_doc/Actions';
import { State } from './_doc/Store';
import { LocationConfig } from './_doc/settings';
import { Schemas } from './_doc/Uri';
import { readOnlyFileContentProvider } from './view/readOnlyFileContentProvider';
import { isEditedElementUri } from './uri/editedElementUri';
import { discardEditedElementChanges } from './commands/discardEditedElementChanges';
import { applyDiffEditorChanges } from './commands/applyDiffEditorChanges';
import { addElementFromFileSystem } from './commands/addElementFromFileSystem';
import { TelemetryEvents } from './_doc/Telemetry';
import {
  resolveService,
  defineServiceResolutionOrder,
} from './services/services';
import {
  defineSearchLocationResolutionOrder,
  resolveSearchLocation,
} from './element-locations/elementLocations';

const cleanTempDirectory = async (): Promise<void> => {
  const workspace = await getWorkspaceUri();
  if (workspace) {
    let tempEditFolder;
    try {
      tempEditFolder = getTempEditFolder();
    } catch (e) {
      logger.warn(
        `Unable to get edit folder path from settings.`,
        `Error when reading settings: ${e.message}.`
      );
      return;
    }
    const result = await cleanTempEditDirectory(workspace)(tempEditFolder);
    if (isError(result)) {
      const error = result;
      logger.trace(
        `Cleaning edit files local directory: ${tempEditFolder} error: ${error.message}.`
      );
    }
  }
};

const getInitialLocations = () => {
  let locations: ReadonlyArray<LocationConfig>;
  try {
    locations = [...getLocations()];
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED,
      elementLocations: locations.map((location) => {
        return {
          elementLocationsAmount: location.elementLocations.length,
        };
      }),
    });
  } catch (error) {
    locations = [];
    logger.warn(
      `Unable to get valid Endevor locations from the settings.`,
      `Error when reading settings: ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      status: 'GENERIC_ERROR',
      errorContext: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED,
      error,
    });
  }
  return locations;
};

const getInitialAutoSignoutSetting = (): boolean => {
  try {
    return isAutomaticSignOut();
  } catch (e) {
    logger.warn(
      `Cannot read settings value for automatic sign out, default: ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead`,
      `Reading settings error: ${e.message}`
    );
    return AUTOMATIC_SIGN_OUT_DEFAULT;
  }
};

const getInitialMaxRequestsSetting = (): number => {
  try {
    return getMaxParallelRequests();
  } catch (e) {
    logger.warn(
      `Cannot read settings value for endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead`,
      `Reading settings error: ${e.message}`
    );
    return MAX_PARALLEL_REQUESTS_DEFAULT;
  }
};

export const activate: Extension['activate'] = async (context) => {
  logger.trace(
    `${context.extension.id} extension with the build number: ${__E4E_BUILD_NUMBER__} will be activated.`
  );
  await cleanTempDirectory();
  const treeChangeEmitter = new vscode.EventEmitter<Node | null>();
  let stateForTree: State = [];
  const refreshTree = (state: State, node?: Node) => {
    stateForTree = state;
    treeChangeEmitter.fire(node ?? null);
  };
  const getState = () => stateForTree;

  const dispatch = makeStore(toState(getInitialLocations()), refreshTree);

  const searchLocationResolver = resolveSearchLocation(
    defineSearchLocationResolutionOrder(getState, dispatch)
  );
  const serviceResolver = resolveService(
    defineServiceResolutionOrder(getState, dispatch)
  );

  const elmTreeProvider = makeElmTreeProvider(
    treeChangeEmitter,
    {
      getState,
      getService: serviceResolver,
      getSearchLocation: searchLocationResolver,
    },
    dispatch
  );

  const withErrorLogging =
    (commandId: string) =>
    async <R>(task: Promise<R>): Promise<R | void | undefined> => {
      try {
        return await task;
      } catch (e) {
        logger.error(
          `Error when running command ${commandId}. See log for more details.`,
          `Something went wrong with command: ${commandId} execution: ${e.message} with stack trace: ${e.stack}`
        );
        return;
      }
    };

  const refresh = async () => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.REFRESH_COMMAND_CALLED,
    });
    await dispatch({
      type: Actions.REFRESH,
    });
  };

  const commands = [
    [
      CommandId.PRINT_ELEMENT,
      (resourceUri: vscode.Uri) => {
        return withErrorLogging(CommandId.PRINT_ELEMENT)(
          printElement(resourceUri)
        );
      },
    ],
    [
      CommandId.PRINT_LISTING,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.PRINT_LISTING)(
          printListingCommand(elementNode)
        );
      },
    ],
    [
      CommandId.REFRESH_TREE_VIEW,
      refresh,
      () => {
        return withErrorLogging(CommandId.REFRESH_TREE_VIEW)(refresh());
      },
    ],
    [
      CommandId.ADD_NEW_SERVICE,
      () => {
        return withErrorLogging(CommandId.ADD_NEW_SERVICE)(addNewService());
      },
    ],
    [
      CommandId.ADD_NEW_ELEMENT_LOCATION,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.ADD_NEW_ELEMENT_LOCATION)(
          addNewElementLocation(serviceResolver)(serviceNode)
        );
      },
    ],
    [
      CommandId.HIDE_ELEMENT_LOCATION,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.HIDE_ELEMENT_LOCATION)(
          hideElementLocation(locationNode)
        );
      },
    ],
    [
      CommandId.HIDE_SERVICE,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.HIDE_SERVICE)(
          hideService(serviceNode)
        );
      },
    ],
    [
      CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
      (parentNode: LocationNode) => {
        return withErrorLogging(CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM)(
          addElementFromFileSystem(
            serviceResolver,
            searchLocationResolver,
            dispatch,
            parentNode
          )
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT)(
          generateElementInPlaceCommand(dispatch, elementNode)
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT_WITH_COPY_BACK)(
          generateElementWithCopyBackCommand(dispatch, elementNode, false)
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT_WITH_NO_SOURCE,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT_WITH_NO_SOURCE)(
          generateElementWithCopyBackCommand(dispatch, elementNode, true)
        );
      },
    ],
    [
      CommandId.VIEW_ELEMENT_DETAILS,
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.VIEW_ELEMENT_DETAILS)(
          Promise.resolve(viewElementDetails(elementNode, nodes))
        );
      },
    ],
    [
      CommandId.RETRIEVE_ELEMENT,
      (elementNode?: ElementNode, nodes?: ElementNode[]) => {
        return withErrorLogging(CommandId.RETRIEVE_ELEMENT)(
          retrieveElementCommand(dispatch, elementNode, nodes)
        );
      },
    ],
    [
      CommandId.RETRIEVE_WITH_DEPENDENCIES,
      (elementNode?: ElementNode, nodes?: ElementNode[]) => {
        return withErrorLogging(CommandId.RETRIEVE_WITH_DEPENDENCIES)(
          retrieveWithDependencies(dispatch, elementNode, nodes)
        );
      },
    ],
    [
      CommandId.QUICK_EDIT_ELEMENT,
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.QUICK_EDIT_ELEMENT)(
          editElementCommand(dispatch, elementNode, nodes)
        );
      },
    ],
    [
      CommandId.DISCARD_COMPARED_ELEMENT,
      (comparedElementUri?: vscode.Uri) => {
        return withErrorLogging(CommandId.DISCARD_COMPARED_ELEMENT)(
          discardEditedElementChanges(comparedElementUri)
        );
      },
    ],
    [
      CommandId.UPLOAD_COMPARED_ELEMENT,
      (comparedElementUri?: vscode.Uri) => {
        return withErrorLogging(CommandId.UPLOAD_COMPARED_ELEMENT)(
          applyDiffEditorChanges(dispatch, comparedElementUri)
        );
      },
    ],
    [
      CommandId.SIGN_OUT_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.SIGN_OUT_ELEMENT)(
          signOutElementCommand(dispatch, elementNode)
        );
      },
    ],
    [
      CommandId.SIGN_IN_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.SIGN_IN_ELEMENT)(
          signInElementCommand(dispatch, elementNode)
        );
      },
    ],
  ] as const;

  const textDocumentSavedHandlers: ReadonlyArray<TextDocumentSavedHandler> = [
    {
      apply: (document) => {
        return withErrorLogging(CommandId.UPLOAD_ELEMENT)(
          uploadElementCommand(dispatch, document.uri)
        );
      },
      isApplicable: (document) => {
        const uriValidationResult = isEditedElementUri(document.uri);
        if (uriValidationResult.valid) return true;
        logger.trace(
          `Element uri is not valid for uploading elements, because of: ${uriValidationResult.message}`
        );
        return false;
      },
    },
  ];
  context.subscriptions.push(
    reporter,
    vscode.window.createTreeView(TREE_VIEW_ID, {
      treeDataProvider: elmTreeProvider,
      canSelectMany: true,
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.TREE_ELEMENT,
      elementContentProvider
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.ELEMENT_LISTING,
      listingContentProvider
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.READ_ONLY_FILE,
      readOnlyFileContentProvider
    ),

    ...commands.map(([id, command]) =>
      vscode.commands.registerCommand(id, command)
    ),
    watchForLocations(dispatch),
    watchForSettingChanges(),
    vscode.workspace.onDidSaveTextDocument((document) =>
      textDocumentSavedHandlers
        .filter((handler) => handler.isApplicable(document))
        .forEach(async (handler) => {
          await handler.apply(document);
        })
    )
  );
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.EXTENSION_ACTIVATED,
    buildNumber: __E4E_BUILD_NUMBER__,
    autoSignOut: getInitialAutoSignoutSetting(),
    maxParallelRequests: getInitialMaxRequestsSetting(),
  });
};

export const deactivate: Extension['deactivate'] = () => {
  logger.trace('Deactivation requested');
};

// because a vscode command can be an arbitrary function
// we have to resort to using `any` here
