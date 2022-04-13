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

export const TELEMETRY_EVENTS_VERSION = '1';

export const enum TelemetryEvents {
  ERROR = 'extension error',
  EXTENSION_ACTIVATED = 'extension activation completed',
  REFRESH_COMMAND_CALLED = 'refresh tree command called',
  ELEMENT_LOCATIONS_PROVIDED = 'element locations provided in the tree',
  ELEMENTS_PROVIDED = 'elements provided in the tree',
  ELEMENTS_WERE_FETCHED = 'elements were fetched',
  ENDEVOR_MAP_STRUCTURE_BUILT = 'endevor map structure built',
  MISSING_CREDENTIALS_PROMPT_CALLED = 'missing credentials prompt called',
  MISSING_CREDENTIALS_PROVIDED = 'missing credentials provided',
  COMMAND_ADD_ELEMENT_CALLED = 'add element command called',
  COMMAND_ADD_ELEMENT_COMPLETED = 'add element command completed',
  COMMAND_PRINT_ELEMENT_CALLED = 'print element command called',
  ELEMENT_CONTENT_PROVIDER_CALLED = 'element content provider called',
  ELEMENT_CONTENT_PROVIDER_COMPLETED = 'element content provider completed',
  LISTING_CONTENT_PROVIDER_CALLED = 'listing content provider called',
  LISTING_CONTENT_PROVIDER_COMPLETED = 'listing content provider completed',
  COMMAND_VIEW_ELEMENT_DETAILS_CALLED = 'view element details command called',
  COMMAND_GENERATE_ELEMENT_CALLED = 'generate element command called',
  COMMAND_GENERATE_ELEMENT_COMPLETED = 'generate element command completed',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED = 'resolve conflict with remote command called',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED = 'resolve conflict with remote command completed',
  COMMAND_PRINT_LISTING_CALL = 'print listing command call performed',
  COMMAND_SIGNOUT_ERROR_RECOVER_CALLED = 'signout error recover command called',
  COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED = 'signout error recover command completed',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL = 'resolve conflict with remote call performed',
  COMMAND_PRINT_LISTING_CALLED = 'print listing command called',
  COMMAND_PRINT_LISTING_COMPLETED = 'print listing command completed',
  COMMAND_EDIT_ELEMENT_CALLED = 'edit element command called',
  COMMAND_EDIT_ELEMENT_COMPLETED = 'edit element command completed',
  COMMAND_UPLOAD_ELEMENT_CALLED = 'upload element command called',
  COMMAND_UPLOAD_ELEMENT_COMPLETED = 'upload element command completed',
  SETTING_CHANGED_AUTO_SIGN_OUT = 'automatic signout setting changed',
  SETTING_CHANGED_EDIT_FOLDER = 'edit folder setting changed',
  SETTING_CHANGED_MAX_PARALLEL_REQUESTS = 'max parallel requests setting changed',
  COMMAND_RETRIEVE_ELEMENT_CALLED = 'retrieve element command called',
  COMMAND_RETRIEVE_ELEMENT_COMPLETED = 'retrieve element command completed',
  COMMAND_SIGNOUT_ELEMENT_CALLED = 'signout element command called',
  COMMAND_SIGNOUT_ELEMENT_COMPLETED = 'signout element command completed',
  COMMAND_SIGNIN_ELEMENT_CALLED = 'signin element command called',
  COMMAND_SIGNIN_ELEMENT_COMPLETED = 'signin element command completed',
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED = 'retrieve element with deps command called',
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED = 'retrieve element with deps command completed',
  ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED = 'element dependency was not fetched',
  COMMAND_ADD_NEW_SERVICE_CALLED = 'add new service command called',
  COMMAND_ADD_NEW_SERVICE_COMPLETED = 'add new service command completed',
  COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED = 'add new search location command called',
  COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED = 'add new search location command completed',
  COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL = 'discard edited element changes call performed',
  COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED = 'discard edited element changes called',
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED = 'apply diff editor changes called',
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED = 'apply diff editor changes completed',
  SERVICE_HIDED = 'service hided from the tree',
  SEARCH_LOCATION_HIDED = 'search location hided from the tree',
}

export type ExtensionActivatedEvent = {
  type: TelemetryEvents.EXTENSION_ACTIVATED;
  buildNumber: string;
  autoSignOut: boolean;
  maxParallelRequests: number;
};

export type RefreshCommandCalledEvent = {
  type: TelemetryEvents.REFRESH_COMMAND_CALLED;
};

export type ElementsProvidedInTheTreeEvent = {
  type: TelemetryEvents.ELEMENTS_PROVIDED;
  elementsInPlace: {
    elements: number;
    systems: number;
    subsystems: number;
    types: number;
  };
  elementsUpTheMap: {
    elements: number;
  };
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
      elementsAmount: number;
    };

export const enum EndevorMapBuildingStatus {
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type EndevorMapNotBuiltEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT;
  status: EndevorMapBuildingStatus.GENERIC_ERROR;
  error: Error;
};

export type ElementLocationsProvidedInTheTreeEvent = {
  type: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED;
  elementLocations: ReadonlyArray<{
    elementLocationsAmount: number;
  }>;
};

export type ElementLocationsNotProvidedInTheTreeEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED;
  status: 'GENERIC_ERROR';
  error: Error;
};

export type MissingCredentialsPromptCalledEvent = {
  type: TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED;
};

export type MissingCredentialsProvidedEvent = {
  type: TelemetryEvents.MISSING_CREDENTIALS_PROVIDED;
};

export type CommandAddElementCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED;
};

export const enum AddElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  DUPLICATED_ELEMENT_ERROR = 'DUPLICATED_ELEMENT_ERROR',
}

export type CommandAddElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED;
      status:
        | AddElementCommandCompletedStatus.GENERIC_ERROR
        | AddElementCommandCompletedStatus.DUPLICATED_ELEMENT_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED;
      status: AddElementCommandCompletedStatus.SUCCESS;
    };

export type CommandPrintElementCalledEvent = {
  type: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED;
};

export type ElementContentProviderCalledEvent = {
  type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_CALLED;
};

export const enum ElementContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ElementContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED;
      status: ElementContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED;
      context: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED;
      status: ElementContentProviderCompletedStatus.SUCCESS;
    };

export type ListingContentProviderCalledEvent = {
  type: TelemetryEvents.LISTING_CONTENT_PROVIDER_CALLED;
};

export const enum ListingContentProviderCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}
export type ListingContentProviderCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED;
      status: ListingContentProviderCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED;
      context: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED;
      status: ListingContentProviderCompletedStatus.SUCCESS;
    };

export const enum TreeElementCommandArguments {
  SINGLE_ELEMENT = 'SINGLE_ELEMENT',
  MULTIPLE_ELEMENTS = 'MULTIPLE_ELEMENTS',
}

export type CommandArguments =
  | {
      type: TreeElementCommandArguments.SINGLE_ELEMENT;
    }
  | {
      type: TreeElementCommandArguments.MULTIPLE_ELEMENTS;
      elementsAmount: number;
    };

export type CommandViewElementDetailsCalledEvent = {
  type: TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED;
  commandArguments: CommandArguments;
};

export type CommandGenerateElementCalledEvent = {
  type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_CALLED;
  commandArguments: CommandArguments;
};

export const enum GenerateElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandPrintListingCallEvent = {
  type: TelemetryEvents.COMMAND_PRINT_LISTING_CALL;
  context: TelemetryEvents.COMMAND_GENERATE_ELEMENT_COMPLETED;
};

export type CommandResolveConflictWithRemoteCallEvent = {
  type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL;
  context:
    | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED
    | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED;
};

export type CommandGenerateElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_GENERATE_ELEMENT_CALLED;
      status: GenerateElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_GENERATE_ELEMENT_COMPLETED;
      status: GenerateElementCommandCompletedStatus.SUCCESS;
    };

export type CommandPrintListingCalledEvent = {
  type: TelemetryEvents.COMMAND_PRINT_LISTING_CALLED;
  commandArguments: CommandArguments;
};

export type CommandSignoutErrorRecoverCalledEvent = {
  type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED;
  context:
    | TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED
    | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED
    | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED
    | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED
    | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED
    | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED;
};

export const enum SignoutErrorRecoverCommandCompletedStatus {
  OVERRIDE_SUCCESS = 'OVERRIDE_SUCCESS',
  SIGNOUT_SUCCESS = 'SIGNOUT_SUCCESS',
  COPY_SUCCESS = 'COPY_SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
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
        | TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED
        | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED
        | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED;
      status:
        | SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.COPY_SUCCESS
        | SignoutErrorRecoverCommandCompletedStatus.SIGNOUT_SUCCESS;
    };

export type CommandEditElementCalledEvent = {
  type: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED;
  commandArguments: CommandArguments;
  autoSignOut: true | false;
};

export const enum EditElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandEditElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED;
      status:
        | EditElementCommandCompletedStatus.GENERIC_ERROR
        | EditElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED;
      status: EditElementCommandCompletedStatus.SUCCESS;
    };

export type CommandRetrieveElementCalledEvent = {
  type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED;
  commandArguments: CommandArguments;
  autoSignOut: true | false;
};

export const enum RetrieveElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandRetrieveElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED;
      status:
        | RetrieveElementCommandCompletedStatus.GENERIC_ERROR
        | RetrieveElementCommandCompletedStatus.NO_OPENED_WORKSPACE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED;
      status: RetrieveElementCommandCompletedStatus.SUCCESS;
    };

export type SettingChangedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext:
        | TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT
        | TelemetryEvents.SETTING_CHANGED_EDIT_FOLDER
        | TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS;
      status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT;
      status: SettingChangedStatus.SUCCESS;
      value: boolean;
    }
  | {
      type: TelemetryEvents.SETTING_CHANGED_EDIT_FOLDER;
      status: SettingChangedStatus.SUCCESS;
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

export type CommandUploadElementCalledEvent = {
  type: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED;
};

export const enum UploadElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandUploadElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED;
      status: UploadElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED;
      status: UploadElementCommandCompletedStatus.SUCCESS;
    };

export type CommandSignOutElementCalledEvent = {
  type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
  commandArguments: CommandArguments;
  context?: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED;
};

export type CommandSignInElementCalledEvent = {
  type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED;
  commandArguments: CommandArguments;
};

export const enum SignOutElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  SIGN_OUT_ERROR = 'SIGN_OUT_ERROR',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export const enum SignInElementCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandSignOutElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED;
      status:
        | SignOutElementCommandCompletedStatus.GENERIC_ERROR
        | SignOutElementCommandCompletedStatus.SIGN_OUT_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED;
      status: SignOutElementCommandCompletedStatus.SUCCESS;
    };
export type CommandSignInElementCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED;
      status: SignInElementCommandCompletedStatus.GENERIC_ERROR;
      error: Error;
    }
  | {
      type: TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED;
      status: SignInElementCommandCompletedStatus.SUCCESS;
    };

export type CommandRetrieveElementWithDepsCalledEvent = {
  type: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED;
  commandArguments: CommandArguments;
  autoSignOut: true | false;
};

export const enum RetrieveElementWithDepsCommandCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
  NO_OPENED_WORKSPACE_ERROR = 'NO_OPENED_WORKSPACE_ERROR',
}

export type CommandRetrieveElementWithDepsCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED;
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

export type CommandAddNewServiceCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED;
};

export const enum CommandAddNewServiceCompletedStatus {
  EXISTING_SERVICE_CHOSEN = 'EXISTING_SERVICE_CHOSEN',
  NEW_SERVICE_CREATED = 'NEW_SERVICE_CREATED',
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
      status:
        | CommandAddNewServiceCompletedStatus.EXISTING_SERVICE_CHOSEN
        | CommandAddNewServiceCompletedStatus.NEW_SERVICE_CREATED;
    };

export type CommandAddNewSearchLocationCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED;
};

export const enum CommandAddNewSearchLocationCompletedStatus {
  USED_EXISTING_LOCATION_CHOSEN = 'USED_EXISTING_LOCATION_CHOSEN',
  UNUSED_EXISTING_LOCATION_CHOSEN = 'UNUSED_EXISTING_LOCATION_CHOSEN',
  NEW_LOCATION_CREATED = 'NEW_LOCATION_CREATED',
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
      status: CommandAddNewSearchLocationCompletedStatus.USED_EXISTING_LOCATION_CHOSEN;
      inUseByServicesAmount: number;
    }
  | {
      type: TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED;
      status:
        | CommandAddNewSearchLocationCompletedStatus.UNUSED_EXISTING_LOCATION_CHOSEN
        | CommandAddNewSearchLocationCompletedStatus.NEW_LOCATION_CREATED;
    };

export type ServiceHidedEvent = {
  type: TelemetryEvents.SERVICE_HIDED;
};

export type SearchLocationHidedEvent = {
  type: TelemetryEvents.SEARCH_LOCATION_HIDED;
};

export type CommandResolveConflictWithRemoteCalledEvent = {
  type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED;
};

export const enum ResolveConflictWithRemoteCompletedStatus {
  SUCCESS = 'SUCCESS',
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type ResolveConflictWithRemoteCompletedEvent =
  | {
      type: TelemetryEvents.ERROR;
      errorContext: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED;
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

export type CommandDiscardEditedElementChangesCalledEvent = {
  type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED;
};

export type CommandApplyDiffEditorChangesCalledEvent = {
  type: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED;
};

export const enum ApplyDiffEditorChangesCompletedStatus {
  GENERIC_ERROR = 'GENERIC_ERROR',
}

export type CommandApplyDiffEditorChangesCompletedEvent = {
  type: TelemetryEvents.ERROR;
  errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED;
  status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR;
  error: Error;
};

export type TelemetryEvent =
  | ExtensionActivatedEvent
  | RefreshCommandCalledEvent
  | CommandAddElementCalledEvent
  | CommandAddElementCompletedEvent
  | ElementsProvidedInTheTreeEvent
  | ElementsFetchedEvent
  | EndevorMapNotBuiltEvent
  | ElementLocationsProvidedInTheTreeEvent
  | ElementLocationsNotProvidedInTheTreeEvent
  | MissingCredentialsPromptCalledEvent
  | MissingCredentialsProvidedEvent
  | CommandGenerateElementCalledEvent
  | CommandGenerateElementCompletedEvent
  | CommandViewElementDetailsCalledEvent
  | CommandPrintListingCallEvent
  | CommandResolveConflictWithRemoteCallEvent
  | CommandPrintListingCalledEvent
  | CommandPrintElementCalledEvent
  | ElementContentProviderCalledEvent
  | ElementContentProviderCompletedEvent
  | ListingContentProviderCalledEvent
  | ListingContentProviderCompletedEvent
  | SettingChangedEvent
  | CommandSignoutErrorRecoverCalledEvent
  | CommandSignoutErrorRecoverCompletedEvent
  | CommandEditElementCalledEvent
  | CommandEditElementCompletedEvent
  | CommandRetrieveElementCalledEvent
  | CommandRetrieveElementCompletedEvent
  | CommandSignOutElementCalledEvent
  | CommandSignInElementCalledEvent
  | CommandSignOutElementCompletedEvent
  | CommandSignInElementCompletedEvent
  | CommandRetrieveElementWithDepsCalledEvent
  | CommandRetrieveElementWithDepsCompletedEvent
  | ElementDependencyWasNotRetrievedEvent
  | CommandUploadElementCompletedEvent
  | CommandUploadElementCalledEvent
  | CommandAddNewServiceCalledEvent
  | CommandAddNewServiceCompletedEvent
  | CommandAddNewSearchLocationCalledEvent
  | CommandAddNewSearchLocationCompletedEvent
  | ServiceHidedEvent
  | SearchLocationHidedEvent
  | CommandResolveConflictWithRemoteCalledEvent
  | ResolveConflictWithRemoteCompletedEvent
  | CommandApplyDiffEditorChangesCalledEvent
  | CommandDiscardEditedElementChangesCalledEvent
  | CommandDiscardEditedElementChangesCallEvent
  | CommandApplyDiffEditorChangesCompletedEvent;

export type TelemetryReporter = {
  sendTelemetryEvent: (event: TelemetryEvent) => void;
  dispose: () => Promise<unknown>;
};
