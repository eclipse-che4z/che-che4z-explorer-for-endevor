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
import { SectionChange } from '@local/vscode-wrapper/_doc/workspace';
import * as vscode from 'vscode';
import {
  EDIT_DIR,
  TREE_VIEW_ID,
  EXT_VERSION,
  UNKNOWN_VERSION,
  ZE_API_MIN_VERSION,
  SCM_ID,
  SCM_CHANGES_GROUP_ID,
  SCM_CHANGES_GROUP_LABEL,
  SCM_LABEL,
  SCM_STATUS_CONTEXT_NAME,
  EXT_ACTIVATED_WHEN_CONTEXT_NAME,
  SCM_MERGE_CHANGES_GROUP_LABEL,
  SCM_MERGE_CHANGES_GROUP_ID,
} from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import {
  getAllServiceLocations,
  make as makeStore,
  getValidUnusedSearchLocationDescriptionsForService,
  getExistingUnusedServiceDescriptions,
  getAllServiceDescriptionsBySearchLocationId,
  getAllServiceNames,
  getAllSearchLocationNames,
  getAllValidSearchLocationDescriptions,
  getAllExistingServiceDescriptions,
  getExistingUsedServiceDescriptions,
  getEndevorConnectionDetails,
} from './store/store';
import {
  watchForAutoSignoutChanges,
  watchForMaxEndevorRequestsChanges,
  watchForSyncProfilesChanges,
  isAutomaticSignOut,
  getMaxParallelRequests,
  isSyncWithProfiles,
  watchForFileExtensionResolutionChanges,
  isWorkspaceSync,
  watchForWorkspaceSyncChanges,
  getFileExtensionResolution,
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
import {
  EndevorConfiguration,
  EndevorConnection,
  EndevorCredential,
  State,
  ValidEndevorConnection,
} from './store/_doc/v2/Store';
import { Schemas } from './_doc/Uri';
import { readOnlyFileContentProvider } from './view/readOnlyFileContentProvider';
import { isEditedElementUri } from './uri/editedElementUri';
import { discardEditedElementChanges } from './commands/discardEditedElementChanges';
import { applyDiffEditorChanges } from './commands/applyDiffEditorChanges';
import { addElementFromFileSystem } from './commands/addElementFromFileSystem';
import { TelemetryEvents as V2TelemetryEvents } from './_doc/telemetry/v2/Telemetry';
import { TelemetryEvents as V1TelemetryEvents } from './_doc/Telemetry';
import {
  deleteDirectoryWithContent,
  getWorkspaceUri,
} from '@local/vscode-wrapper/workspace';
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
  defineValidCredentialsResolutionOrder,
  defineEndevorCacheResolver,
  defineEndevorConfigurationResolutionOrder,
  defineSearchLocationResolutionOrder,
  defineValidConnectionDetailsResolutionOrder,
  resolveValidCredentials,
  resolveEndevorCache,
  resolveEndevorConfiguration,
  resolveSearchLocation,
  resolveValidConnectionDetails,
  resolveAnyConnectionDetails,
  // defineAnyConnectionDetailsResolutionOrder,
  resolveAnyCredentials,
  defineAnyCredentialsResolutionOrder,
  defineAnyConnectionDetailsResolutionOrder,
} from './store/resolvers';
import {
  LocationNode,
  ServiceNode,
  Node,
  ValidServiceNode,
  InvalidLocationNode,
} from './tree/_doc/ServiceLocationTree';
import { migrateConnectionLocationsFromSettings } from './store/storage/migrate';
import { deleteSearchLocation } from './commands/deleteSearchLocation';
import { deleteService } from './commands/deleteService';
import { submitExtensionIssue } from './commands/submitExtensionIssue';
import { ProfileStore } from '@local/profiles/_doc/ProfileStore';
import { ProfileTypes } from '@local/profiles/_ext/Profile';
import { isProfileStoreError } from '@local/profiles/_doc/Error';
import { profilesStoreFromZoweExplorer } from '@local/profiles/profiles';
import { cachedElementContentProvider } from './view/cachedElementContentProvider';
import {
  State as ScmState,
  ScmStatus,
  WorkspaceElementType,
} from './store/scm/_doc/Workspace';
import {
  getElementOriginalVersionForFile,
  getElementOriginalVersions,
  getWorkspaceChangeForFile,
  getAllWorkspaceChanges,
  make as makeScmStore,
  getNonConflictedWorkspaceChangeForFile,
} from './store/scm/store';
import {
  makeFileExplorerDecorationProvider,
  makeQuickDiffProvider,
  scmTreeProvider,
} from './tree/scmProvider';
import { isWorkspace as isEndevorWorkspace } from './store/scm/workspace';
import { watchForFiles, watchForMetadataChanges } from './store/scm/watchers';
import { initWorkspace } from './commands/sync/initWorkspace';
import { syncWorkspace } from './commands/sync/syncWorkspace';
import {
  focusOnView,
  reloadWindow,
  setContextVariable,
} from '@local/vscode-wrapper/window';
import { discardChangesCommand } from './commands/sync/discardChanges';
import { revertSectionChangeCommand } from './commands/sync/revertSectionChange';
import { toCachedElementUri } from './uri/cachedElementUri';
import { SyncAction, SyncActions } from './store/scm/_doc/Actions';
import { editCredentials } from './commands/editCredentials';
import { pullFromEndevorCommand } from './commands/sync/pullFromEndevor';
import { editConnectionDetails } from './commands/editConnectionDetails';
import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';
import { openElementCommand } from './commands/sync/openElement';
import { testConnectionDetails } from './commands/testConnectionDetails';
import { showModifiedElementCommand } from './commands/sync/showModifiedElement';
import { showDeletedElementCommand } from './commands/sync/showDeletedElement';
import { showAddedElementCommand } from './commands/sync/showAddedElement';
import { confirmConflictResolutionCommand } from './commands/sync/confirmConflictResolution';
import { showConflictedElementCommand } from './commands/sync/showConflictedElement';

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
  const profilesStore = await profilesStoreFromZoweExplorer(logger)([
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
  const refreshTree = (_node?: Node) => {
    treeChangeEmitter.fire(null);
  };

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

  const connectionDetailsResolver = resolveValidConnectionDetails(
    defineValidConnectionDetailsResolutionOrder(getState, dispatch)
  );
  const credentialsResolver = (
    connection: ValidEndevorConnection,
    configuration: EndevorConfiguration
  ) =>
    resolveValidCredentials(
      defineValidCredentialsResolutionOrder(
        getState,
        dispatch,
        connection,
        configuration
      )
    );
  const endevorConfigurationResolver = resolveEndevorConfiguration(
    defineEndevorConfigurationResolutionOrder(getState)
  );
  const searchLocationResolver = resolveSearchLocation(
    defineSearchLocationResolutionOrder(getState)
  );

  const cacheResolver = (
    connection: EndevorConnection,
    configuration: EndevorConfiguration,
    credential: EndevorCredential,
    elementsSearchLocation: Omit<ElementSearchLocation, 'configuration'>
  ) =>
    resolveEndevorCache(
      defineEndevorCacheResolver(
        getState,
        connection,
        configuration,
        credential,
        elementsSearchLocation,
        dispatch
      )
    );
  const treeProvider = makeElmTreeProvider(treeChangeEmitter, {
    getServiceLocations: () => getAllServiceLocations(getState),
    getConnectionDetails: resolveAnyConnectionDetails(
      defineAnyConnectionDetailsResolutionOrder(getState)
    ),
    getCredential: resolveAnyCredentials(
      defineAnyCredentialsResolutionOrder(getState)
    ),
    getEndevorConfiguration: endevorConfigurationResolver,
    getSearchLocation: searchLocationResolver,
    getEndevorCache: cacheResolver,
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
    dispatch({
      type: Actions.REFRESH,
    });
    await focusOnView(TREE_VIEW_ID);
  };

  const editElement = editElementCommand({
    dispatch,
    getTempEditFolderUri,
  });

  const commands = [
    [
      CommandId.EDIT_CREDENTIALS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.EDIT_CREDENTIALS)(
          editCredentials(
            endevorConfigurationResolver,
            connectionDetailsResolver,
            dispatch
          )(invalidLocationNode)
        );
      },
    ],
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
      CommandId.ADD_SERVICE_AND_LOCATION,
      () => {
        return withErrorLogging(CommandId.ADD_SERVICE_AND_LOCATION)(
          (async () => {
            const serviceId = await addNewService(
              {
                getValidServiceDescriptions: () =>
                  getExistingUnusedServiceDescriptions(getState),
                getAllServiceNames: () => getAllServiceNames(getState),
              },
              dispatch
            );
            if (serviceId) {
              return addNewSearchLocation(
                {
                  getSearchLocationNames: () =>
                    getAllSearchLocationNames(getState),
                  getValidSearchLocationDescriptionsForService:
                    getValidUnusedSearchLocationDescriptionsForService(
                      getState
                    ),
                  getServiceDescriptionsBySearchLocationId:
                    getAllServiceDescriptionsBySearchLocationId(getState),
                  getConnectionDetails: connectionDetailsResolver,
                  getValidUsedServiceDescriptions: () =>
                    getExistingUsedServiceDescriptions(getState),
                },
                dispatch
              )(serviceId);
            }
          })()
        );
      },
    ],
    [
      CommandId.ADD_NEW_SERVICE,
      () => {
        return withErrorLogging(CommandId.ADD_NEW_SERVICE)(
          addNewService(
            {
              getValidServiceDescriptions: () =>
                getExistingUnusedServiceDescriptions(getState),
              getAllServiceNames: () => getAllServiceNames(getState),
            },
            dispatch
          )
        );
      },
    ],
    [
      CommandId.ADD_NEW_SEARCH_LOCATION,
      (serviceNode?: ValidServiceNode) => {
        return withErrorLogging(CommandId.ADD_NEW_SEARCH_LOCATION)(
          addNewSearchLocation(
            {
              getSearchLocationNames: () => getAllSearchLocationNames(getState),
              getValidSearchLocationDescriptionsForService:
                getValidUnusedSearchLocationDescriptionsForService(getState),
              getServiceDescriptionsBySearchLocationId:
                getAllServiceDescriptionsBySearchLocationId(getState),
              getConnectionDetails: connectionDetailsResolver,
              getValidUsedServiceDescriptions: () =>
                getExistingUsedServiceDescriptions(getState),
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
            connectionDetailsResolver,
            endevorConfigurationResolver,
            credentialsResolver,
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
            await reloadWindow();
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
            await reloadWindow();
          })()
        );
      },
    ],
    [CommandId.INIT_WORKSPACE, initWorkspace],
    [
      CommandId.EDIT_CONNECTION_DETAILS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.EDIT_CONNECTION_DETAILS)(
          editConnectionDetails(
            getEndevorConnectionDetails(getState),
            dispatch
          )(invalidLocationNode)
        );
      },
    ],
    [
      CommandId.TEST_CONNECTION_DETAILS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.TEST_CONNECTION_DETAILS)(
          testConnectionDetails(
            getEndevorConnectionDetails(getState),
            dispatch
          )(invalidLocationNode)
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
    watchForWorkspaceSyncChanges(),
    watchForFileExtensionResolutionChanges(),
    vscode.workspace.onDidSaveTextDocument((document) =>
      textDocumentSavedHandlers
        .filter((handler) => handler.isApplicable(document))
        .forEach(async (handler) => {
          await handler.apply(document);
        })
    )
  );

  const isWorkspaceSyncEnabled = isWorkspaceSync();
  if (isWorkspaceSyncEnabled) {
    setContextVariable(SCM_STATUS_CONTEXT_NAME, ScmStatus.UNKNOWN);
    const folderUri = await getWorkspaceUri();
    if (folderUri && isEndevorWorkspace(folderUri)) {
      const endevorSourceControl = vscode.scm.createSourceControl(
        SCM_ID,
        SCM_LABEL,
        folderUri
      );
      // hide scm common input box for now
      endevorSourceControl.inputBox.visible = false;
      const endevorMergeChangesResourceGroup =
        endevorSourceControl.createResourceGroup(
          SCM_MERGE_CHANGES_GROUP_ID,
          SCM_MERGE_CHANGES_GROUP_LABEL
        );

      endevorMergeChangesResourceGroup.hideWhenEmpty = true;
      const endevorChangesResourceGroup =
        endevorSourceControl.createResourceGroup(
          SCM_CHANGES_GROUP_ID,
          SCM_CHANGES_GROUP_LABEL
        );
      endevorChangesResourceGroup.hideWhenEmpty = true;
      let scmState: ScmState = [];
      const getScmState = () => scmState;
      const updateScmState = (state: ScmState) => {
        scmState = state;
      };
      const fileExplorerChangeEmitter = new vscode.EventEmitter<undefined>();
      const fileExplorerDecorationProvider = makeFileExplorerDecorationProvider(
        fileExplorerChangeEmitter,
        getWorkspaceChangeForFile(getScmState)
      );
      const originalCacheVersionChangeEmitter =
        new vscode.EventEmitter<vscode.Uri>();
      const renderScmUI = (action?: SyncAction) => {
        scmTreeProvider([
          {
            group: endevorMergeChangesResourceGroup,
            changeTypes: [WorkspaceElementType.ELEMENT_CONFLICTED],
          },
          {
            group: endevorChangesResourceGroup,
            changeTypes: [
              WorkspaceElementType.ELEMENT_ADDED,
              WorkspaceElementType.ELEMENT_MODIFIED,
              WorkspaceElementType.ELEMENT_REMOVED,
            ],
          },
        ])(() => getAllWorkspaceChanges(getScmState));
        fileExplorerChangeEmitter.fire(undefined);
        if (
          action?.type === SyncActions.WORKSPACE_SYNCED ||
          action?.type === SyncActions.WORKSPACE_SYNCED_ONEWAY
        ) {
          getElementOriginalVersions(getScmState).forEach(
            (workspaceElement) => {
              originalCacheVersionChangeEmitter.fire(
                toCachedElementUri(workspaceElement.workspaceElementUri)
              );
            }
          );
          return;
        }
      };
      endevorSourceControl.quickDiffProvider = makeQuickDiffProvider(
        getElementOriginalVersionForFile(getScmState)
      );
      const scmDispatch = await makeScmStore(
        renderScmUI,
        updateScmState
      )(folderUri);
      context.subscriptions.push(
        watchForFiles(folderUri)(scmDispatch),
        watchForMetadataChanges(folderUri)(scmDispatch),
        endevorSourceControl,
        endevorChangesResourceGroup,
        vscode.window.registerFileDecorationProvider(
          fileExplorerDecorationProvider
        ),
        vscode.workspace.registerTextDocumentContentProvider(
          Schemas.READ_ONLY_CACHED_ELEMENT,
          cachedElementContentProvider(
            getElementOriginalVersionForFile(getScmState),
            originalCacheVersionChangeEmitter.event
          )
        )
      );
      const scmCommands = [
        [
          CommandId.SYNC_WORKSPACE,
          () => {
            return withErrorLogging(CommandId.SYNC_WORKSPACE)(
              syncWorkspace(
                {
                  getValidServiceDescriptions: () =>
                    getAllExistingServiceDescriptions(getState),
                  getValidSearchLocationDescriptions: () =>
                    getAllValidSearchLocationDescriptions(getState),
                  getConnectionDetails: connectionDetailsResolver,
                  getEndevorConfiguration: endevorConfigurationResolver,
                  getCredential: credentialsResolver,
                  getSearchLocation: searchLocationResolver,
                },
                scmDispatch
              )
            );
          },
        ],
        [
          CommandId.PULL_FROM_ENDEVOR,
          () => {
            return withErrorLogging(CommandId.PULL_FROM_ENDEVOR)(
              pullFromEndevorCommand(
                {
                  getValidServiceDescriptions: () =>
                    getAllExistingServiceDescriptions(getState),
                  getValidSearchLocationDescriptions: () =>
                    getAllValidSearchLocationDescriptions(getState),
                  getConnectionDetails: connectionDetailsResolver,
                  getEndevorConfiguration: endevorConfigurationResolver,
                  getCredential: credentialsResolver,
                  getElementLocation: searchLocationResolver,
                },
                scmDispatch
              )
            );
          },
        ],
        [
          CommandId.SHOW_ADDED_ELEMENT,
          (resourceUri: vscode.Uri) => {
            return withErrorLogging(CommandId.SHOW_ADDED_ELEMENT)(
              showAddedElementCommand(resourceUri)
            );
          },
        ],
        [
          CommandId.SHOW_DELETED_ELEMENT,
          (resourceUri: vscode.Uri) => {
            return withErrorLogging(CommandId.SHOW_DELETED_ELEMENT)(
              showDeletedElementCommand(resourceUri)
            );
          },
        ],
        [
          CommandId.SHOW_MODIFIED_ELEMENT,
          (resourceUri: vscode.Uri) => {
            return withErrorLogging(CommandId.SHOW_MODIFIED_ELEMENT)(
              showModifiedElementCommand(resourceUri)
            );
          },
        ],
        [
          CommandId.SHOW_CONFLICTED_ELEMENT,
          (resourceUri: vscode.Uri) => {
            return withErrorLogging(CommandId.SHOW_CONFLICTED_ELEMENT)(
              showConflictedElementCommand(resourceUri)
            );
          },
        ],
        [
          CommandId.OPEN_ELEMENT,
          (...resourceStates: vscode.SourceControlResourceState[]) => {
            return withErrorLogging(CommandId.OPEN_ELEMENT)(
              openElementCommand(resourceStates)
            );
          },
        ],
        [
          CommandId.DISCARD_CHANGES,
          (...resourceStates: vscode.SourceControlResourceState[]) => {
            return withErrorLogging(CommandId.DISCARD_CHANGES)(
              discardChangesCommand(
                getNonConflictedWorkspaceChangeForFile(getScmState)
              )(scmDispatch)(resourceStates)
            );
          },
        ],
        [
          CommandId.DISCARD_ALL_CHANGES,
          (resourceGroup: vscode.SourceControlResourceGroup) => {
            return withErrorLogging(CommandId.DISCARD_ALL_CHANGES)(
              discardChangesCommand(
                getNonConflictedWorkspaceChangeForFile(getScmState)
              )(scmDispatch)(resourceGroup.resourceStates)
            );
          },
        ],
        [
          CommandId.REVERT_SECTION_CHANGE,
          (
            elementUri: vscode.Uri,
            sectionChanges: SectionChange[],
            changeIndex: number
          ) => {
            return withErrorLogging(CommandId.REVERT_SECTION_CHANGE)(
              revertSectionChangeCommand(
                elementUri,
                sectionChanges,
                changeIndex
              )
            );
          },
        ],
        [
          CommandId.CONFIRM_CONFLICT_RESOLUTION,
          (...resourceStates: vscode.SourceControlResourceState[]) => {
            return withErrorLogging(CommandId.CONFIRM_CONFLICT_RESOLUTION)(
              confirmConflictResolutionCommand(scmDispatch)(resourceStates)
            );
          },
        ],
        [
          CommandId.CONFIRM_ALL_CONFLICT_RESOLUTIONS,
          (resourceGroup: vscode.SourceControlResourceGroup) => {
            return withErrorLogging(CommandId.CONFIRM_ALL_CONFLICT_RESOLUTIONS)(
              confirmConflictResolutionCommand(scmDispatch)(
                resourceGroup.resourceStates
              )
            );
          },
        ],
      ] as const;
      context.subscriptions.push(
        ...scmCommands.map(([id, command]) =>
          vscode.commands.registerCommand(id, command)
        )
      );
      setContextVariable(SCM_STATUS_CONTEXT_NAME, ScmStatus.INITIALIZED);
    }
  }

  reporter.sendTelemetryEvent({
    type: V2TelemetryEvents.EXTENSION_ACTIVATED,
    buildNumber: __E4E_BUILD_NUMBER__,
    autoSignOut: isAutomaticSignOut(),
    maxParallelRequests: getMaxParallelRequests(),
    syncWithProfiles: isSyncWithProfiles(),
    fileExtensionResolution: getFileExtensionResolution(),
    workspaceSync: isWorkspaceSync(),
  });

  setContextVariable(EXT_ACTIVATED_WHEN_CONTEXT_NAME, true);
};

export const deactivate: Extension['deactivate'] = () => {
  logger.trace('Deactivation requested');
};

// because a vscode command can be an arbitrary function
// we have to resort to using `any` here
