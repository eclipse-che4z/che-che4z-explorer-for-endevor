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

import { ServiceApiVersion } from '@local/endevor/_doc/Endevor';
import { FileExtensionResolutions } from '../../../settings/_doc/v2/Settings';
import { Source } from '../../../store/storage/_doc/Storage';
import { CommandArguments } from '../../Telemetry';
export const TELEMETRY_EVENTS_VERSION = '2';

export const enum TelemetryEvents {
  ERROR = 'extension error',

  EXTENSION_ACTIVATED = 'extension activation completed',

  PROFILES_MIGRATION_COMPLETED = 'profiles migration completed',
  PROFILES_MIGRATION_CALLED = 'profiles migration called',

  SERVICE_PROVIDED_INTO_TREE = 'service provided into the tree',
  SEARCH_LOCATION_PROVIDED_INTO_TREE = 'search location provided into the tree',

  COMMAND_ADD_NEW_SERVICE_CALLED = 'add new service command called',
  COMMAND_ADD_NEW_SERVICE_COMPLETED = 'add new service command completed',
  COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED = 'add new search location command called',
  COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED = 'add new search location command completed',

  SERVICE_HIDDEN = 'service hidden from the tree',
  SEARCH_LOCATION_HIDDEN = 'search location hidden from the tree',

  COMMAND_DELETE_SERVICE_CALLED = 'delete service command called',
  COMMAND_DELETE_SERVICE_COMPLETED = 'delete service command completed',

  COMMAND_DELETE_SEARCH_LOCATION_CALLED = 'delete search location command called',
  COMMAND_DELETE_SEARCH_LOCATION_COMPLETED = 'delete search location command completed',

  COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED = 'generate element in place command called',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED = 'generate element with copy back command called',
  COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED = 'generate element in place command completed',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED = 'generate element with copy back command completed',

  COMMAND_PRINT_LISTING_CALL = 'print listing command call performed',

  COMMAND_SIGNOUT_ERROR_RECOVER_CALLED = 'signout error recover command called',
  COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED = 'signout error recover command completed',

  COMMAND_SIGNOUT_ELEMENT_CALLED = 'signout element command called',
  COMMAND_SIGNOUT_ELEMENT_COMPLETED = 'signout element command completed',

  DIALOG_SERVICE_INFO_COLLECTION_CALLED = 'service information collection dialog called',
  SERVICE_INFO_RESOLVER_CALLED = 'service information resolver called',
  SERVICE_CONNECTION_TEST = 'service connection test',
  REJECT_UNAUTHORIZED_PROVIDED = 'reject unauthorized provided',

  SETTING_CHANGED_AUTO_SIGN_OUT = 'automatic signout setting changed',
  SETTING_CHANGED_SYNC_WITH_PROFILES = 'sync with profiles setting changed',
  SETTING_CHANGED_FILE_EXT_RESOLUTION = 'file extension resolution setting changed',
  SETTING_CHANGED_MAX_PARALLEL_REQUESTS = 'max parallel requests setting changed',
}

export type ExtensionActivatedEvent = {
  type: TelemetryEvents.EXTENSION_ACTIVATED;
  buildNumber: string;
  autoSignOut: boolean;
  syncWithProfiles: boolean;
  maxParallelRequests: number;
};

export type ProfileMigrationCalledEvent = {
  type: TelemetryEvents.PROFILES_MIGRATION_CALLED;
};

export type ProfileMigrationCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.PROFILES_MIGRATION_CALLED;
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

export type ServiceProvidedIntoTreeEvent = {
  type: TelemetryEvents.SERVICE_PROVIDED_INTO_TREE;
  source: Source;
};

export type SearchLocationProvidedIntoTreeEvent = {
  type: TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE;
  source: Source;
  serviceSource: Source;
};

export type CommandAddNewServiceCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED;
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
      errorContext: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED;
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

export type CommandAddNewSearchLocationCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED;
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
      errorContext: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED;
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

export type CommandDeleteServiceCalledEvent = {
  type: TelemetryEvents.COMMAND_DELETE_SERVICE_CALLED;
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

export type CommandDeleteSearchLocationCalledEvent = {
  type: TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_CALLED;
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

type CommandGenerateElementInPlaceCalled = {
  type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED;
};

type CommandGenerateElementWithCopyBackCalled = {
  type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED;
  noSource: boolean;
};

export type CommandGenerateElementCalledEvent =
  | CommandGenerateElementInPlaceCalled
  | CommandGenerateElementWithCopyBackCalled;

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

export type CommandGenerateElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED;
      status:
        | GenerateElementInPlaceCommandCompletedStatus.GENERIC_ERROR
        | GenerateWithCopyBackCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED;
      status:
        | GenerateElementInPlaceCommandCompletedStatus.SUCCESS
        | GenerateElementInPlaceCommandCompletedStatus.CANCELLED;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED;
      status:
        | GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_SEARCH_LOCATION
        | GenerateWithCopyBackCommandCompletedStatus.SUCCESS_INTO_DIFFERENT_LOCATION
        | GenerateWithCopyBackCommandCompletedStatus.CANCELLED;
    };

export type CommandPrintListingCallEvent = {
  type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL;
  context:
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED;
};

export type CommandSignoutErrorRecoverCalledEvent = {
  type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED;
  context:
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED
    | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED
    | TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
};

export const enum SignoutErrorRecoverCommandCompletedStatus {
  OVERRIDE_SUCCESS = 'OVERRIDE_SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  CANCELLED = 'CANCELLED',
}

export type CommandSignoutErrorRecoverCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED;
      status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED;
      context:
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED
        | TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED
        | TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
      status:
        | SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.CANCELLED;
    };

export const enum SignOutElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandSignOutElementCalledEvent = {
  type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
  commandArguments: CommandArguments;
};

export type CommandSignOutElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
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
        | TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES;
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
    };

export const enum SettingChangedStatus {
  SUCCESS = 'SUCCESS',
  WRONG_SETTING_TYPE_ERROR = 'WRONG_SETTING_TYPE_ERROR',
}

export type TelemetryEvent =
  | ExtensionActivatedEvent
  | ProfileMigrationCompletedEvent
  | ProfileMigrationCalledEvent
  | ServiceProvidedIntoTreeEvent
  | SearchLocationProvidedIntoTreeEvent
  | CommandAddNewServiceCalledEvent
  | CommandAddNewServiceCompletedEvent
  | CommandAddNewSearchLocationCalledEvent
  | CommandAddNewSearchLocationCompletedEvent
  | ServiceHiddenEvent
  | SearchLocationHiddenEvent
  | CommandDeleteServiceCalledEvent
  | CommandDeleteServiceCompletedEvent
  | CommandDeleteSearchLocationCalledEvent
  | CommandDeleteSearchLocationCompletedEvent
  | CommandGenerateElementCalledEvent
  | CommandGenerateElementCompletedEvent
  | CommandPrintListingCallEvent
  | CommandSignoutErrorRecoverCalledEvent
  | CommandSignoutErrorRecoverCompletedEvent
  | CommandSignOutElementCalledEvent
  | CommandSignOutElementCompletedEvent
  | ServiceConnectionTestEvent
  | RejectUnauthorizedProvidedEvent
  | SettingChangedEvent;
