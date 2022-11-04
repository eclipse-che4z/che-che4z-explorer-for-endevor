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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Logger } from '@local/extension/_doc/Logger';
import { createTelemetryReporter } from '@local/vscode-wrapper/telemetry';
import { TelemetryProperties } from '@local/vscode-wrapper/_doc/telemetry';
import { ENDEVOR_MESSAGE_CODE_PREFIXES } from './constants';
import { deepCopyError } from './utils';
import {
  TelemetryEvent as V1TelemetryEvent,
  TelemetryEvents as V1TelemetryEvents,
  TELEMETRY_EVENTS_VERSION as V1_TELEMETRY_EVENTS_VERSION,
} from './_doc/Telemetry';
import {
  TelemetryEvent as V2TelemetryEvent,
  TelemetryEvents as V2TelemetryEvents,
  TELEMETRY_EVENTS_VERSION as V2_TELEMETRY_EVENTS_VERSION,
} from './_doc/telemetry/v2/Telemetry';

export type TelemetryEventTypeProperties = { readonly [key: string]: string };

type TelemetryReporter = {
  sendTelemetryEvent: (event: V1TelemetryEvent | V2TelemetryEvent) => void;
  dispose: () => Promise<unknown>;
};

export const createReporter =
  (extensionId: string, extensionVersion: string, key: string) =>
  (logger: Logger): TelemetryReporter => {
    const reporter = createTelemetryReporter(
      extensionId,
      extensionVersion,
      key
    )(logger);
    return {
      sendTelemetryEvent: (
        event: V1TelemetryEvent | V2TelemetryEvent
      ): void => {
        const eventProperties = getTelemetryEventProperties(event);
        switch (event.type) {
          case V2TelemetryEvents.ERROR:
          case V1TelemetryEvents.ERROR:
            reporter.sendTelemetryException(
              getRedactedError(event.error),
              eventProperties
            );
            break;
          default:
            reporter.sendTelemetryEvent(event.type, eventProperties);
        }
      },
      dispose: () => reporter.dispose(),
    };
  };

const getTelemetryEventProperties = (
  event: V1TelemetryEvent | V2TelemetryEvent
): TelemetryProperties => {
  switch (event.type) {
    // deprecated: we only need v1 error type for the backward compatibility between the v1 and v2 type system
    case V1TelemetryEvents.ERROR:
    case V2TelemetryEvents.ERROR:
      return {
        errorContext: event.errorContext,
        status: event.status,
        propertiesTypeVersion: V2_TELEMETRY_EVENTS_VERSION,
      };
    case V2TelemetryEvents.EXTENSION_ACTIVATED:
    case V2TelemetryEvents.SERVICE_HIDDEN:
    case V2TelemetryEvents.SEARCH_LOCATION_HIDDEN:
    case V2TelemetryEvents.SERVICE_PROVIDED_INTO_TREE:
    case V2TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE:
    case V2TelemetryEvents.COMMAND_DELETE_SERVICE_CALLED:
    case V2TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_CALLED:
    case V2TelemetryEvents.PROFILES_MIGRATION_CALLED:
    case V2TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED:
    case V2TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED:
    case V2TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_CALLED:
    case V2TelemetryEvents.PROFILES_MIGRATION_COMPLETED:
    case V2TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED:
    case V2TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED:
    case V2TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED:
    case V2TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED:
    case V2TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED:
    case V2TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED:
    case V2TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED:
    case V2TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED:
    case V2TelemetryEvents.COMMAND_PRINT_LISTING_CALL:
    case V2TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED:
    case V2TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_CALLED:
    case V2TelemetryEvents.SERVICE_CONNECTION_TEST:
    case V2TelemetryEvents.REJECT_UNAUTHORIZED_PROVIDED:
    case V2TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED:
    case V2TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT:
    case V2TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES:
    case V2TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS:
    case V2TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION:
    case V2TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_CALLED:
    case V2TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED:
    case V2TelemetryEvents.COMMAND_REVERT_SECTION_CHANGE_CALLED:
    case V2TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_CALLED:
    case V2TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED:
    case V2TelemetryEvents.COMMAND_INIT_WORKSPACE_CALLED:
    case V2TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED:
    case V2TelemetryEvents.COMMAND_SYNC_WORKSPACE_CALLED:
    case V2TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED:
    case V2TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_CALLED:
    case V2TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED:
    case V2TelemetryEvents.COMMAND_EDIT_CONNECTION_DETAILS_CALLED:
    case V2TelemetryEvents.COMMAND_EDIT_CREDENTIALS_CALLED:
    case V2TelemetryEvents.COMMAND_EDIT_CONNECTION_DETAILS_COMPLETED:
    case V2TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED:
    case V2TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED:
    case V2TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_CALLED: {
      return {
        ...Object.entries(event)
          .map(([key, value]) => {
            const result: [string, string] = [key, value.toString()];
            return result;
          })
          .reduce(
            (
              accum: {
                [key: string]: string;
              },
              [key, value]
            ) => {
              accum[key] = value;
              return accum;
            },
            {}
          ),
        propertiesTypeVersion: V2_TELEMETRY_EVENTS_VERSION,
      };
    }
    case V1TelemetryEvents.ELEMENTS_WERE_FETCHED:
    case V1TelemetryEvents.ELEMENTS_PROVIDED:
    case V1TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED:
    case V1TelemetryEvents.MISSING_CREDENTIALS_PROVIDED:
    case V1TelemetryEvents.ELEMENT_CONTENT_PROVIDER_CALLED:
    case V1TelemetryEvents.LISTING_CONTENT_PROVIDER_CALLED:
    case V1TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED:
    case V1TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED:
    case V1TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED:
    case V1TelemetryEvents.REFRESH_COMMAND_CALLED:
    case V1TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED:
    case V1TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED:
    case V1TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED:
    case V1TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED:
    case V1TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED:
    case V1TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED:
    case V1TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED:
    case V1TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED:
    case V1TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL:
    case V1TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL:
    case V1TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED:
    case V1TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED:
    case V1TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED:
    case V1TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED:
    case V1TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED:
    case V1TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED:
    case V1TelemetryEvents.COMMAND_PRINT_LISTING_CALLED: {
      return {
        ...Object.entries(event)
          .map(([key, value]) => {
            const result: [string, string] = [key, value.toString()];
            return result;
          })
          .reduce(
            (
              accum: {
                [key: string]: string;
              },
              [key, value]
            ) => {
              accum[key] = value;
              return accum;
            },
            {}
          ),
        propertiesTypeVersion: V1_TELEMETRY_EVENTS_VERSION,
      };
    }
    default:
      throw new UnreachableCaseError(event);
  }
};

// TODO: add errors type check for more reliability
export const getRedactedError = (error: Error): Error => {
  let redactedError: Error | undefined = undefined;
  [redactEndevorErrorMessage, redactPathErrorMessage].forEach(
    (redactErrorMessage) => {
      const redactedMessage = redactErrorMessage(
        redactedError ? redactedError : error
      );
      if (redactedMessage) {
        if (!redactedError) {
          redactedError = deepCopyError(error);
        }
        redactedError.message = redactedMessage;
      }
    }
  );
  return redactedError ? redactedError : error;
};

// replace Endevor API messages with only message codes reporting if any
const redactEndevorErrorMessage = (error: Error): string | undefined => {
  const errorCodes = ENDEVOR_MESSAGE_CODE_PREFIXES.flatMap(
    (messagePrefix) =>
      error.message.match(
        new RegExp(`\\b${messagePrefix}[0-9A-Z]{3,4}[ESWIC]\\b`, 'g')
      ) || []
  );
  return errorCodes.length > 0
    ? `<REDACTED: user-endevor-messages> ${errorCodes.sort().join(', ')}`
    : undefined;
};

// replace file system paths in error messages if any
// (also works for element location paths, e.g. ENV/STGNUM/SYS/SUBSYS/ELM and query strings)
const redactPathErrorMessage = (error: Error): string | undefined => {
  // this regular expression is modified version (to catch query string) taken from:
  // https://github.com/microsoft/vscode-extension-telemetry/blob/4dcbf11b82390efd9f65e7a359b91193b2ef33db/src/common/baseTelemetryReporter.ts#L203
  const fileRegex =
    /(file:\/\/)?([a-zA-Z]:(\\\\|\\|\/)|(\\\\|\\|\/))?([\w-._]+(\\\\|\\|\/))+[\w-._]*(\?\S*)?/g;
  return fileRegex.test(error.message)
    ? error.message.replace(fileRegex, '<REDACTED: user-path>')
    : undefined;
};
