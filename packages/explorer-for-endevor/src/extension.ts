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
  EDIT_DIR,
  TREE_VIEW_ID,
  EXT_VERSION,
  UNKNOWN_VERSION,
  ZE_API_MIN_VERSION,
} from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import {
  getAllServiceLocations,
  make as makeStore,
  getService,
  getValidUnusedSearchLocationDescriptionsForService,
  getValidUnusedServiceDescriptions,
  getAllServiceDescriptionsBySearchLocationId,
  getAllServiceNames,
  getAllSearchLocationNames,
} from './store/store';
import {
  watchForAutoSignoutChanges,
  watchForMaxEndevorRequestsChanges,
  watchForSyncProfilesChanges,
  isAutomaticSignOut,
  getMaxParallelRequests,
  isSyncWithProfiles,
  watchForFileExtensionResolutionChanges,
} from './settings/settings';
import {
  Extension,
  TextDocumentSavedHandler,
} from '@local/extension/_doc/Extension';
import { CommandId } from './commands/id';
import { printElement } from './commands/printElement';
import { printListingCommand } from './commands/printListing';
import { addNewService } from './commands/addNewService';
import { ElementNode } from './tree/_doc/ElementTree';
import { addNewSearchLocation } from './commands/addNewSearchLocation';
import { hideSearchLocation } from './commands/hideSearchLocation';
import { hideService } from './commands/hideService';
import { viewElementDetails } from './commands/viewElementDetails';
import { retrieveElementCommand } from './commands/retrieveElement';
import { retrieveWithDependencies } from './commands/retrieveWithDependencies';
import { editElementCommand } from './commands/edit/editElementCommand';
import { uploadElementCommand } from './commands/uploadElement';
import { signOutElementCommand } from './commands/signOutElement';
import { signInElementCommand } from './commands/signInElement';
import { isError, joinUri } from './utils';
import { generateElementInPlaceCommand } from './commands/generateElementInPlace';
import { generateElementWithCopyBackCommand } from './commands/generateElementWithCopyBack';
import { listingContentProvider } from './view/listingContentProvider';
import { Actions } from './store/_doc/Actions';
import { State } from './store/_doc/v2/Store';
import { Schemas } from './_doc/Uri';
import { readOnlyFileContentProvider } from './view/readOnlyFileContentProvider';
import { isEditedElementUri } from './uri/editedElementUri';
import { discardEditedElementChanges } from './commands/discardEditedElementChanges';
import { applyDiffEditorChanges } from './commands/applyDiffEditorChanges';
import { addElementFromFileSystem } from './commands/addElementFromFileSystem';
import { TelemetryEvents as V2TelemetryEvents } from './_doc/telemetry/v2/Telemetry';
import { TelemetryEvents as V1TelemetryEvents } from './_doc/Telemetry';
import { deleteDirectoryWithContent } from '@local/vscode-wrapper/workspace';
import {
  createConnectionLocationsStorage,
  createConnectionsStorage,
  createCredentialsStorage,
  createInventoryLocationsStorage,
  createSettingsStorage,
} from './store/storage/storage';
import {
  ConnectionLocationsStorage,
  SettingsStorage,
} from './store/storage/_doc/Storage';
import {
  defineEndevorCacheResolver,
  defineSearchLocationResolutionOrder,
  defineServiceResolutionOrder,
  resolveEndevorCache,
  resolveSearchLocation,
  resolveService,
} from './store/resolvers';
import {
  LocationNode,
  ServiceNode,
  Node,
} from './tree/_doc/ServiceLocationTree';
import { migrateConnectionLocationsFromSettings } from './store/storage/migrate';
import { deleteSearchLocation } from './commands/deleteSearchLocation';
import { deleteService } from './commands/deleteService';
import { submitExtensionIssue } from './commands/submitExtensionIssue';
import { ProfileStore } from './store/profiles/_doc/ProfileStore';
import { ProfileTypes } from './store/profiles/_ext/Profile';
import { isProfileStoreError } from './store/profiles/_doc/Error';
import { profilesStoreFromZoweExplorer } from './store/profiles/profiles';

const cleanTempDirectory = async (
  tempEditFolderUri: vscode.Uri
): Promise<void> => {
  try {
    await deleteDirectoryWithContent(tempEditFolderUri);
  } catch (error) {
    logger.trace(
      `Unable to clean edit files temp directory because of error: ${error.message}.`
    );
  }
};

const getExtensionVersionFromSettings = async (
  getSettingsStorage: () => SettingsStorage
) => {
  const settings = await getSettingsStorage().get();
  if (isError(settings)) {
    const error = settings;
    logger.error(
      `Unable to retrieve the extension version.`,
      `Unable to get the extension version from the settings storage because of: ${error.message}.`
    );
    return error;
  }
  if (settings.version !== EXT_VERSION) {
    const storeResult = getSettingsStorage().store({ version: EXT_VERSION });
    if (isError(storeResult)) {
      const error = storeResult;
      logger.warn(
        'Unable to store the latest extension version to the settings.',
        `Unable to store the latest extension version to the settings storage because of: ${error.message}.`
      );
    }
  }
  return settings.version;
};

export const migrateConnectionLocations =
  (getConnectionLocationsStorage: () => ConnectionLocationsStorage) =>
  async (extensionVersion: string): Promise<void | Error> => {
    if (extensionVersion !== UNKNOWN_VERSION) return;
    const profilesMigrationResult =
      await migrateConnectionLocationsFromSettings(
        getConnectionLocationsStorage
      );
    if (isError(profilesMigrationResult)) {
      const error = profilesMigrationResult;
      logger.error(
        `Unable to migrate settings from previous version. Use 'Migrate services/search locations from previous version' command from the Command Palette to retry.`,
        `Unable to merge the previous settings into the internal storage because of ${error.message}.`
      );
    }
    return;
  };

export const initializeProfilesStore = async (): Promise<
  ProfileStore | undefined
> => {
  if (!isSyncWithProfiles()) return;
  const profilesStore = await profilesStoreFromZoweExplorer([
    ProfileTypes.ENDEVOR,
    ProfileTypes.ENDEVOR_LOCATION,
  ])(ZE_API_MIN_VERSION);
  if (isProfileStoreError(profilesStore)) {
    const error = profilesStore;
    logger.error(
      'Unable to initialize Zowe API. Zowe profiles will not be available in this session.',
      `${error.message}.`
    );
    return;
  }
  return profilesStore;
};

export const activate: Extension['activate'] = async (context) => {
  logger.trace(
    `${context.extension.id} extension with the build number: ${__E4E_BUILD_NUMBER__} will be activated.`
  );
  logger.trace(vscode.env.machineId);

  const tempEditFolderUri = joinUri(context.globalStorageUri)(EDIT_DIR);
  await cleanTempDirectory(tempEditFolderUri);
  const getTempEditFolderUri = () => tempEditFolderUri;

  const treeChangeEmitter = new vscode.EventEmitter<Node | null>();
  let stateForTree: State = {
    caches: {},
    services: {},
    sessions: {},
    searchLocations: {},
    serviceLocations: {},
  };
  const refreshTree = (_node?: Node) => treeChangeEmitter.fire(null);

  const getState = () => stateForTree;

  // use global storages to store the settings for now
  const stateStorage = context.globalState;
  const secretStorage = context.secrets;

  const profilesStore = await initializeProfilesStore();

  const connectionLocationsStorage =
    createConnectionLocationsStorage(stateStorage);
  const getConnectionLocationsStorage = () => connectionLocationsStorage;

  const connectionsStorage = await createConnectionsStorage(stateStorage)(
    profilesStore
  );
  const getConnectionsStorage = () => connectionsStorage;

  const inventoryLocationsStorage = await createInventoryLocationsStorage(
    stateStorage
  )(profilesStore);
  const getInventoryLocationsStorage = () => inventoryLocationsStorage;

  const credentialsStorage = await createCredentialsStorage(secretStorage)(
    profilesStore
  );
  const getCredentialsStorage = () => credentialsStorage;

  const settingsStorage = createSettingsStorage(stateStorage);
  const getSettingsStorage = () => settingsStorage;

  const extensionVersion = await getExtensionVersionFromSettings(
    getSettingsStorage
  );
  if (!isError(extensionVersion)) {
    await migrateConnectionLocations(() => connectionLocationsStorage)(
      extensionVersion
    );
  }

  const dispatch = await makeStore({
    getConnectionLocationsStorage,
    getConnectionsStorage,
    getInventoryLocationsStorage,
    getCredentialsStorage,
  })(
    () => stateForTree,
    refreshTree,
    (state) => {
      stateForTree = state;
      return;
    }
  );

  const serviceResolver = resolveService(
    defineServiceResolutionOrder(getState, dispatch)
  );
  const searchLocationResolver = resolveSearchLocation(
    defineSearchLocationResolutionOrder(getState)
  );

  const cacheResolver = resolveEndevorCache(
    defineEndevorCacheResolver(
      getState,
      serviceResolver,
      (serviceId) => (searchLocationId) =>
        searchLocationResolver(serviceId, searchLocationId),
      dispatch
    )
  );
  const treeProvider = makeElmTreeProvider(treeChangeEmitter, {
    getServiceLocations: () => getAllServiceLocations(getState),
    getService: serviceResolver,
    getSearchLocation: (serviceId) => (searchLocationId) =>
      searchLocationResolver(serviceId, searchLocationId),
    getEndevorCache: (serviceId) => (searchLocationId) =>
      cacheResolver(serviceId, searchLocationId),
  });

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
      type: V1TelemetryEvents.REFRESH_COMMAND_CALLED,
    });
    await dispatch({
      type: Actions.REFRESH,
    });
  };

  const editElement = editElementCommand({
    dispatch,
    getTempEditFolderUri,
  });

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
    [CommandId.REFRESH_TREE_VIEW, refresh],
    [CommandId.SUBMIT_ISSUE, submitExtensionIssue],
    [
      CommandId.ADD_NEW_SERVICE,
      () => {
        return withErrorLogging(CommandId.ADD_NEW_SERVICE)(
          addNewService(
            {
              getValidUnusedServiceDescriptions: () =>
                getValidUnusedServiceDescriptions(getState),
              getAllServiceNames: () => getAllServiceNames(getState),
            },
            dispatch
          )
        );
      },
    ],
    [
      CommandId.ADD_NEW_SEARCH_LOCATION,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.ADD_NEW_SEARCH_LOCATION)(
          addNewSearchLocation(
            {
              getSearchLocationNames: () => getAllSearchLocationNames(getState),
              getValidUnusedSearchLocationDescriptionsForService:
                getValidUnusedSearchLocationDescriptionsForService(getState),
              getServiceDescriptionsBySearchLocationId:
                getAllServiceDescriptionsBySearchLocationId(getState),
              getServiceById: getService(getState),
            },
            dispatch
          )(serviceNode)
        );
      },
    ],
    [
      CommandId.HIDE_SEARCH_LOCATION,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.HIDE_SEARCH_LOCATION)(
          hideSearchLocation(dispatch)(locationNode)
        );
      },
    ],
    [
      CommandId.HIDE_SERVICE,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.HIDE_SERVICE)(
          hideService(dispatch)(serviceNode)
        );
      },
    ],
    [
      CommandId.DELETE_SEARCH_LOCATION,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.DELETE_SEARCH_LOCATION)(
          deleteSearchLocation(
            {
              getServiceDescriptionsBySearchLocationId:
                getAllServiceDescriptionsBySearchLocationId(getState),
            },
            dispatch
          )(locationNode)
        );
      },
    ],
    [
      CommandId.DELETE_SERVICE,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.DELETE_SERVICE)(
          deleteService(dispatch)(serviceNode)
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
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.QUICK_EDIT_ELEMENT)(
          editElement(elementNode)
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
          signOutElementCommand(dispatch)(elementNode)
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
    [
      CommandId.CLEANUP_STORAGE,
      () => {
        return withErrorLogging(CommandId.CLEANUP_STORAGE)(
          (async () => {
            logger.trace(`Cleanup persistence storage command was called.`);
            const connections = await getConnectionsStorage().get();
            if (!isError(connections)) {
              Object.values(connections).forEach(async (connection) => {
                await getCredentialsStorage().delete(connection.id);
              });
            }
            await getConnectionLocationsStorage().delete();
            await getConnectionsStorage().delete();
            await getInventoryLocationsStorage().delete();
            await getSettingsStorage().delete();
            dispatch({
              type: Actions.REFRESH,
            });
          })()
        );
      },
    ],
    [
      CommandId.MIGRATE_LOCATIONS,
      () => {
        return withErrorLogging(CommandId.MIGRATE_LOCATIONS)(
          (async () => {
            logger.trace(`Location migration command was called.`);
            await migrateConnectionLocations(() => connectionLocationsStorage)(
              UNKNOWN_VERSION
            );
            dispatch({ type: Actions.REFRESH });
          })()
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
      treeDataProvider: treeProvider,
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
    watchForAutoSignoutChanges(),
    watchForMaxEndevorRequestsChanges(),
    watchForSyncProfilesChanges(),
    watchForFileExtensionResolutionChanges(),
    vscode.workspace.onDidSaveTextDocument((document) =>
      textDocumentSavedHandlers
        .filter((handler) => handler.isApplicable(document))
        .forEach(async (handler) => {
          await handler.apply(document);
        })
    )
  );
  reporter.sendTelemetryEvent({
    type: V2TelemetryEvents.EXTENSION_ACTIVATED,
    buildNumber: __E4E_BUILD_NUMBER__,
    autoSignOut: isAutomaticSignOut(),
    maxParallelRequests: getMaxParallelRequests(),
    syncWithProfiles: isSyncWithProfiles(),
  });
};

export const deactivate: Extension['deactivate'] = () => {
  logger.trace('Deactivation requested');
};

// because a vscode command can be an arbitrary function
// we have to resort to using `any` here
