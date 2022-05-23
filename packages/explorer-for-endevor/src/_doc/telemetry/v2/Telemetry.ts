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

import { CommandArguments } from '../../Telemetry';
export const TELEMETRY_EVENTS_VERSION = '2';

export const enum TelemetryEvents {
  ERROR = 'extension error',
  COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED = 'generate element in place command called',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED = 'generate element with copy back command called',
  COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED = 'generate element in place command completed',
  COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED = 'generate element with copy back command completed',
  COMMAND_PRINT_LISTING_CALL = 'print listing command call performed',
  COMMAND_SIGNOUT_ERROR_RECOVER_CALLED = 'signout error recover command called',
  COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED = 'signout error recover command completed',
  COMMAND_SIGNOUT_ELEMENT_CALLED = 'signout element command called',
  COMMAND_SIGNOUT_ELEMENT_COMPLETED = 'signout element command completed',
  COMMAND_ADD_NEW_SERVICE_CALLED = 'add new service command called',
  COMMAND_ADD_NEW_SERVICE_COMPLETED = 'add new service command completed',
  DIALOG_SERVICE_INFO_COLLECTION_CALL = 'service information collection dialog call performed',
}

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

export type CommandAddNewServiceCalledEvent = {
  type: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED;
};

export const enum CommandAddNewServiceCompletedStatus {
  SUCCESS = 'SUCCESS',
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
      status: CommandAddNewServiceCompletedStatus.SUCCESS;
    };

export type DialogServiceInfoCollectionCallEvent = {
  type: TelemetryEvents.DIALOG_SERVICE_INFO_COLLECTION_CALL;
  context: TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED;
};

export type TelemetryEvent =
  | CommandGenerateElementCalledEvent
  | CommandGenerateElementCompletedEvent
  | CommandPrintListingCallEvent
  | CommandSignoutErrorRecoverCalledEvent
  | CommandSignoutErrorRecoverCompletedEvent
  | CommandSignOutElementCalledEvent
  | CommandSignOutElementCompletedEvent
  | CommandAddNewServiceCalledEvent
  | CommandAddNewServiceCompletedEvent
  | DialogServiceInfoCollectionCallEvent;
