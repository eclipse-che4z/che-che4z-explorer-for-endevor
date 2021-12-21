/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import { TREE_VIEW_ID } from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import { make as makeStore, getCredential, toState } from './store/store';
import {
  watchForLocations,
  getLocations,
  getTempEditFolder,
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
import { generateElementCommand } from './commands/generateElement';
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

export const activate: Extension['activate'] = async (context) => {
  logger.trace('Activation requested');
  await cleanTempDirectory();
  const treeChangeEmitter = new vscode.EventEmitter<Node | null>();
  let stateForTree: State = [];
  const refreshTree = (state: State, node?: Node) => {
    stateForTree = state;
    treeChangeEmitter.fire(node ?? null);
  };
  const getState = () => stateForTree;
  const selectCredential = (name: string) => getCredential(stateForTree)(name);

  const dispatch = makeStore(toState(getInitialLocations()), refreshTree);
  const elmTreeProvider = makeElmTreeProvider(
    treeChangeEmitter,
    { getState },
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
      CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
      (parentNode: LocationNode) => {
        return withErrorLogging(CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM)(
          addElementFromFileSystem(selectCredential, dispatch, parentNode)
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT,
      (elementNode?: ElementNode, nodes?: Node[]) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT)(
          generateElementCommand(dispatch)(elementNode, nodes)
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
