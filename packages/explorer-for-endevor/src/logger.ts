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
import { logger as baseLogger } from './globals';
import { EndevorId } from './store/_doc/v2/Store';
import { Source } from './store/storage/_doc/Storage';
import {
  Element,
  EndevorResponse,
  ErrorResponseType,
} from '@local/endevor/_doc/Endevor';
import { Logger } from '@local/extension/_doc/Logger';
import { Action, Actions } from './store/_doc/Actions';

type EndevorLoggerContext = {
  serviceId?: EndevorId;
  searchLocationId?: EndevorId;
};

export interface EndevorLogger extends Logger {
  updateContext: (loggerContext: EndevorLoggerContext) => void;
  getContext: () => EndevorLoggerContext;

  traceWithDetails: (msg: string) => void;
  infoWithDetails: (userMsg: string, logMsg?: string) => void;
  warnWithDetails: (userMsg: string, logMsg?: string) => void;
  errorWithDetails: (userMsg: string, logMsg?: string) => void;
}

const createLogWithId = (
  message?: string,
  serviceId?: EndevorId,
  locationId?: EndevorId
): string | undefined => {
  if (!message) {
    return;
  }
  const serviceTag = createTag(serviceId);
  const locationTag = serviceTag ? createTag(locationId) : undefined;
  return `${
    serviceTag
      ? '[' + serviceTag + (locationTag ? '/' + locationTag + '] ' : '] ')
      : ''
  }${message}`;
};

const createTag = (id?: EndevorId): string | undefined => {
  if (!id?.source) {
    return;
  }
  switch (id.source) {
    case Source.INTERNAL:
      return `${id.name}(I)`;
    case Source.SYNCHRONIZED:
      return `${id.name}(S)`;
    default:
      throw new UnreachableCaseError(id.source);
  }
};

export const createEndevorLogger = (
  loggerContext?: EndevorLoggerContext
): EndevorLogger => {
  let context = loggerContext || {};
  return {
    updateContext: (loggerContext) => (context = loggerContext),
    getContext: () => context,
    trace: (msg) => baseLogger.trace(msg),
    info: (userMsg, logMsg) => baseLogger.info(userMsg, logMsg),
    warn: (userMsg, logMsg) => baseLogger.warn(userMsg, logMsg),
    error: (userMsg, logMsg) => baseLogger.error(userMsg, logMsg),
    traceWithDetails: (msg) =>
      baseLogger.trace(
        createLogWithId(msg, context.serviceId, context.searchLocationId) || msg
      ),
    infoWithDetails: (userMsg, logMsg) =>
      baseLogger.info(
        userMsg,
        createLogWithId(logMsg, context.serviceId, context.searchLocationId)
      ),
    warnWithDetails: (userMsg, logMsg) =>
      baseLogger.warn(
        userMsg,
        createLogWithId(logMsg, context.serviceId, context.searchLocationId)
      ),
    errorWithDetails: (userMsg, logMsg) =>
      baseLogger.error(
        userMsg,
        createLogWithId(logMsg, context.serviceId, context.searchLocationId)
      ),
  };
};

export const logActivity =
  (
    dispatch: (action: Action) => Promise<void>,
    context?: {
      serviceId?: EndevorId;
      searchLocationId?: EndevorId;
      element?: Element;
    }
  ) =>
  (actionName: string) =>
  <E extends ErrorResponseType | undefined, R>(
    response: EndevorResponse<E, R>
  ): void => {
    dispatch({
      type: Actions.ACTIVITY_RECORD_ADDED,
      actionName,
      serviceId: context?.serviceId,
      searchLocationId: context?.searchLocationId,
      element: context?.element,
      messages: response.details?.messages,
      returnCode: response.details?.returnCode,
      reportIds: response.details?.reportIds,
    });
  };
