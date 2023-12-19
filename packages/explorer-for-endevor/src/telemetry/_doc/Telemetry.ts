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

import { ServiceApiVersion } from '@local/endevor/_doc/Endevor';
import { FileExtensionResolutions } from '../../settings/_doc/v2/Settings';
import { Source } from '../../store/storage/_doc/Storage';
import { ElementToggleFilters } from '../../store/_doc/v2/Store';

export const enum TelemetryEvents {
  ERROR = 'extension error',

  EXTENSION_ACTIVATED = 'extension activation completed',

  PROFILES_MIGRATION_COMPLETED = 'profiles migration completed',

  ELEMENTS_IN_PLACE_TREE_BUILT = 'elements in place tree built',
  ELEMENTS_UP_THE_MAP_TREE_BUILT = 'elements up the map tree built',

  SERVICE_PROVIDED_INTO_TREE = 'service provided into the tree',
  SERVICES_LOCATIONS_PROVIDED_INTO_TREE = 'services/locations provided into the tree',
  SEARCH_LOCATION_PROVIDED_INTO_TREE = 'search location provided into the tree',

  COMMAND_ADD_NEW_SERVICE_COMPLETED = 'add new service command completed',
  COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED = 'add new search location command completed',

  SERVICE_HIDDEN = 'service hidden from the tree',
  SEARCH_LOCATION_HIDDEN = 'search location hidden from the tree',

  COMMAND_EDIT_SERVICE_COMPLETED = 'edit service command completed',

  COMMAND_DELETE_SERVICE_COMPLETED = 'delete service command completed',

  COMMAND_DELETE_SEARCH_LOCATION_COMPLETED = 'delete search location command completed',

  COMMAND_MOVE_ELEMENT_CALLED = 'move element command called',
  COMMAND_MOVE_ELEMENT_COMPLETED = 'move element command completed',
  COMMAND_FETCH_ELEMENT_COMPLETED = 'fetch element command completed',

  //Used in completed events
  COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED = 'generate element in place command called',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED = 'generate element with copy back command called',

  COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED = 'generate element in place command completed',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED = 'generate element with copy back command completed',

  COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED = 'signout error recover command completed',

  //Used in completed events
  COMMAND_SIGNOUT_ELEMENT_CALLED = 'signout element command called',
  COMMAND_SIGNOUT_ELEMENT_COMPLETED = 'signout element command completed',

  //Used in completed events
  COMMAND_INIT_WORKSPACE_CALLED = 'init workspace command called',
  COMMAND_INIT_WORKSPACE_COMPLETED = 'init workspace command completed',

  //Used in completed events
  COMMAND_SYNC_WORKSPACE_CALLED = 'sync workspace command called',
  COMMAND_SYNC_WORKSPACE_COMPLETED = 'sync workspace command completed',

  //Used in completed events
  COMMAND_PULL_FROM_ENDEVOR_CALLED = 'pull from endevor command called',
  COMMAND_PULL_FROM_ENDEVOR_COMPLETED = 'pull from endevor command completed',

  //Used in completed events
  COMMAND_DISCARD_ELEMENT_CHANGES_CALLED = 'discard element changes command called',
  COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED = 'discard element changes command completed',

  //Used in completed events
  COMMAND_REVERT_SECTION_CHANGE_CALLED = 'revert section change command called',

  //Used in completed events
  COMMAND_CONFIRM_CONFLICT_RESOLUTION_CALLED = 'confirm conflict resolution command called',
  COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED = 'confirm conflict resolution command completed',

  //TODO: Check with this again
  DIALOG_SERVICE_INFO_COLLECTION_CALLED = 'service information collection dialog called',
  //TODO: Check with this again
  SERVICE_INFO_RESOLVER_CALLED = 'service information resolver called',
  SERVICE_CONNECTION_TEST = 'service connection test',
  REJECT_UNAUTHORIZED_PROVIDED = 'reject unauthorized provided',

  SETTING_CHANGED_AUTO_SIGN_OUT = 'automatic signout setting changed',
  SETTING_CHANGED_SYNC_WITH_PROFILES = 'sync with profiles setting changed',
  SETTING_CHANGED_FILE_EXT_RESOLUTION = 'file extension resolution setting changed',
  SETTING_CHANGED_MAX_PARALLEL_REQUESTS = 'max parallel requests setting changed',
  SETTING_CHANGED_AUTH_WITH_TOKEN = 'auth with token setting changed',

  COMMAND_EDIT_CONNECTION_DETAILS_COMPLETED = 'edit connection details command completed',

  COMMAND_TEST_CONNECTION_DETAILS_COMPLETED = 'test connection details command completed',

  COMMAND_EDIT_CREDENTIALS_COMPLETED = 'edit credentials command completed',

  COMMAND_TOGGLE_FILTER = 'filter toggle changed in the tree',

  COMMAND_UPDATE_ELEMENT_NAME_FILTER_CALL = 'update elements name filter command call performed',
  COMMAND_UPDATE_ELEMENT_NAME_FILTER_COMPLETED = 'update elements name filter command completed',

  COMMAND_UPDATE_ELEMENT_TYPE_FILTER_CALL = 'update elements type filter command call performed',
  COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED = 'update elements type filter command completed',

  COMMAND_UPDATE_ELEMENT_CCID_FILTER_CALL = 'update elements CCID filter command call performed',
  COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED = 'update elements CCID filter command completed',

  COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED = 'generate subsystem elements in place command completed',

  COMMAND_PRINT_RESULT_TABLE_CALL = 'print result table command call performed',
  //TODO: Check with this again
  COMMAND_PRINT_RESULT_TABLE_CALLED = 'print result table command called',

  COMMAND_PRINT_ENDEVOR_REPORT_CALL = 'print Endevor report command call performed',
  //TODO: Check with this again
  COMMAND_PRINT_ENDEVOR_REPORT_CALLED = 'print Endevor report command called',

  REPORT_CONTENT_PROVIDER_COMPLETED = 'Endevor report content provider completed',

  ELEMENTS_WERE_FETCHED = 'elements were fetched',

  ENDEVOR_MAP_STRUCTURE_BUILT = 'endevor map structure built',

  MISSING_CREDENTIALS_PROVIDED = 'missing credentials provided',

  COMMAND_ADD_ELEMENT_COMPLETED = 'add element command completed',

  ELEMENT_CONTENT_PROVIDER_COMPLETED = 'element content provider completed',
  LISTING_CONTENT_PROVIDER_COMPLETED = 'listing content provider completed',
  HISTORY_CONTENT_PROVIDER_COMPLETED = 'history content provider completed',

  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED = 'resolve conflict with remote command completed',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL = 'resolve conflict with remote call performed',

  //Used in completed events
  COMMAND_EDIT_ELEMENT_CALLED = 'edit element command called',
  COMMAND_EDIT_ELEMENT_COMPLETED = 'edit element command completed',

  //Used in completed events
  COMMAND_UPLOAD_ELEMENT_CALLED = 'upload element command called',
  COMMAND_UPLOAD_ELEMENT_COMPLETED = 'upload element command completed',

  //Used in completed events
  COMMAND_RETRIEVE_ELEMENT_CALLED = 'retrieve element command called',
  COMMAND_RETRIEVE_ELEMENT_COMPLETED = 'retrieve element command completed',

  //Used in completed events
  COMMAND_SIGNIN_ELEMENT_CALLED = 'signin element command called',
  COMMAND_SIGNIN_ELEMENT_COMPLETED = 'signin element command completed',

  //Used in completed events
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED = 'retrieve element with deps command called',
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED = 'retrieve element with deps command completed',
  ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED = 'element dependency was not fetched',
  COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL = 'discard edited element changes call performed',

  //Used in completed events
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED = 'apply diff editor changes called',
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED = 'apply diff editor changes completed',
}

export type ExtensionActivatedEvent = {
  type: TelemetryEvents.EXTENSION_ACTIVATED;
  buildNumber: string;
  autoSignOut: boolean;
  syncWithProfiles: boolean;
  maxParallelRequests: number;
  fileExtensionResolution: FileExtensionResolutions;
  workspaceSync: boolean;
};

export type ProfileMigrationCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.PROFILES_MIGRATION_COMPLETED;
      status: ProfileMigrationCompletedStatus.NO_PROFILES_MIGRATED;
      error: Error;
    }
  | {
      type: TelemetryEvents.PROFILES_MIGRATION_COMPLETED;
      status:
        | ProfileMigrationCompletedStatus.NEW_PROFILES_MIGRATED
        | ProfileMigrationCompletedStatus.NO_PROFILES_MIGRATED;
    };

export const enum ProfileMigrationCompletedStatus {
  NEW_PROFILES_MIGRATED = 'NEW_PROFILES_MIGRATED',
  NO_PROFILES_MIGRATED = 'NO_PROFILES_MIGRATED',
}

export type ElementsInPlaceTreeBuiltEvent = {
  type: TelemetryEvents.ELEMENTS_IN_PLACE_TREE_BUILT;
  elementsInPlaceCount: number;
  systemsCount: number;
  subsystemsCount: number;
};

export type ElementsUpTheMapTreeBuiltEvent = {
  type: TelemetryEvents.ELEMENTS_UP_THE_MAP_TREE_BUILT;
  elementsInPlaceCount: number;
  elementsUpTheMapCount: number;
  routesCount: number;
};

export type ServiceProvidedIntoTreeEvent = {
  type: TelemetryEvents.SERVICE_PROVIDED_INTO_TREE;
  source: Source;
};

export type ServicesProvidedIntoTreeEvent = {
  type: TelemetryEvents.SERVICES_LOCATIONS_PROVIDED_INTO_TREE;
  syncedServices: number;
  internalServices: number;
  maxLocationsPerService: number;
  uniqueSyncedLocations: number;
  uniqueInternalLocations: number;
};

export type SearchLocationProvidedIntoTreeEvent = {
  type: TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE;
  source: Source;
  serviceSource: Source;
};

export const enum CommandAddNewServiceCompletedStatus {
  CANCELLED = 'CANCELLED',
  NEW_SERVICE_CREATED = 'NEW_SERVICE_CREATED',
  EXISTING_SERVICE_ADDED = 'EXISTING_SERVICE_ADDED',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandAddNewServiceCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED;
      status: CommandAddNewServiceCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED;
      status: CommandAddNewServiceCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED;
      status: CommandAddNewServiceCompletedStatus.NEW_SERVICE_CREATED;
      source: Source;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED;
      status: CommandAddNewServiceCompletedStatus.EXISTING_SERVICE_ADDED;
      source: Source;
    };

export const enum CommandAddNewSearchLocationCompletedStatus {
  CANCELLED = 'CANCELLED',
  USED_EXISTING_SEARCH_LOCATION_CHOSEN = 'USED_EXISTING_LOCATION_CHOSEN',
  UNUSED_EXISTING_LOCATION_CHOSEN = 'UNUSED_EXISTING_LOCATION_CHOSEN',
  NEW_SEARCH_LOCATION_CREATED = 'NEW_LOCATION_CREATED',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandAddNewSearchLocationCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status: CommandAddNewSearchLocationCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status: CommandAddNewSearchLocationCompletedStatus.USED_EXISTING_SEARCH_LOCATION_CHOSEN;
      inUseByServicesAmount: number;
      source: Source;
      serviceSource: Source;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status: CommandAddNewSearchLocationCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status: CommandAddNewSearchLocationCompletedStatus.UNUSED_EXISTING_LOCATION_CHOSEN;
      source: Source;
      serviceSource: Source;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status: CommandAddNewSearchLocationCompletedStatus.NEW_SEARCH_LOCATION_CREATED;
      source: Source;
      serviceSource: Source;
    };

export type ServiceHiddenEvent = {
  type: TelemetryEvents.SERVICE_HIDDEN;
  source: Source;
};

export type SearchLocationHiddenEvent = {
  type: TelemetryEvents.SEARCH_LOCATION_HIDDEN;
  source: Source;
};

export const enum CommandEditServiceCompletedStatus {
  SUCCESS = 'SUCCESS',
  VALIDATION_UNSUCCESSFUL = 'VALIDATION_UNSUCCESSFUL',
  CANCELLED = 'CANCELLED',
}

export type CommandEditServiceCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED;
      status: CommandEditServiceCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED;
      status:
        | CommandEditServiceCompletedStatus.SUCCESS
        | CommandEditServiceCompletedStatus.VALIDATION_UNSUCCESSFUL;
    };

export const enum CommandDeleteServiceCompletedStatus {
  SUCCESS = 'SUCCESS',
  CANCELLED = 'CANCELLED',
}

export type CommandDeleteServiceCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED;
      status: CommandDeleteServiceCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED;
      status: CommandDeleteServiceCompletedStatus.SUCCESS;
    };

export const enum CommandDeleteSearchLocationCompletedStatus {
  SUCCESS = 'SUCCESS',
  CANCELLED = 'CANCELLED',
  HIDED = 'HIDED',
}

export type CommandDeleteSearchLocationCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED;
      status: CommandDeleteSearchLocationCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED;
      status: CommandDeleteSearchLocationCompletedStatus.SUCCESS;
      inUseByServicesAmount: number;
      source: Source;
    }
  | {
      type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED;
      status: CommandDeleteSearchLocationCompletedStatus.HIDED;
      inUseByServicesAmount: number;
      source: Source;
    };

export const enum FetchElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandFetchElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED;
      status: FetchElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED;
      context:
        | TelemetryEvents.COMMAND_MOVE_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED;
      status: FetchElementCommandCompletedStatus.SUCCESS;
    };

export const enum MoveElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandMoveElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED;
      status: MoveElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED;
      status:
        | MoveElementCommandCompletedStatus.SUCCESS
        | MoveElementCommandCompletedStatus.CANCELLED;
    };

export const enum GenerateElementInPlaceCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export const enum GenerateWithCopyBackCommandCompletedStatus {
  SUCCESS_INTO_SEARCH_LOCATION = 'SUCCESS_INTO_SEARCH_LOCATION',
  SUCCESS_INTO_DIFFERENT_LOCATION = 'SUCCESS_INTO_DIFFERENT_LOCATION',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export const enum GenerateElementCommandContext {
  ELEMENT_TREE = 'ELEMENT_TREE',
  BROWSE_ELEMENT = 'BROWSE_ELEMENT',
}

export type CommandGenerateElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED;
      status:
        | GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR
        | GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
      generateContext?: GenerateElementCommandContext;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED;
      status:
        | GenerateElementInPlaceCommandCompletedStatus.SUCCESS
        | GenerateElementInPlaceCommandCompletedStatus.CANCELLED;
      generateContext: GenerateElementCommandContext;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED;
      status:
        | GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION
        | GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION
        | GenerateWithCopyBackCommandCompletedStatus.CANCELLED;
    };

export const enum SignoutErrorRecoverCommandCompletedStatus {
  OVERRIDE_SUCCESS = 'OVERRIDE_SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
  SIGNOUT_SUCCESS = 'SIGNOUT_SUCCESS',
  COPY_SUCCESS = 'COPY_SUCCESS',
}

export type CommandSignoutErrorRecoverCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED;
      status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED;
      context:
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED
        | TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED
        | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED
        | TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
      status:
        | SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.SIGNOUT_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.CANCELLED;
    };

export const enum SignOutElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  SIGN_OUT_ERROR = 'SIGN_OUT_ERROR',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandSignOutElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED;
      status: SignOutElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED;
      status: SignOutElementCommandCompletedStatus.SUCCESS;
    };

export const enum ServiceConnectionTestStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CERT_ISSUER_VALIDATION_ERROR = 'CERT_ISSUER_VALIDATION_ERROR',
  CONTINUE_WITH_ERROR = 'CONTINUE_WITH_ERROR',
  CANCELLED = 'CANCELLED',
  CONTINUE_WITH_CANCEL = 'CONTINUE_WITH_CANCEL',
}

export type ServiceConnectionTestEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED
        | TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED;
      status:
        | ServiceConnectionTestStatus.GENERIC_ERROR
        | ServiceConnectionTestStatus.CERT_ISSUER_VALIDATION_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.SERVICE_CONNECTION_TEST;
      context:
        | TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED
        | TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED;
      status: ServiceConnectionTestStatus.SUCCESS;
      apiVersion: ServiceApiVersion;
    }
  | {
      type: TelemetryEvents.SERVICE_CONNECTION_TEST;
      context:
        | TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED
        | TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED;
      status:
        | ServiceConnectionTestStatus.CONTINUE_WITH_ERROR
        | ServiceConnectionTestStatus.CONTINUE_WITH_CANCEL;
    }
  | {
      type: TelemetryEvents.SERVICE_CONNECTION_TEST;
      context:
        | TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED
        | TelemetryEvents.SERVICE_INFO_RESOLVER_CALLED;
      status: ServiceConnectionTestStatus.CANCELLED;
    };

export type RejectUnauthorizedProvidedEvent = {
  type: TelemetryEvents.REJECT_UNAUTHORIZED_PROVIDED;
  context: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALLED;
  rejectUnauthorized: boolean;
};

export type SettingChangedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT
        | TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION
        | TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS
        | TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES
        | TelemetryEvents.SETTING_CHANGED_AUTH_WITH_TOKEN;
      status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT;
      status: SettingChangedStatus.SUCCESS;
      value: boolean;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES;
      status: SettingChangedStatus.SUCCESS;
      value: boolean;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION;
      status: SettingChangedStatus.SUCCESS;
      value: FileExtensionResolutions;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS;
      status: SettingChangedStatus.SUCCESS;
      value: number;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_AUTH_WITH_TOKEN;
      status: SettingChangedStatus.SUCCESS;
      value: boolean;
    };

export const enum SettingChangedStatus {
  SUCCESS = 'SUCCESS',
  WRONG_SETTING_TYPE_ERROR = 'WRONG_SETTING_TYPE_ERROR',
}

export const enum DiscardElementChangesCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandDiscardElementChangesCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED;
      status: DiscardElementChangesCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED;
      status:
        | DiscardElementChangesCommandCompletedStatus.SUCCESS
        | DiscardElementChangesCommandCompletedStatus.CANCELLED;
    };

export const enum ConfirmConflictResolutionCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandConfirmConflictResolutionCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED;
      status: ConfirmConflictResolutionCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED;
      status: ConfirmConflictResolutionCommandCompletedStatus.SUCCESS;
    };

export const enum InitWorkspaceCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandInitWorkspaceCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED;
      status: InitWorkspaceCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED;
      status:
        | InitWorkspaceCommandCompletedStatus.SUCCESS
        | InitWorkspaceCommandCompletedStatus.CANCELLED;
    };

export const enum SyncWorkspaceCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
  CONFLICT = 'CONFLICT',
}

export type CommandSyncWorkspaceCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED;
      status: SyncWorkspaceCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED;
      status:
        | SyncWorkspaceCommandCompletedStatus.SUCCESS
        | SyncWorkspaceCommandCompletedStatus.CANCELLED
        | SyncWorkspaceCommandCompletedStatus.CONFLICT;
    };

export const enum PullFromEndevorCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
  CONFLICT = 'CONFLICT',
}

export type CommandPullFromEndevorCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED;
      status: PullFromEndevorCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED;
      status:
        | PullFromEndevorCommandCompletedStatus.SUCCESS
        | PullFromEndevorCommandCompletedStatus.CANCELLED
        | PullFromEndevorCommandCompletedStatus.CONFLICT;
    };

export const enum EditCredentialsCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandEditCredentialsCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED;
      status: EditCredentialsCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED;
      status:
        | EditCredentialsCommandCompletedStatus.SUCCESS
        | EditCredentialsCommandCompletedStatus.CANCELLED;
    };

export const enum EditConnectionDetailsCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandEditConnectionDetailsCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_EDIT_CONNECTION_DETAILS_COMPLETED;
      status: EditConnectionDetailsCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_EDIT_CONNECTION_DETAILS_COMPLETED;
      status:
        | EditConnectionDetailsCommandCompletedStatus.SUCCESS
        | EditConnectionDetailsCommandCompletedStatus.CANCELLED;
    };

export const enum TestConnectionDetailsCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandTestConnectionDetailsCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED;
      status: TestConnectionDetailsCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED;
      status: TestConnectionDetailsCommandCompletedStatus.SUCCESS;
    };

export type FilterToggled = {
  type: TelemetryEvents.COMMAND_TOGGLE_FILTER;
  source: Source;
  filter: ElementToggleFilters;
};

export const enum UpdateElementNameFilterCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  UNCHANGED = 'UNCHANGED',
  CANCELLED = 'CANCELLED',
  CLEARED = 'CLEARED',
}

export type CommandUpdateElementNameFilterCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_COMPLETED;
      status:
        | UpdateElementNameFilterCommandCompletedStatus.CANCELLED
        | UpdateElementNameFilterCommandCompletedStatus.CLEARED;
    }
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_COMPLETED;
      status:
        | UpdateElementNameFilterCommandCompletedStatus.SUCCESS
        | UpdateElementNameFilterCommandCompletedStatus.UNCHANGED;
      elementsFetched: boolean;
      patternsCount: number;
      wildcardUsed: boolean;
    };

export const enum GenerateSubsystemElementsInPlaceCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandGenerateSubsystemElementsInPlaceCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED;
      status: GenerateSubsystemElementsInPlaceCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED;
      status:
        | GenerateSubsystemElementsInPlaceCompletedStatus.SUCCESS
        | GenerateSubsystemElementsInPlaceCompletedStatus.GENERIC_ERROR
        | GenerateSubsystemElementsInPlaceCompletedStatus.CANCELLED;
    };

export const enum ElementNameFilterCompletedElementsFetched {
  ELEMENTS_FETCHED = 'ELEMENTS_FETCHED',
  ELEMENTS_NOT_FETCHED = 'ELEMENTS_NOT_FETCHED',
}

export const enum UpdateElementTypeFilterCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  UNCHANGED = 'UNCHANGED',
  CANCELLED = 'CANCELLED',
}

export type CommandUpdateElementTypeFilterCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED;
      status: UpdateElementTypeFilterCommandCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED;
      status:
        | UpdateElementTypeFilterCommandCompletedStatus.SUCCESS
        | UpdateElementTypeFilterCommandCompletedStatus.UNCHANGED;
      elementsFetched: boolean;
      patternsCount: number;
      wildcardUsed: boolean;
    };

export const enum UpdateElementCcidFilterCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  UNCHANGED = 'UNCHANGED',
  CANCELLED = 'CANCELLED',
  CLEARED = 'CLEARED',
}

export type CommandUpdateElementCcidFilterCompletedEvent =
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED;
      status:
        | UpdateElementCcidFilterCommandCompletedStatus.CANCELLED
        | UpdateElementCcidFilterCommandCompletedStatus.CLEARED;
    }
  | {
      type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED;
      status:
        | UpdateElementCcidFilterCommandCompletedStatus.SUCCESS
        | UpdateElementCcidFilterCommandCompletedStatus.UNCHANGED;
      elementsFetched: boolean;
      patternsCount: number;
      wildcardUsed: boolean;
    };

export type CommandUpdateElementCcidFilterCallEvent = {
  type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_CALL;
};

export type CommandUpdateElementNameFilterCallEvent = {
  type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_CALL;
};

export type CommandUpdateElementTypeFilterCallEvent = {
  type: TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_CALL;
};

export const enum ReportContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ReportContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALLED
        | TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALLED;
      status: ReportContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.REPORT_CONTENT_PROVIDER_COMPLETED;
      context:
        | TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALLED
        | TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALLED;
      status: ReportContentProviderCompletedStatus.SUCCESS;
    };

export type CommandPrintResultTableCallEvent = {
  type: TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALL;
  context: TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED;
};

export type CommandPrintEndevorReportCallEvent = {
  type: TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL;
  context:
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED;
};

export const enum ElementsFetchingStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ElementsFetchedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.ELEMENTS_WERE_FETCHED;
      status: ElementsFetchingStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.ELEMENTS_WERE_FETCHED;
      status:
        | ElementsFetchingStatus.SUCCESS
        | ElementsFetchingStatus.GENERIC_ERROR;
      elementsAmount: number;
    };

export const enum EndevorMapBuildingStatus {
  GENERIC_ERROR = 'GENERIC_ERROR',
  SUCCESS = 'SUCCESS',
}

export type EndevorMapNotBuiltEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT;
  status: EndevorMapBuildingStatus.GENERIC_ERROR;
  error: Error;
};

export type EndevorMapBuildCompleted = {
  type: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT;
  status:
    | EndevorMapBuildingStatus.SUCCESS
    | EndevorMapBuildingStatus.GENERIC_ERROR;
  error: Error;
};

export type MissingCredentialsProvidedEvent = {
  type: TelemetryEvents.MISSING_CREDENTIALS_PROVIDED;
};

export const enum AddElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  DUPLICATED_ELEMENT_ERROR = 'DUPLICATED_ELEMENT_ERROR',
}

export type CommandAddElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED;
      status:
        | AddElementCommandCompletedStatus.GENERIC_ERROR
        | AddElementCommandCompletedStatus.DUPLICATED_ELEMENT_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED;
      status: AddElementCommandCompletedStatus.SUCCESS;
    };

export const enum ElementContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ElementContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED;
      status: ElementContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED;
      status: ElementContentProviderCompletedStatus.SUCCESS;
    };

export const enum ListingContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  NO_LISTING = 'NO_LISTING',
  GENERIC_ERROR = 'GENERIC_ERROR',
}
export type ListingContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED;
      status:
        | ListingContentProviderCompletedStatus.NO_LISTING
        | ListingContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED;
      status:
        | ListingContentProviderCompletedStatus.SUCCESS
        | ListingContentProviderCompletedStatus.NO_LISTING;
    };

export const enum HistoryContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}
export type HistoryContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.HISTORY_CONTENT_PROVIDER_COMPLETED;
      status: HistoryContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.HISTORY_CONTENT_PROVIDER_COMPLETED;
      status: HistoryContentProviderCompletedStatus.SUCCESS;
    };

export const enum TreeElementCommandArguments {
  SINGLE_ELEMENT = 'SINGLE_ELEMENT',
  MULTIPLE_ELEMENTS = 'MULTIPLE_ELEMENTS',
}

export type CommandResolveConflictWithRemoteCallEvent = {
  type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL;
  context:
    | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED
    | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED;
};

export const enum EditElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandEditElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED;
      status: EditElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED;
      status: EditElementCommandCompletedStatus.SUCCESS;
    };

export const enum RetrieveElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandRetrieveElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED;
      status:
        | RetrieveElementCommandCompletedStatus.GENERIC_ERROR
        | RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED;
      status: RetrieveElementCommandCompletedStatus.SUCCESS;
    };
export const enum UploadElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandUploadElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED;
      status: UploadElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED;
      status: UploadElementCommandCompletedStatus.SUCCESS;
    };

export const enum SignInElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandSignInElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED;
      status: SignInElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED;
      status: SignInElementCommandCompletedStatus.SUCCESS;
    };

export const enum RetrieveElementWithDepsCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandRetrieveElementWithDepsCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED;
      status:
        | RetrieveElementWithDepsCommandCompletedStatus.GENERIC_ERROR
        | RetrieveElementWithDepsCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED;
      status: RetrieveElementWithDepsCommandCompletedStatus.SUCCESS;
      dependenciesAmount: number;
    };

export const enum DependencyRetrievalCompletedStatus {
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ElementDependencyWasNotRetrievedEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED;
  status: DependencyRetrievalCompletedStatus.GENERIC_ERROR;
  error: Error;
};

export const enum ResolveConflictWithRemoteCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ResolveConflictWithRemoteCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED;
      status: ResolveConflictWithRemoteCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED;
      status: ResolveConflictWithRemoteCompletedStatus.SUCCESS;
    };

export type CommandDiscardEditedElementChangesCallEvent = {
  type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL;
  context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED;
};
export const enum ApplyDiffEditorChangesCompletedStatus {
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandApplyDiffEditorChangesCompletedEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED;
  status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR;
  error: Error;
};

export type TelemetryEvent =
  | ExtensionActivatedEvent
  | ProfileMigrationCompletedEvent
  | ElementsInPlaceTreeBuiltEvent
  | ElementsUpTheMapTreeBuiltEvent
  | ServiceProvidedIntoTreeEvent
  | ServicesProvidedIntoTreeEvent
  | SearchLocationProvidedIntoTreeEvent
  | CommandAddNewServiceCompletedEvent
  | CommandAddNewSearchLocationCompletedEvent
  | ServiceHiddenEvent
  | SearchLocationHiddenEvent
  | CommandEditServiceCompletedEvent
  | CommandDeleteServiceCompletedEvent
  | CommandDeleteSearchLocationCompletedEvent
  | CommandFetchElementCompletedEvent
  | CommandMoveElementCompletedEvent
  | CommandGenerateElementCompletedEvent
  | CommandGenerateSubsystemElementsInPlaceCompletedEvent
  | CommandSignoutErrorRecoverCompletedEvent
  | CommandSignOutElementCompletedEvent
  | ServiceConnectionTestEvent
  | RejectUnauthorizedProvidedEvent
  | SettingChangedEvent
  | CommandDiscardElementChangesCompletedEvent
  | CommandConfirmConflictResolutionCompletedEvent
  | CommandInitWorkspaceCompletedEvent
  | CommandSyncWorkspaceCompletedEvent
  | CommandPullFromEndevorCompletedEvent
  | CommandEditConnectionDetailsCompletedEvent
  | CommandEditCredentialsCompletedEvent
  | CommandTestConnectionDetailsCompletedEvent
  | FilterToggled
  | CommandUpdateElementNameFilterCompletedEvent
  | CommandUpdateElementTypeFilterCompletedEvent
  | CommandUpdateElementCcidFilterCompletedEvent
  | CommandUpdateElementNameFilterCallEvent
  | CommandUpdateElementTypeFilterCallEvent
  | CommandUpdateElementCcidFilterCallEvent
  | ReportContentProviderCompletedEvent
  | CommandPrintResultTableCallEvent
  | CommandPrintEndevorReportCallEvent
  | CommandAddElementCompletedEvent
  | ElementsFetchedEvent
  | EndevorMapNotBuiltEvent
  | EndevorMapBuildCompleted
  | MissingCredentialsProvidedEvent
  | CommandResolveConflictWithRemoteCallEvent
  | ElementContentProviderCompletedEvent
  | ListingContentProviderCompletedEvent
  | HistoryContentProviderCompletedEvent
  | CommandEditElementCompletedEvent
  | CommandRetrieveElementCompletedEvent
  | CommandSignInElementCompletedEvent
  | CommandRetrieveElementWithDepsCompletedEvent
  | ElementDependencyWasNotRetrievedEvent
  | CommandUploadElementCompletedEvent
  | ResolveConflictWithRemoteCompletedEvent
  | CommandDiscardEditedElementChangesCallEvent
  | CommandApplyDiffEditorChangesCompletedEvent;
