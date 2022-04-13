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
  TreeElementCommandArguments,
  TelemetryEvent,
  TelemetryEvents,
  TelemetryReporter,
  CommandArguments,
  CommandAddNewSearchLocationCompletedStatus,
  CommandAddNewSearchLocationCompletedEvent,
  TELEMETRY_EVENTS_VERSION,
} from './_doc/Telemetry';

export type TelemetryEventTypeProperties = { readonly [key: string]: string };

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

const getTreeElementCommandArgumentsProperties = (
  commandArguments: CommandArguments
): TelemetryEventTypeProperties => {
  switch (commandArguments.type) {
    case TreeElementCommandArguments.SINGLE_ELEMENT:
      return {
        commandArguments: commandArguments.type,
      };
    case TreeElementCommandArguments.MULTIPLE_ELEMENTS:
      return {
        commandArguments: commandArguments.type,
        elementsAmount: commandArguments.elementsAmount.toString(),
      };
    default:
      throw new UnreachableCaseError(commandArguments);
  }
};

const getAddNewSearchLocationCompletedEventProperties = (
  event: CommandAddNewSearchLocationCompletedEvent
): TelemetryEventTypeProperties | undefined => {
  switch (event.status) {
    case CommandAddNewSearchLocationCompletedStatus.USED_EXISTING_LOCATION_CHOSEN:
      return {
        inUseByServicesAmount: event.inUseByServicesAmount.toString(),
      };
    case CommandAddNewSearchLocationCompletedStatus.UNUSED_EXISTING_LOCATION_CHOSEN:
    case CommandAddNewSearchLocationCompletedStatus.NEW_LOCATION_CREATED:
    case CommandAddNewSearchLocationCompletedStatus.GENERIC_ERROR:
      return undefined;
    default:
      throw new UnreachableCaseError(event);
  }
};

const getTelemetryEventTypeProperties = (
  event: TelemetryEvent
): TelemetryEventTypeProperties | undefined => {
  switch (event.type) {
    case TelemetryEvents.ERROR:
      return {
        errorContext: event.errorContext,
        status: event.status,
      };
    case TelemetryEvents.EXTENSION_ACTIVATED:
      return {
        buildNumber: event.buildNumber,
        autoSignOut: `${event.autoSignOut}`,
        maxParallelRequests: event.maxParallelRequests.toString(),
      };
    case TelemetryEvents.ELEMENTS_WERE_FETCHED: {
      return {
        propertiesTypeVersion: TELEMETRY_EVENTS_VERSION,
        elementsAmount: event.elementsAmount.toString(),
      };
    }
    case TelemetryEvents.ELEMENTS_PROVIDED:
      return {
        elementsInPlace: event.elementsInPlace.elements.toString(),
        systemsInPlace: event.elementsInPlace.systems.toString(),
        subsystemsInPlace: event.elementsInPlace.subsystems.toString(),
        typesInPlace: event.elementsInPlace.types.toString(),
        elementsUpTheMap: event.elementsUpTheMap.elements.toString(),
      };
    case TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED:
    case TelemetryEvents.MISSING_CREDENTIALS_PROVIDED:
    case TelemetryEvents.ELEMENT_CONTENT_PROVIDER_CALLED:
    case TelemetryEvents.LISTING_CONTENT_PROVIDER_CALLED:
    case TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_ADD_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_ADD_NEW_SERVICE_CALLED:
    case TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_CALLED:
    case TelemetryEvents.SERVICE_HIDED:
    case TelemetryEvents.SEARCH_LOCATION_HIDED:
    case TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALLED:
    case TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED:
    case TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED:
    case TelemetryEvents.REFRESH_COMMAND_CALLED:
      return undefined;
    case TelemetryEvents.COMMAND_ADD_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_SIGNIN_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_EDIT_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_COMPLETED:
    case TelemetryEvents.SETTING_CHANGED_EDIT_FOLDER:
    case TelemetryEvents.COMMAND_GENERATE_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED:
    case TelemetryEvents.COMMAND_ADD_NEW_SERVICE_COMPLETED:
    case TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_COMPLETED:
      return {
        status: event.status,
      };
    case TelemetryEvents.COMMAND_ADD_NEW_SEARCH_LOCATION_COMPLETED:
      return {
        status: event.status,
        ...getAddNewSearchLocationCompletedEventProperties(event),
      };
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_COMPLETED:
      return {
        status: event.status,
        dependenciesAmount: event.dependenciesAmount.toString(),
      };
    case TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED:
    case TelemetryEvents.COMMAND_PRINT_LISTING_CALL:
    case TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL:
    case TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL:
      return {
        context: event.context,
      };
    case TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED:
    case TelemetryEvents.ELEMENT_CONTENT_PROVIDER_COMPLETED:
    case TelemetryEvents.LISTING_CONTENT_PROVIDER_COMPLETED:
      return {
        status: event.status,
        context: event.context,
      };
    case TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT:
    case TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS:
      return {
        status: event.status,
        value: event.value.toString(),
      };
    case TelemetryEvents.COMMAND_EDIT_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_RETRIEVE_ELEMENT_WITH_DEPS_CALLED:
      return {
        ...getTreeElementCommandArgumentsProperties(event.commandArguments),
        autoSignOut: event.autoSignOut.toString(),
      };
    case TelemetryEvents.COMMAND_GENERATE_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_VIEW_ELEMENT_DETAILS_CALLED:
    case TelemetryEvents.COMMAND_SIGNOUT_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_SIGNIN_ELEMENT_CALLED:
    case TelemetryEvents.COMMAND_PRINT_LISTING_CALLED:
      return {
        ...getTreeElementCommandArgumentsProperties(event.commandArguments),
      };
    case TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED:
      return {
        servicesAmount: event.elementLocations.length.toString(),
        ...event.elementLocations.reduce((accum, curValue, curIndex) => {
          return {
            ...accum,
            [`locationsInService ${curIndex.toString()}`]:
              curValue.elementLocationsAmount.toString(),
          };
        }, {}),
      };
    default:
      throw new UnreachableCaseError(event);
  }
};

const getTelemetryEventProperties = (
  event: TelemetryEvent
): TelemetryProperties => {
  switch (event.type) {
    // can be specified separately for each event type in future
    default:
      return {
        ...getTelemetryEventTypeProperties(event),
        propertiesTypeVersion: TELEMETRY_EVENTS_VERSION,
      };
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
