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

import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Logger } from '@local/extension/_doc/Logger';
import { createTelemetryReporter } from '@local/vscode-wrapper/telemetry';
import { TelemetryProperties } from '@local/vscode-wrapper/_doc/telemetry';
import { ENDEVOR_MESSAGE_CODE_PREFIXES } from './constants';
import { deepCopyError } from './utils';
import { TelemetryEvent, TelemetryEvents } from './_doc/telemetry/Telemetry';

export type TelemetryEventTypeProperties = { readonly [key: string]: string };

type TelemetryReporter = {
  sendTelemetryEvent: (event: TelemetryEvent) => void;
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
      sendTelemetryEvent: (event: TelemetryEvent): void => {
        const eventProperties = getTelemetryEventProperties(event);
        switch (event.type) {
          case TelemetryEvents.ERROR:
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
  event: TelemetryEvent
): TelemetryProperties => {
  switch (event.type) {
    // deprecated: we only need v1 error type for the backward compatibility between the v1 and v2 type system
    case TelemetryEvents.ERROR:
      return {
        errorContext: event.errorContext,
        status: event.status,
      };
    case TelemetryEvents.EXTENSION_ACTIVATED:
    case TelemetryEvents.SERVICE_HIDDEN:
    case TelemetryEvents.SEARCH_LOCATION_HIDDEN:
    case TelemetryEvents.SERVICE_PROVIDED_INTO_TREE:
    case TelemetryEvents.SERVICES_LOCATIONS_PROVIDED_INTO_TREE:
    case TelemetryEvents.SEARCH_LOCATION_PROVIDED_INTO_TREE:
    case TelemetryEvents.PROFILES_MIGRATION_COMPLETED:
    case TelemetryEvents.COMMAND_EDIT_SERVICE_COMPLETED:
    case TelemetryEvents.COMMAND_DELETE_SERVICE_COMPLETED:
    case TelemetryEvents.COMMAND_GENERATE_ELEMENT_IN_PLACE_COMPLETED:
    case TelemetryEvents.COMMAND_GENERATE_ELEMENT_WITH_COPY_BACK_COMPLETED:
    case TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED:
    case TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED:
    case TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED:
    case TelemetryEvents.COMMAND_DELETE_SEARCH_LOCATION_COMPLETED:
    case TelemetryEvents.SERVICE_CONNECTION_TEST:
    case TelemetryEvents.REJECT_UNAUTHORIZED_PROVIDED:
    case TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT:
    case TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES:
    case TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS:
    case TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION:
    case TelemetryEvents.SETTING_CHANGED_AUTH_WITH_TOKEN:
    case TelemetryEvents.COMMAND_DISCARD_ELEMENT_CHANGES_COMPLETED:
    case TelemetryEvents.COMMAND_CONFIRM_CONFLICT_RESOLUTION_COMPLETED:
    case TelemetryEvents.COMMAND_INIT_WORKSPACE_COMPLETED:
    case TelemetryEvents.COMMAND_SYNC_WORKSPACE_COMPLETED:
    case TelemetryEvents.COMMAND_PULL_FROM_ENDEVOR_COMPLETED:
    case TelemetryEvents.COMMAND_EDIT_CONNECTION_DETAILS_COMPLETED:
    case TelemetryEvents.COMMAND_EDIT_CREDENTIALS_COMPLETED:
    case TelemetryEvents.COMMAND_TEST_CONNECTION_DETAILS_COMPLETED:
    case TelemetryEvents.ELEMENTS_IN_PLACE_TREE_BUILT:
    case TelemetryEvents.ELEMENTS_UP_THE_MAP_TREE_BUILT:
    case TelemetryEvents.COMMAND_TOGGLE_MAP:
    case TelemetryEvents.COMMAND_GENERATE_SUBSYSTEM_ELEMENTS_IN_PLACE_COMPLETED:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_COMPLETED:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_COMPLETED:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_COMPLETED:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_CCID_FILTER_CALL:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_NAME_FILTER_CALL:
    case TelemetryEvents.COMMAND_UPDATE_ELEMENT_TYPE_FILTER_CALL:
    case TelemetryEvents.REPORT_CONTENT_PROVIDER_COMPLETED:
    case TelemetryEvents.COMMAND_PRINT_RESULT_TABLE_CALL:
    case TelemetryEvents.COMMAND_PRINT_ENDEVOR_REPORT_CALL:
    case TelemetryEvents.ELEMENTS_WERE_FETCHED:
    case TelemetryEvents.MISSING_CREDENTIALS_PROVIDED:
    case TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED:
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED:
    case TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL:
    case TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL:
    case TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED:
    case TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED:
    case TelemetryEvents.HISTORY_CONTENT_PROVIDER_COMPLETED:
    case TelemetryEvents.ENDEVOR_MAP_STRUCTURE_BUILT: {
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
      };
    }
    default:
      throw new UnreachableCaseError(event);
  }
};

// TODO: add errors type check for more reliability
export const getRedactedError = (error: Error): Error => {
  let redactedError: Error | undefined = undefined;
  [
    redactEndevorErrorMessage,
    redactPathErrorMessage,
    redactIPErrorMessage,
    redactHostErrorMessage,
    redactTypeParsingErrorMessage,
  ].forEach((redactErrorMessage) => {
    const redactedMessage = redactErrorMessage(
      redactedError ? redactedError : error
    );
    if (redactedMessage) {
      if (!redactedError) {
        redactedError = deepCopyError(error);
      }
      redactedError.message = redactedMessage;
    }
  });
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

// replace user IP in error messages if any
const redactIPErrorMessage = (error: Error): string | undefined => {
  // this regular expression is a modified version taken from:
  // https://stackoverflow.com/questions/53497/regular-expression-that-matches-valid-ipv6-addresses
  const ipv4AndPortRegex =
    /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]):\d{1,5}\b/g;
  return ipv4AndPortRegex.test(error.message)
    ? error.message.replace(ipv4AndPortRegex, '<REDACTED: user-ip>')
    : undefined;
};

// replace user host in error messages if any
const redactHostErrorMessage = (error: Error): string | undefined => {
  // this regular expression is a modified version taken from:
  // https://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
  const hostRegex = /\w+(?:\.\w+){2,}/g;
  return hostRegex.test(error.message)
    ? error.message.replace(hostRegex, '<REDACTED: user-host>')
    : undefined;
};

const redactTypeParsingErrorMessage = (error: Error): string | undefined => {
  const hostRegex = /Invalid value .* supplied to/g;
  return hostRegex.test(error.message)
    ? error.message.replace(hostRegex, '<REDACTED: user-response>')
    : undefined;
};
