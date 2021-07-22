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

import { logger } from './globals'; // this import has to be first, it initializes global state
import * as vscode from 'vscode';
import { DIFF_EDITOR_WHEN_CONTEXT_NAME, TREE_VIEW_ID } from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import {
  make as makeStore,
  getLocations as getStateLocations,
  getSystems as getStateSystems,
  getCredential,
} from './store/store';
import {
  watchForLocations,
  getLocations,
  getTempEditFolder,
  watchForEditFolder,
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
import { editElementCommand } from './commands/editElement';
import { uploadElementCommand } from './commands/uploadElement';
import { cleanTempEditDirectory } from './workspace';
import { getWorkspaceUri } from '@local/vscode-wrapper/workspace';
import { getEditFolderUri, isError } from './utils';
import { generateElementCommand } from './commands/generateElement';
import { listingContentProvider } from './view/listingContentProvider';
import { Actions } from './_doc/Actions';
import { State } from './_doc/Store';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from './_doc/settings';
import { Schemas } from './_doc/Uri';
import { readOnlyFileContentProvider } from './view/readOnlyFileContentProvider';
import { isEditedElementUri } from './uri/editedElementUri';
import { discardEditedElementChanges } from './commands/discardEditedElementChanges';
import { applyDiffEditorChanges } from './commands/applyDiffEditorChanges';

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
  } catch (error) {
    locations = [];
    logger.warn(
      `Unable to get valid Endevor locations from the settings.`,
      `Error when reading settings: ${error.message}.`
    );
  }
  return locations;
};

const getInitialTempDirPath = async (): Promise<string | undefined> => {
  const workspaceUri = await getWorkspaceUri();
  if (!workspaceUri) return;
  let tempEditFolderName;
  try {
    tempEditFolderName = getTempEditFolder();
  } catch (error) {
    logger.warn(
      `Unable to get valid edit folder name from the settings.`,
      `Error when reading settings: ${error.message}.`
    );
    return;
  }
  return getEditFolderUri(workspaceUri)(tempEditFolderName).fsPath;
};

const updateEditFolderWhenContext = (tempDirPath: string) => {
  vscode.commands.executeCommand('setContext', DIFF_EDITOR_WHEN_CONTEXT_NAME, [
    tempDirPath,
  ]);
};

const cleanEditFolderWhenContext = () => {
  vscode.commands.executeCommand(
    'setContext',
    DIFF_EDITOR_WHEN_CONTEXT_NAME,
    []
  );
};

export const activate: Extension['activate'] = async (context) => {
  logger.trace('Activation requested');
  await cleanTempDirectory();
  const treeChangeEmitter = new vscode.EventEmitter<Node | null>();
  let stateForTree: State = {
    credentials: {},
    locations: getInitialLocations(),
    elementTrees: [],
  };
  const refreshTree = (state: State) => {
    stateForTree = state;
    treeChangeEmitter.fire(null);
  };
  const selectLocations = () => getStateLocations(stateForTree);
  const selectSystems = (
    serviceName: EndevorServiceName,
    locationName: ElementLocationName
  ) => getStateSystems(stateForTree, serviceName, locationName);
  const selectCredential = (name: string) => getCredential(stateForTree, name);

  const dispatch = makeStore(stateForTree, refreshTree);
  const elmTreeProvider = makeElmTreeProvider(
    treeChangeEmitter,
    {
      selectLocations,
      selectSystems,
      selectCredential,
    },
    dispatch
  );

  const withErrorLogging = (commandId: string) => async <R>(
    task: Promise<R>
  ): Promise<R | void | undefined> => {
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

  const refresh = () => {
    const locations = [...getLocations()];
    dispatch({
      type: Actions.REFRESH,
      payload: locations,
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
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.PRINT_LISTING)(
          printListingCommand(elementNode, nodes)
        );
      },
    ],
    [
      CommandId.REFRESH_TREE_VIEW,
      refresh,
      () => {
        return withErrorLogging(CommandId.REFRESH_TREE_VIEW)(
          Promise.resolve(refresh())
        );
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
          addNewElementLocation(selectCredential, dispatch)(serviceNode)
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
      CommandId.GENERATE_ELEMENT,
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT)(
          generateElementCommand(elementNode, nodes)
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
          retrieveElementCommand(elementNode, nodes)
        );
      },
    ],
    [
      CommandId.RETRIEVE_WITH_DEPENDENCIES,
      (elementNode?: ElementNode, nodes?: ElementNode[]) => {
        return withErrorLogging(CommandId.RETRIEVE_WITH_DEPENDENCIES)(
          retrieveWithDependencies(elementNode, nodes)
        );
      },
    ],
    [
      CommandId.QUICK_EDIT_ELEMENT,
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.QUICK_EDIT_ELEMENT)(
          editElementCommand(elementNode, nodes)
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
          applyDiffEditorChanges(comparedElementUri)
        );
      },
    ],
  ] as const;

  const textDocumentSavedHandlers: ReadonlyArray<TextDocumentSavedHandler> = [
    {
      apply: (document) => {
        return withErrorLogging(CommandId.UPLOAD_ELEMENT)(
          uploadElementCommand(document.uri)
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
  const initialTempDirPath = await getInitialTempDirPath();
  if (initialTempDirPath) {
    updateEditFolderWhenContext(initialTempDirPath);
  }
  context.subscriptions.push(
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
    watchForEditFolder(async (action) => {
      if (action.type === Actions.EDIT_FOLDER_CHANGED) {
        const workspaceUri = await getWorkspaceUri();
        if (!workspaceUri) {
          logger.warn(
            'At least one workspace in this project should be opened to work with elements.',
            'There is no valid workspace to update when context values.'
          );
          cleanEditFolderWhenContext();
          return;
        }
        if (!action.payload) {
          logger.warn(
            'Unable to get a valid edit path from settings to work with elements.',
            'There is no valid edit folder path in the settings to update when context values.'
          );
          cleanEditFolderWhenContext();
          return;
        }
        updateEditFolderWhenContext(
          getEditFolderUri(workspaceUri)(action.payload).fsPath
        );
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) =>
      textDocumentSavedHandlers
        .filter((handler) => handler.isApplicable(document))
        .forEach(async (handler) => {
          await handler.apply(document);
        })
    )
  );
};

export const deactivate: Extension['deactivate'] = () => {
  logger.trace('Deactivation requested');
};

// because a vscode command can be an arbitrary function
// we have to resort to using `any` here
