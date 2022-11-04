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
  REFRESH_COMMAND_CALLED = 'refresh tree command called',
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
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED = 'resolve conflict with remote command called',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED = 'resolve conflict with remote command completed',
  COMMAND_SIGNOUT_ERROR_RECOVER_CALLED = 'signout error recover command called',
  COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED = 'signout error recover command completed',
  COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL = 'resolve conflict with remote call performed',
  COMMAND_PRINT_LISTING_CALLED = 'print listing command called',
  COMMAND_PRINT_LISTING_COMPLETED = 'print listing command completed',
  COMMAND_EDIT_ELEMENT_CALLED = 'edit element command called',
  COMMAND_EDIT_ELEMENT_COMPLETED = 'edit element command completed',
  COMMAND_UPLOAD_ELEMENT_CALLED = 'upload element command called',
  COMMAND_UPLOAD_ELEMENT_COMPLETED = 'upload element command completed',
  COMMAND_RETRIEVE_ELEMENT_CALLED = 'retrieve element command called',
  COMMAND_RETRIEVE_ELEMENT_COMPLETED = 'retrieve element command completed',
  COMMAND_SIGNIN_ELEMENT_CALLED = 'signin element command called',
  COMMAND_SIGNIN_ELEMENT_COMPLETED = 'signin element command completed',
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED = 'retrieve element with deps command called',
  COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED = 'retrieve element with deps command completed',
  ELEMENT_DEPENDENCY_WAS_NOT_RETRIEVED = 'element dependency was not fetched',
  COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL = 'discard edited element changes call performed',
  COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED = 'discard edited element changes called',
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED = 'apply diff editor changes called',
  COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED = 'apply diff editor changes completed',
}

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

export type CommandResolveConflictWithRemoteCallEvent = {
  type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL;
  context:
    | TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED
    | TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED;
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
      status: EditElementCommandCompletedStatus.GENERIC_ERROR;
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
  | RefreshCommandCalledEvent
  | CommandAddElementCalledEvent
  | CommandAddElementCompletedEvent
  | ElementsProvidedInTheTreeEvent
  | ElementsFetchedEvent
  | EndevorMapNotBuiltEvent
  | MissingCredentialsPromptCalledEvent
  | MissingCredentialsProvidedEvent
  | CommandViewElementDetailsCalledEvent
  | CommandResolveConflictWithRemoteCallEvent
  | CommandPrintListingCalledEvent
  | CommandPrintElementCalledEvent
  | ElementContentProviderCalledEvent
  | ElementContentProviderCompletedEvent
  | ListingContentProviderCalledEvent
  | ListingContentProviderCompletedEvent
  | CommandSignoutErrorRecoverCalledEvent
  | CommandSignoutErrorRecoverCompletedEvent
  | CommandEditElementCalledEvent
  | CommandEditElementCompletedEvent
  | CommandRetrieveElementCalledEvent
  | CommandRetrieveElementCompletedEvent
  | CommandSignInElementCalledEvent
  | CommandSignInElementCompletedEvent
  | CommandRetrieveElementWithDepsCalledEvent
  | CommandRetrieveElementWithDepsCompletedEvent
  | ElementDependencyWasNotRetrievedEvent
  | CommandUploadElementCompletedEvent
  | CommandUploadElementCalledEvent
  | CommandResolveConflictWithRemoteCalledEvent
  | ResolveConflictWithRemoteCompletedEvent
  | CommandApplyDiffEditorChangesCalledEvent
  | CommandDiscardEditedElementChangesCalledEvent
  | CommandDiscardEditedElementChangesCallEvent
  | CommandApplyDiffEditorChangesCompletedEvent;
