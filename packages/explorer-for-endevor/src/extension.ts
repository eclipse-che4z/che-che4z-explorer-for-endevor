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

import { logger, reporter } from './globals'; // this import has to be first, it initializes global state
import { SectionChange } from '@local/vscode-wrapper/_doc/workspace';
import * as vscode from 'vscode';
import {
  EDIT_DIR,
  TREE_VIEW_ID,
  ELM_HISTORY_VIEW_ID,
  UNKNOWN_VERSION,
  ZE_API_MIN_VERSION,
  SCM_ID,
  SCM_CHANGES_GROUP_ID,
  SCM_CHANGES_GROUP_LABEL,
  SCM_LABEL,
  SCM_STATUS_CONTEXT_NAME,
  SCM_MERGE_CHANGES_GROUP_LABEL,
  SCM_MERGE_CHANGES_GROUP_ID,
  ACTIVITY_VIEW_ID,
} from './constants';
import { elementContentProvider } from './view/elementContentProvider';
import { make as makeElmTreeProvider } from './tree/provider';
import {
  make as makeActivityTreeProvider,
  ActivityNode,
  ReportNode,
} from './tree/activityProvider';
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
  getElementNamesFilterValue,
  getAllElements,
  getElementCcidsFilterValue,
  getElementTypesFilterValue,
  getElementsUpTheMapFilterValue,
  getAllElementFilterValues,
  getElementsInPlace,
  getFirstFoundElements,
  getEndevorInventory,
  getCredential,
  getElementHistoryData,
  getActivityRecords,
  getEmptyTypesFilterValue,
} from './store/store';
import {
  watchForAutoSignoutChanges,
  watchForMaxEndevorRequestsChanges,
  watchForSyncProfilesChanges,
  watchForAuthWithTokenChanges,
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
import { printElement } from './commands/element/printElement';
import { printListingCommand } from './commands/element/printListing';
import { addNewServiceCommand } from './commands/service/addNewService';
import { ElementNode, SubSystemNode, TypeNode } from './tree/_doc/ElementTree';
import { addNewSearchLocation } from './commands/location/addNewSearchLocation';
import { hideSearchLocation } from './commands/location/hideSearchLocation';
import { hideServiceCommand } from './commands/service/hideService';
import { viewElementDetails } from './commands/element/viewElementDetails';
import { retrieveElementCommand } from './commands/element/retrieveElement';
import { retrieveWithDependencies } from './commands/element/retrieveWithDependencies';
import { editElementCommand } from './commands/element/editElement';
import { uploadElementCommand } from './commands/element/uploadElement';
import { signOutElementCommand } from './commands/element/signOutElement';
import { signInElementCommand } from './commands/element/signInElement';
import { isError, joinUri } from './utils';
import { generateElementInPlaceCommand } from './commands/element/generateElementInPlace';
import { generateElementWithCopyBackCommand } from './commands/element/generateElementWithCopyBack';
import { listingContentProvider } from './view/listingContentProvider';
import { Actions } from './store/_doc/Actions';
import {
  ElementFilterType,
  EndevorConfiguration,
  EndevorConnection,
  EndevorId,
  State,
} from './store/_doc/v2/Store';
import { BasicElementUriQuery, Schemas } from './uri/_doc/Uri';
import { readOnlyFileContentProvider } from './view/readOnlyFileContentProvider';
import { isEditedElementUri } from './uri/editedElementUri';
import { discardEditedElementChanges } from './commands/element/discardEditedElementChanges';
import { applyDiffEditorChanges } from './commands/element/applyDiffEditorChanges';
import { addElementFromFileSystem } from './commands/location/addElementFromFileSystem';
import { generateSubsystemElementsCommand } from './commands/subsystem/generateSubsystemElements';
import { TelemetryEvents } from './telemetry/_doc/Telemetry';
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
  defineValidCredentialResolutionOrder,
  defineEndevorConfigurationResolutionOrder,
  defineSearchLocationResolutionOrder,
  defineValidConnectionDetailsResolutionOrder,
  resolveValidCredentials,
  resolveEndevorConfiguration,
  resolveSearchLocation,
  resolveValidConnectionDetails,
  resolveAnyConnectionDetails,
  defineAnyConnectionDetailsResolutionOrder,
  resolveValidOrUnknownCredentials,
  defineValidOrUnknownCredentialsResolutionOrder,
} from './store/resolvers';
import {
  LocationNode,
  ServiceNode,
  Node,
  ValidServiceNode,
  InvalidLocationNode,
} from './tree/_doc/ServiceLocationTree';
import { migrateConnectionLocationsFromSettings } from './store/storage/migrate';
import { deleteSearchLocation } from './commands/location/deleteSearchLocation';
import { deleteServiceCommand } from './commands/service/deleteService';
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
  getLastUsedServiceId,
  getLastUsedSearchLocationId,
} from './store/scm/store';
import {
  makeFileExplorerDecorationProvider,
  makeQuickDiffProvider,
  scmTreeProvider,
} from './tree/scmProvider';
import { isWorkspace as isEndevorWorkspace } from './store/scm/workspace';
import { watchForWorkspaceChanges } from './store/scm/watchers';
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
import { editCredentialsCommand } from './commands/service/editCredentials';
import { pullFromEndevorCommand } from './commands/sync/pullFromEndevor';
import { editConnectionDetailsCommand } from './commands/service/editConnectionDetails';
import { openElementCommand } from './commands/sync/openElement';
import { testConnectionDetailsCommand } from './commands/service/testConnectionDetails';
import { showModifiedElementCommand } from './commands/sync/showModifiedElement';
import { showDeletedElementCommand } from './commands/sync/showDeletedElement';
import { showAddedElementCommand } from './commands/sync/showAddedElement';
import { confirmConflictResolutionCommand } from './commands/sync/confirmConflictResolution';
import { showConflictedElementCommand } from './commands/sync/showConflictedElement';
import { toggleFilterValue } from './commands/location/toggleFilterValue';
import { clearSearchLocationFiltersCommand } from './commands/location/filter/clearSearchLocationFilters';
import { filterSearchLocationByElementNameCommand } from './commands/location/filter/filterSearchLocationByElementName';
import { filterSearchLocationByElementCcidCommand } from './commands/location/filter/filterSearchLocationByElementCcid';
import { clearSearchLocationFilterTypeCommand } from './commands/location/filter/clearSearchLocationFilterType';
import {
  FilteredNode,
  FilterNode,
  FilterValueNode,
} from './tree/_doc/FilterTree';
import { clearSearchLocationFilterValueCommand } from './commands/location/filter/clearSearchLocationFilterValue';
import { editSearchLocationFilterTypeCommand } from './commands/location/filter/editSearchLocationFilterType';
import { filterSearchLocationByElementTypeCommand } from './commands/location/filter/filterSearchLocationByElementType';
import {
  isNonExistingLocationNode,
  isNonExistingServiceNode,
} from './tree/utils';
import { printHistoryCommand } from '@local/views/commands/printHistory';
import { showChangeLevelCommand } from '@local/views/commands/showChangeLevel';
import { changeLvlContentProvider } from '@local/views/view/changeLvlContentProvider';
import { resultTableContentProvider } from './view/resultTableContentProvider';
import { endevorReportContentProvider } from './view/endevorReportContentProvider';
import { getElementParmsFromUri } from './uri/utils';
import { editServiceCommand } from './commands/service/editService';
import {
  stringifyPretty,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
import { printEndevorReportCommand } from './commands/printEndevorReport';
import {
  make as makeElementHistoryTreeProvider,
  decorate,
  Decorations,
} from '@local/views/tree/providerChanges';
import {
  ChangeLevelNode,
  ElementHistoryData,
  HistoryViewModes,
} from '@local/views/tree/_doc/ChangesTree';
import path = require('path');
import { getConnectionConfiguration } from './store/utils';
import { fromElementChangeUri } from '@local/views/uri/elementHistoryUri';
import { viewTypeDetails } from './commands/type/viewTypeDetails';
import { logActivity } from './logger';
import { moveElementCommand } from './commands/element/moveElement';
import { EndevorAuthorizedService, SearchLocation } from './api/_doc/Endevor';
import { createPackageCommand } from './commands/package/createPackage';
import { ElementInfo, ExternalEndevorApi } from './api/_doc/Api';
import {
  emitElementsUpdatedEvent,
  make as makeExternalEndevorApi,
} from './api/external';

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

const getExtensionVersionFromSettings =
  (getSettingsStorage: () => SettingsStorage) =>
  async (currentExtensionVersion: string) => {
    const settings = await getSettingsStorage().get();
    if (isError(settings)) {
      const error = settings;
      logger.error(
        `Unable to retrieve the extension version.`,
        `Unable to get the extension version from the settings storage because of: ${error.message}.`
      );
      return error;
    }
    if (settings.version !== currentExtensionVersion) {
      const storeResult = getSettingsStorage().store({
        version: currentExtensionVersion,
      });
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

export const submitExtensionIssue = (extensionBugsPageUrl: string) => () =>
  vscode.env.openExternal(vscode.Uri.parse(extensionBugsPageUrl));

export const activate: Extension<ExternalEndevorApi>['activate'] = async (
  context
) => {
  logger.trace(
    `${context.extension.id} extension with the build number: ${__E4E_BUILD_NUMBER__} will be activated.`
  );

  const tempEditFolderUri = joinUri(context.globalStorageUri)(EDIT_DIR);
  await cleanTempDirectory(tempEditFolderUri);
  const getTempEditFolderUri = () => tempEditFolderUri;

  const treeChangeEmitter = new vscode.EventEmitter<Node | null>();
  const elementHistoryTreeChangeEmitter =
    new vscode.EventEmitter<ChangeLevelNode | null>();
  const activityChangeEmitter = new vscode.EventEmitter<ActivityNode | null>();
  const invalidatedElementsEmitter: vscode.EventEmitter<ElementInfo[]> =
    new vscode.EventEmitter();
  let stateForTree: State = {
    caches: {},
    services: {},
    filters: {},
    sessions: {},
    searchLocations: {},
    serviceLocations: {},
    activityEntries: [],
  };
  const refreshTree = (_node?: Node) => {
    treeChangeEmitter.fire(null);
    elementHistoryTreeChangeEmitter.fire(null);
    activityChangeEmitter.fire(null);
  };
  const refreshActivity = (_node?: Node) => {
    activityChangeEmitter.fire(null);
  };

  const getState = () => stateForTree;

  const activityTreeProvider = makeActivityTreeProvider(() =>
    getActivityRecords(getState)
  )(activityChangeEmitter);

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
  )(context.extension.packageJSON.version);
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
    refreshActivity,
    (state) => {
      stateForTree = state;
      return;
    },
    emitElementsUpdatedEvent(invalidatedElementsEmitter, getTempEditFolderUri)
  );

  const refreshElementHistory = async (
    historyData: ElementHistoryData,
    elementUri: vscode.Uri
  ): Promise<void> => {
    const elementQuery = getElementParmsFromUri(elementUri);
    if (isError(elementQuery)) {
      return;
    }
    const { serviceId, searchLocationId, element } = elementQuery;
    await dispatch({
      type: Actions.ELEMENT_HISTORY_PRINTED,
      serviceId,
      element,
      searchLocationId,
      historyData,
    });
  };

  const getConnectionDetailsFromUri =
    (
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
    async (uri: vscode.Uri) => {
      const elementQuery = getElementParmsFromUri(uri);
      if (isError(elementQuery)) {
        return;
      }
      const connectionParams = await getConnectionConfiguration(
        elementQuery.serviceId,
        elementQuery.searchLocationId
      );
      if (!connectionParams) return;
      return {
        element: elementQuery.element,
        service: connectionParams.service,
        configuration: connectionParams.service.configuration,
      };
    };

  const getElementHistoryFromUri = (uri: vscode.Uri) => {
    const elementQuery = getElementParmsFromUri(uri);
    if (isError(elementQuery)) {
      return;
    }
    const { serviceId, searchLocationId, element } = elementQuery;
    return getElementHistoryData(getState)(serviceId)(searchLocationId)(
      element
    );
  };

  const logActivityFromUri = (uri: vscode.Uri) => {
    const elementQuery = getElementParmsFromUri(uri);
    if (isError(elementQuery)) {
      return;
    }
    const { serviceId, searchLocationId, element } = elementQuery;
    return logActivity(dispatch, { serviceId, searchLocationId, element });
  };

  const anyConnectionDetailsResolver = resolveAnyConnectionDetails(
    defineAnyConnectionDetailsResolutionOrder(getState)
  );
  const validConnectionDetailsResolver = resolveValidConnectionDetails(
    defineValidConnectionDetailsResolutionOrder(getState, dispatch)
  );

  const endevorConfigurationResolver = resolveEndevorConfiguration(
    defineEndevorConfigurationResolutionOrder(getState)
  );

  const validOrUnknownBaseCredentialResolver = resolveValidOrUnknownCredentials(
    defineValidOrUnknownCredentialsResolutionOrder(
      getState,
      getCredentialsStorage
    )
  );
  const validCredentialsResolver = (
    connection: EndevorConnection,
    configuration: EndevorConfiguration
  ) =>
    resolveValidCredentials(
      defineValidCredentialResolutionOrder(
        getState,
        dispatch,
        getCredentialsStorage,
        validOrUnknownBaseCredentialResolver,
        connection,
        configuration
      )()
    );
  const validCredentialsResolverWithNoReturnValue = (
    connection: EndevorConnection,
    configuration: EndevorConfiguration
  ) =>
    resolveValidCredentials(
      defineValidCredentialResolutionOrder(
        getState,
        dispatch,
        getCredentialsStorage,
        validOrUnknownBaseCredentialResolver,
        connection,
        configuration
      )({ undefinedIfRevalidated: true })
    );

  const searchLocationResolver = resolveSearchLocation(
    defineSearchLocationResolutionOrder(getState)
  );

  const connectionConfigurationResolver = getConnectionConfiguration({
    getConnectionDetails: validConnectionDetailsResolver,
    getCredential: validCredentialsResolver,
    getSearchLocation: searchLocationResolver,
    getEndevorConfiguration: endevorConfigurationResolver,
  });

  const connectionConfigurationResolverForProvider = getConnectionConfiguration(
    {
      getConnectionDetails: anyConnectionDetailsResolver,
      getCredential: validCredentialsResolverWithNoReturnValue,
      getSearchLocation: searchLocationResolver,
      getEndevorConfiguration: endevorConfigurationResolver,
    }
  );

  const elementHistoryTreeProvider = makeElementHistoryTreeProvider(
    elementHistoryTreeChangeEmitter
  )(logger)(
    {
      getHistoryData: getElementHistoryFromUri,
      logActivity: logActivityFromUri,
      getConfigurations: getConnectionDetailsFromUri(
        connectionConfigurationResolver
      ),
    },
    refreshElementHistory
  )(
    CommandId.CHANGE_HISTORY_LEVEL,
    Schemas.ELEMENT_CHANGE_LVL,
    ELM_HISTORY_VIEW_ID
  );
  const elementHistoryTreeView = vscode.window.createTreeView(
    ELM_HISTORY_VIEW_ID,
    {
      treeDataProvider: elementHistoryTreeProvider,
    }
  );
  elementHistoryTreeProvider.treeView = elementHistoryTreeView;
  const refreshElementHistoryTree = (
    uri?: vscode.Uri,
    mode?: HistoryViewModes
  ) => {
    elementHistoryTreeProvider.elementUri = uri;
    elementHistoryTreeProvider.mode = mode;
    elementHistoryTreeChangeEmitter.fire(null);
    if (mode === HistoryViewModes.SHOW_IN_EDITOR) {
      focusOnView(ELM_HISTORY_VIEW_ID);
    }
  };

  const treeProvider = makeElmTreeProvider(
    dispatch,
    connectionConfigurationResolverForProvider,
    {
      getServiceLocations: () =>
        getAllServiceLocations(getState)(getCredentialsStorage),
      getElementsUpTheMapFilterValue: getElementsUpTheMapFilterValue(getState),
      getEmptyTypesFilterValue: getEmptyTypesFilterValue(getState),
      getAllElementFilterValues: getAllElementFilterValues(getState),
      getElementsInPlace: getElementsInPlace(getState),
      getFirstFoundElements: getFirstFoundElements(getState),
      getEndevorInventory: getEndevorInventory(getState),
    }
  )(treeChangeEmitter);

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
    dispatch({
      type: Actions.REFRESH,
    });
    await focusOnView(TREE_VIEW_ID);
  };

  const refreshHistory = async () => {
    const editor = vscode.window.activeTextEditor;
    const editorUri = editor?.document.uri;
    if (!editor || !editorUri) {
      refreshElementHistoryTree();
      return;
    }
    const elementQuery = getElementParmsFromUri(editorUri);
    if (isError(elementQuery)) {
      refreshElementHistoryTree();
      return;
    }
    withErrorLogging(CommandId.PRINT_HISTORY)(
      printHistoryCommand<Omit<BasicElementUriQuery, 'element'>>(
        logger,
        refreshElementHistoryTree,
        elementQuery,
        HistoryViewModes.ONLY_SHOW_CHANGES,
        Schemas.ELEMENT_CHANGE_LVL
      )
    );
  };

  const commands = [
    [
      CommandId.EDIT_CREDENTIALS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.EDIT_CREDENTIALS)(
          editCredentialsCommand(
            dispatch,
            endevorConfigurationResolver,
            validConnectionDetailsResolver,
            getCredential(getState)(getCredentialsStorage)
          )(invalidLocationNode)
        );
      },
    ],
    [
      CommandId.PRINT_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.PRINT_ELEMENT)(
          printElement(elementNode)
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
    [CommandId.REFRESH_HISTORY_TREE_VIEW, refreshHistory],
    [
      CommandId.PRINT_HISTORY,
      (elementNode: ElementNode) => {
        focusOnView(ELM_HISTORY_VIEW_ID);
        return withErrorLogging(CommandId.PRINT_HISTORY)(
          printHistoryCommand(
            logger,
            refreshElementHistoryTree,
            {
              serviceId: elementNode.serviceId,
              searchLocationId: elementNode.searchLocationId,
              element: elementNode.element,
            },
            HistoryViewModes.CLEAR_AND_SHOW,
            Schemas.ELEMENT_CHANGE_LVL
          )
        );
      },
    ],
    [
      CommandId.CHANGE_HISTORY_LEVEL,
      (changeNode: ChangeLevelNode) => {
        return withErrorLogging(CommandId.CHANGE_HISTORY_LEVEL)(
          showChangeLevelCommand(
            logger,
            refreshElementHistoryTree,
            changeNode,
            Schemas.ELEMENT_CHANGE_LVL
          )
        );
      },
    ],
    [CommandId.REFRESH_TREE_VIEW, refresh],
    [
      CommandId.SUBMIT_ISSUE,
      submitExtensionIssue(context.extension.packageJSON.bugs.url),
    ],
    [
      CommandId.ADD_SERVICE_AND_LOCATION,
      () => {
        return withErrorLogging(CommandId.ADD_SERVICE_AND_LOCATION)(
          (async () => {
            const serviceId = await addNewServiceCommand(dispatch, {
              getValidServiceDescriptions: () =>
                getExistingUnusedServiceDescriptions(getState)(
                  getCredentialsStorage
                ),
              getAllServiceNames: () => getAllServiceNames(getState),
            });
            if (serviceId) {
              await addNewSearchLocation(dispatch, {
                getSearchLocationNames: () =>
                  getAllSearchLocationNames(getState),
                getValidSearchLocationDescriptionsForService:
                  getValidUnusedSearchLocationDescriptionsForService(getState),
                getServiceDescriptionsBySearchLocationId:
                  getAllServiceDescriptionsBySearchLocationId(getState)(
                    getCredentialsStorage
                  ),
                getConnectionDetails: validConnectionDetailsResolver,
                getValidUsedServiceDescriptions: () =>
                  getExistingUsedServiceDescriptions(getState)(
                    getCredentialsStorage
                  ),
              })(serviceId);
            }
          })()
        );
      },
    ],
    [
      CommandId.ADD_NEW_SERVICE,
      () => {
        return withErrorLogging(CommandId.ADD_NEW_SERVICE)(
          addNewServiceCommand(dispatch, {
            getValidServiceDescriptions: () =>
              getExistingUnusedServiceDescriptions(getState)(
                getCredentialsStorage
              ),
            getAllServiceNames: () => getAllServiceNames(getState),
          })
        );
      },
    ],
    [
      CommandId.ADD_NEW_SEARCH_LOCATION,
      (serviceNode?: ValidServiceNode) => {
        return withErrorLogging(CommandId.ADD_NEW_SEARCH_LOCATION)(
          addNewSearchLocation(dispatch, {
            getSearchLocationNames: () => getAllSearchLocationNames(getState),
            getValidSearchLocationDescriptionsForService:
              getValidUnusedSearchLocationDescriptionsForService(getState),
            getServiceDescriptionsBySearchLocationId:
              getAllServiceDescriptionsBySearchLocationId(getState)(
                getCredentialsStorage
              ),
            getConnectionDetails: validConnectionDetailsResolver,
            getValidUsedServiceDescriptions: () =>
              getExistingUsedServiceDescriptions(getState)(
                getCredentialsStorage
              ),
          })(serviceNode)
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
          hideServiceCommand(dispatch)(serviceNode)
        );
      },
    ],
    [
      CommandId.DELETE_SEARCH_LOCATION,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.DELETE_SEARCH_LOCATION)(
          isNonExistingLocationNode(locationNode)
            ? hideSearchLocation(dispatch)(locationNode)
            : deleteSearchLocation(
                dispatch,
                getAllServiceDescriptionsBySearchLocationId(getState)(
                  getCredentialsStorage
                )
              )(locationNode)
        );
      },
    ],
    [
      CommandId.DELETE_SERVICE,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.DELETE_SERVICE)(
          isNonExistingServiceNode(serviceNode)
            ? hideServiceCommand(dispatch)(serviceNode)
            : deleteServiceCommand(dispatch)(serviceNode)
        );
      },
    ],
    [
      CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM,
      (parentNode: LocationNode | TypeNode) => {
        return withErrorLogging(CommandId.ADD_ELEMENT_FROM_FILE_SYSTEM)(
          addElementFromFileSystem(
            dispatch,
            connectionConfigurationResolver
          )(parentNode)
        );
      },
    ],
    [
      CommandId.CLEAR_SEARCH_LOCATION_FILTERS,
      (parentNode: LocationNode | FilteredNode) => {
        return withErrorLogging(CommandId.CLEAR_SEARCH_LOCATION_FILTERS)(
          clearSearchLocationFiltersCommand(dispatch)(parentNode)
        );
      },
    ],
    [
      CommandId.CLEAR_SEARCH_LOCATION_FILTER,
      (parentNode: FilterNode) => {
        return withErrorLogging(CommandId.CLEAR_SEARCH_LOCATION_FILTER)(
          clearSearchLocationFilterTypeCommand(dispatch)(parentNode)
        );
      },
    ],
    [
      CommandId.CLEAR_SEARCH_LOCATION_FILTER_VALUE,
      (parentNode: FilterValueNode) => {
        return withErrorLogging(CommandId.CLEAR_SEARCH_LOCATION_FILTER_VALUE)(
          clearSearchLocationFilterValueCommand(dispatch, {
            getElementNamesFilterValue: getElementNamesFilterValue(getState),
            getElementTypesFilterValue: getElementTypesFilterValue(getState),
            getElementCcidsFilterValue: getElementCcidsFilterValue(getState),
            getAllElements: getAllElements(getState),
          })(parentNode)
        );
      },
    ],
    [
      CommandId.EDIT_SEARCH_LOCATION_FILTER,
      (parentNode: FilterValueNode) => {
        return withErrorLogging(CommandId.EDIT_SEARCH_LOCATION_FILTER)(
          editSearchLocationFilterTypeCommand(dispatch, {
            getElementNamesFilterValue: getElementNamesFilterValue(getState),
            getElementTypesFilterValue: getElementTypesFilterValue(getState),
            getElementCcidsFilterValue: getElementCcidsFilterValue(getState),
            getAllElements: getAllElements(getState),
          })(parentNode)
        );
      },
    ],
    [
      CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_NAME,
      (parentNode: LocationNode) => {
        return withErrorLogging(
          CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_NAME
        )(
          filterSearchLocationByElementNameCommand(dispatch, {
            getElementNamesFilterValue: getElementNamesFilterValue(getState),
            getAllElements: getAllElements(getState),
          })(parentNode)
        );
      },
    ],
    [
      CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_TYPE,
      (parentNode: LocationNode) => {
        return withErrorLogging(
          CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_TYPE
        )(
          filterSearchLocationByElementTypeCommand(dispatch, {
            getElementTypesFilterValue: getElementTypesFilterValue(getState),
            getAllElements: getAllElements(getState),
          })(parentNode)
        );
      },
    ],
    [
      CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_CCID,
      (parentNode: LocationNode) => {
        return withErrorLogging(
          CommandId.FILTER_SEARCH_LOCATION_BY_ELEMENT_CCID
        )(
          filterSearchLocationByElementCcidCommand(dispatch, {
            getElementCcidsFilterValue: getElementCcidsFilterValue(getState),
            getAllElements: getAllElements(getState),
          })(parentNode)
        );
      },
    ],
    [
      CommandId.MOVE_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.MOVE_ELEMENT)(
          moveElementCommand(
            dispatch,
            connectionConfigurationResolver,
            getEndevorInventory(getState),
            getElementsUpTheMapFilterValue(getState)
          )(elementNode)
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT)(
          generateElementInPlaceCommand(
            dispatch,
            connectionConfigurationResolver
          )(elementNode)
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT_WITH_COPY_BACK,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT_WITH_COPY_BACK)(
          generateElementWithCopyBackCommand(
            dispatch,
            connectionConfigurationResolver
          )(elementNode, { noSource: false })
        );
      },
    ],
    [
      CommandId.GENERATE_ELEMENT_WITH_NO_SOURCE,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.GENERATE_ELEMENT_WITH_NO_SOURCE)(
          generateElementWithCopyBackCommand(
            dispatch,
            connectionConfigurationResolver
          )(elementNode, { noSource: true })
        );
      },
    ],
    [
      CommandId.SHOW_REPORT,
      (reportNode: ReportNode) => {
        return withErrorLogging(CommandId.SHOW_REPORT)(
          (async () => {
            if (
              !reportNode.parent.serviceId ||
              !reportNode.parent.searchLocationId
            ) {
              return;
            }
            printEndevorReportCommand(
              reportNode.parent.serviceId,
              reportNode.parent.searchLocationId
            )(reportNode.objectName)(reportNode.id);
          })()
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
          retrieveElementCommand(dispatch, connectionConfigurationResolver)(
            elementNode,
            nodes
          )
        );
      },
    ],
    [
      CommandId.RETRIEVE_WITH_DEPENDENCIES,
      (elementNode?: ElementNode, nodes?: ElementNode[]) => {
        return withErrorLogging(CommandId.RETRIEVE_WITH_DEPENDENCIES)(
          retrieveWithDependencies(dispatch, connectionConfigurationResolver)(
            elementNode,
            nodes
          )
        );
      },
    ],
    [
      CommandId.QUICK_EDIT_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.QUICK_EDIT_ELEMENT)(
          editElementCommand(
            dispatch,
            connectionConfigurationResolver,
            getTempEditFolderUri
          )(elementNode)
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
          applyDiffEditorChanges(
            dispatch,
            connectionConfigurationResolver,
            comparedElementUri
          )
        );
      },
    ],
    [
      CommandId.SIGN_OUT_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.SIGN_OUT_ELEMENT)(
          signOutElementCommand(
            dispatch,
            connectionConfigurationResolver
          )(elementNode)
        );
      },
    ],
    [
      CommandId.SIGN_IN_ELEMENT,
      (elementNode: ElementNode) => {
        return withErrorLogging(CommandId.SIGN_IN_ELEMENT)(
          signInElementCommand(
            dispatch,
            connectionConfigurationResolver
          )(elementNode)
        );
      },
    ],
    [
      CommandId.CREATE_PACKAGE,
      (elementNode: ElementNode, nodes?: ElementNode[]) => {
        return withErrorLogging(CommandId.CREATE_PACKAGE)(
          createPackageCommand(dispatch, connectionConfigurationResolver)(
            elementNode,
            nodes
          )
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
      CommandId.DUMP_STORAGE,
      () => {
        return withErrorLogging(CommandId.DUMP_STORAGE)(
          (async () => {
            logger.trace(
              `Connection locations storage content dump:\n${stringifyPretty(
                await getConnectionLocationsStorage().get()
              )}`
            );
            logger.trace(
              `Connections storage content dump:\n${stringifyWithHiddenCredential(
                await getConnectionsStorage().get()
              )}`
            );
            logger.trace(
              `Inventory locations storage content dump:\n${stringifyPretty(
                await getInventoryLocationsStorage().get()
              )}`
            );
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
      CommandId.EDIT_SERVICE,
      (serviceNode: ServiceNode) => {
        return withErrorLogging(CommandId.EDIT_SERVICE)(
          editServiceCommand(
            dispatch,
            getEndevorConnectionDetails(getState),
            getCredential(getState)(getCredentialsStorage)
          )(serviceNode)
        );
      },
    ],
    [
      CommandId.EDIT_CONNECTION_DETAILS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.EDIT_CONNECTION_DETAILS)(
          editConnectionDetailsCommand(
            dispatch,
            getEndevorConnectionDetails(getState)
          )(invalidLocationNode)
        );
      },
    ],
    [
      CommandId.SHOW_FIRST_FOUND,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.SHOW_FIRST_FOUND)(
          toggleFilterValue(dispatch)({
            type: ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER,
            value: true,
          })(locationNode)
        );
      },
    ],
    [
      CommandId.SHOW_IN_PLACE,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.SHOW_IN_PLACE)(
          toggleFilterValue(dispatch)({
            type: ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER,
            value: false,
          })(locationNode)
        );
      },
    ],
    [
      CommandId.SHOW_EMPTY_TYPES,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.SHOW_EMPTY_TYPES)(
          toggleFilterValue(dispatch)({
            type: ElementFilterType.EMPTY_TYPES_FILTER,
            value: true,
          })(locationNode)
        );
      },
    ],
    [
      CommandId.HIDE_EMPTY_TYPES,
      (locationNode: LocationNode) => {
        return withErrorLogging(CommandId.HIDE_EMPTY_TYPES)(
          toggleFilterValue(dispatch)({
            type: ElementFilterType.EMPTY_TYPES_FILTER,
            value: false,
          })(locationNode)
        );
      },
    ],
    [
      CommandId.TEST_CONNECTION_DETAILS,
      (invalidLocationNode: InvalidLocationNode) => {
        return withErrorLogging(CommandId.TEST_CONNECTION_DETAILS)(
          testConnectionDetailsCommand(
            dispatch,
            getEndevorConnectionDetails(getState)
          )(invalidLocationNode)
        );
      },
    ],
    [
      CommandId.GENERATE_SUBSYSTEM_ELEMENTS,
      (subSystemNode: SubSystemNode) => {
        return withErrorLogging(CommandId.GENERATE_SUBSYSTEM_ELEMENTS)(
          generateSubsystemElementsCommand(
            dispatch,
            connectionConfigurationResolver
          )(subSystemNode)
        );
      },
    ],
    [
      CommandId.VIEW_TYPE_DETAILS,
      (typeNode: TypeNode) => {
        return withErrorLogging(CommandId.VIEW_TYPE_DETAILS)(
          Promise.resolve(
            viewTypeDetails(dispatch, connectionConfigurationResolver)(typeNode)
          )
        );
      },
    ],
  ] as const;

  const textDocumentSavedHandlers: ReadonlyArray<TextDocumentSavedHandler> = [
    {
      apply: (document) => {
        return withErrorLogging(CommandId.UPLOAD_ELEMENT)(
          uploadElementCommand(
            dispatch,
            connectionConfigurationResolver
          )(document.uri)
        );
      },
      isApplicable: (document) => {
        const uriValidationResult = isEditedElementUri(document.uri);
        return uriValidationResult.valid;
        // logger.trace(
        //   `Element uri is not valid for uploading elements, because of: ${uriValidationResult.message}`
        // );
      },
    },
  ];

  const onActiveEditorChanged = async (
    editor: vscode.TextEditor | undefined
  ): Promise<void> => {
    let activeEditor = editor;
    if (!activeEditor) {
      // First this event is triggered when changing editors, `editor` is usually undefined.
      // Therefore we will wait a second and then get an active editor. This is to prevent
      // blinking of the message in the Element History
      await new Promise((f) => setTimeout(f, 1000));
      activeEditor = vscode.window.activeTextEditor;
    }
    const editorUri = activeEditor?.document.uri;
    refreshElementHistoryTree(editorUri);
    if (
      activeEditor &&
      editorUri &&
      editorUri.scheme === Schemas.ELEMENT_CHANGE_LVL
    ) {
      const elementQuery = fromElementChangeUri(editorUri)(editorUri.scheme);
      if (isError(elementQuery)) {
        const error = elementQuery;
        const elementName = path.basename(editorUri.fsPath);
        logger.error(
          `Unable to show history for element ${elementName}`,
          `Unable to show history for element ${elementName} because of ${error.message}.`
        );
        return;
      }
      decorate(
        getElementHistoryFromUri,
        activeEditor,
        editorUri,
        elementQuery.vvll
      );
    }
  };

  context.subscriptions.push(
    reporter,
    vscode.window.createTreeView(TREE_VIEW_ID, {
      treeDataProvider: treeProvider,
      canSelectMany: true,
    }),
    elementHistoryTreeView,
    vscode.window.createTreeView(ACTIVITY_VIEW_ID, {
      treeDataProvider: activityTreeProvider,
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.TREE_ELEMENT,
      elementContentProvider(dispatch, connectionConfigurationResolver)
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.ELEMENT_LISTING,
      listingContentProvider(dispatch, connectionConfigurationResolver)
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.ELEMENT_CHANGE_LVL,
      changeLvlContentProvider(
        {
          getHistoryData: getElementHistoryFromUri,
          logActivity: logActivityFromUri,
          getConfigurations: getConnectionDetailsFromUri(
            connectionConfigurationResolver
          ),
        },
        refreshElementHistory,
        logger,
        Schemas.ELEMENT_CHANGE_LVL
      )
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.READ_ONLY_FILE,
      readOnlyFileContentProvider
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.READ_ONLY_REPORT,
      resultTableContentProvider(dispatch, connectionConfigurationResolver)
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      Schemas.READ_ONLY_GENERIC_REPORT,
      endevorReportContentProvider(connectionConfigurationResolver)
    ),
    ...commands.map(([id, command]) =>
      vscode.commands.registerCommand(id, command)
    ),
    watchForAutoSignoutChanges(),
    watchForMaxEndevorRequestsChanges(),
    watchForSyncProfilesChanges(),
    watchForWorkspaceSyncChanges(),
    watchForFileExtensionResolutionChanges(),
    watchForAuthWithTokenChanges(),
    vscode.workspace.onDidSaveTextDocument((document) =>
      textDocumentSavedHandlers
        .filter((handler) => handler.isApplicable(document))
        .forEach(async (handler) => {
          await handler.apply(document);
        })
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) =>
      onActiveEditorChanged(editor)
    ),
    ...Object.values(Decorations)
  );

  if (isWorkspaceSync()) {
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
      let scmState: ScmState = {
        workspaceElements: [],
      };
      const getScmState = () => scmState;
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
        if (action?.type === SyncActions.WORKSPACE_META_UPDATED) {
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
        getScmState,
        renderScmUI,
        (state) => {
          scmState = state;
          return;
        }
      )(folderUri);
      context.subscriptions.push(
        watchForWorkspaceChanges(folderUri)(scmDispatch),
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
                scmDispatch,
                connectionConfigurationResolver,
                () =>
                  getAllExistingServiceDescriptions(getState)(
                    getCredentialsStorage
                  ),
                () => getAllValidSearchLocationDescriptions(getState),
                () => getLastUsedServiceId(getScmState),
                () => getLastUsedSearchLocationId(getScmState)
              )
            );
          },
        ],
        [
          CommandId.PULL_FROM_ENDEVOR,
          () => {
            return withErrorLogging(CommandId.PULL_FROM_ENDEVOR)(
              pullFromEndevorCommand(
                scmDispatch,
                connectionConfigurationResolver,
                () =>
                  getAllExistingServiceDescriptions(getState)(
                    getCredentialsStorage
                  ),
                () => getAllValidSearchLocationDescriptions(getState),
                () => getLastUsedServiceId(getScmState),
                () => getLastUsedSearchLocationId(getScmState)
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
              )(resourceStates)
            );
          },
        ],
        [
          CommandId.DISCARD_ALL_CHANGES,
          (resourceGroup: vscode.SourceControlResourceGroup) => {
            return withErrorLogging(CommandId.DISCARD_ALL_CHANGES)(
              discardChangesCommand(
                getNonConflictedWorkspaceChangeForFile(getScmState)
              )(resourceGroup.resourceStates)
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
              confirmConflictResolutionCommand(resourceStates)
            );
          },
        ],
        [
          CommandId.CONFIRM_ALL_CONFLICT_RESOLUTIONS,
          (resourceGroup: vscode.SourceControlResourceGroup) => {
            return withErrorLogging(CommandId.CONFIRM_ALL_CONFLICT_RESOLUTIONS)(
              confirmConflictResolutionCommand(resourceGroup.resourceStates)
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
    type: TelemetryEvents.EXTENSION_ACTIVATED,
    buildNumber: __E4E_BUILD_NUMBER__,
    autoSignOut: isAutomaticSignOut(),
    maxParallelRequests: getMaxParallelRequests(),
    syncWithProfiles: isSyncWithProfiles(),
    fileExtensionResolution: getFileExtensionResolution(),
    workspaceSync: isWorkspaceSync(),
  });

  return makeExternalEndevorApi(
    dispatch,
    connectionConfigurationResolver,
    getTempEditFolderUri
  )(invalidatedElementsEmitter);
};

export const deactivate: Extension['deactivate'] = () => {
  logger.trace('Deactivation requested');
};

// because a vscode command can be an arbitrary function
// we have to resort to using `any` here
