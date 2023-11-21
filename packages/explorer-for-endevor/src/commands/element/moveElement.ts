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

import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { fetchElement, moveElementAndLogActivity } from '../../api/endevor';
import { reporter } from '../../globals';
import { formatWithNewLines, isError } from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { Action, Actions } from '../../store/_doc/Actions';
import { Element, ErrorResponseType } from '@local/endevor/_doc/Endevor';
import {
  FetchElementCommandCompletedStatus,
  MoveElementCommandCompletedStatus,
  TelemetryEvents,
} from '../../telemetry/_doc/Telemetry';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { multiStepMoveOptions } from '../../dialogs/multi-step/moveOptions';
import {
  CachedEndevorInventory,
  ElementsUpTheMapFilter,
  EndevorId,
} from '../../store/_doc/v2/Store';
import {
  fromSubsystemMapPathId,
  toSubsystemMapPathId,
} from '../../store/utils';
import { getNextLocationOnMap } from '../../tree/endevorMap';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

export const moveElementCommand =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >,
    getEndevorInventory: (
      serviceId: EndevorId
    ) => (searchLocationId: EndevorId) => CachedEndevorInventory | undefined,
    getElementsUpTheMapFilterValue: (
      serviceId: EndevorId
    ) => (searchLocationId: EndevorId) => ElementsUpTheMapFilter | undefined
  ) =>
  async (elementNode: ElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId: elementNode.serviceId,
      searchLocationId: elementNode.searchLocationId,
    });
    const element = elementNode.element;
    logger.traceWithDetails(
      `Move command was called for ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}.`
    );
    await moveSingleElement(
      dispatch,
      getConnectionConfiguration,
      getEndevorInventory,
      getElementsUpTheMapFilterValue
    )(elementNode);
  };

const moveSingleElement =
  (
    dispatch: (action: Action) => Promise<void>,
    getConnectionConfiguration: (
      serviceId: EndevorId,
      searchLocationId: EndevorId
    ) => Promise<
      | {
          service: EndevorAuthorizedService;
          searchLocation: SearchLocation;
        }
      | undefined
    >,
    getEndevorInventory: (
      serviceId: EndevorId
    ) => (searchLocationId: EndevorId) => CachedEndevorInventory | undefined,
    getElementsUpTheMapFilterValue: (
      serviceId: EndevorId
    ) => (searchLocationId: EndevorId) => ElementsUpTheMapFilter | undefined
  ) =>
  async ({
    element,
    serviceId,
    searchLocationId,
  }: ElementNode): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const moveOptions = await multiStepMoveOptions(
      searchLocation.ccid,
      searchLocation.comment
    );
    if (!moveOptions) {
      logger.error(`Move for the element ${element.name} was cancelled.`);
      return;
    }
    const actionControlValue = {
      ccid: moveOptions.ccid,
      comment: moveOptions.comment,
    };
    const moveResponse = await withNotificationProgress(
      `Moving element ${element.name} ...`
    )((progressReporter) =>
      moveElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)(actionControlValue)(moveOptions)
    );
    if (isErrorEndevorResponse(moveResponse)) {
      const errorResponse = moveResponse;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to move element ${element.environment}/${element.stageNumber}/${
          element.system
        }/${element.subSystem}/${element.type}/${
          element.name
        } because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      logger.trace(`${error.message}.`);
      switch (errorResponse.type) {
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
          logger.errorWithDetails(
            `Endevor credentials are incorrect or expired.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: MoveElementCommandCompletedStatus.GENERIC_ERROR,
            errorContext: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED,
            error,
          });
          return;
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR:
          logger.errorWithDetails(`Unable to connect to Endevor Web Services.`);
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: MoveElementCommandCompletedStatus.GENERIC_ERROR,
            errorContext: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED,
            error,
          });
          return;
        case ErrorResponseType.GENERIC_ERROR: {
          logger.errorWithDetails(
            `Unable to move element ${element.name}.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            status: MoveElementCommandCompletedStatus.GENERIC_ERROR,
            errorContext: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED,
            error,
          });
          return;
        }
        default:
          throw new UnreachableCaseError(errorResponse.type);
      }
    }
    const resultWithWarnings =
      moveResponse.details && moveResponse.details.returnCode >= 4;
    logger.traceWithDetails(
      `Element ${element.environment}/${element.stageNumber}/${
        element.system
      }/${element.subSystem}/${element.type}/${element.name} is moved ${
        resultWithWarnings ? 'with warnings' : 'successfully'
      }${
        moveResponse.details?.messages.length
          ? `:${formatWithNewLines(moveResponse.details.messages)}.`
          : '.'
      }`
    );
    const upTheMapFilterValue =
      !!getElementsUpTheMapFilterValue(serviceId)(searchLocationId)?.value;
    const endevorMap =
      getEndevorInventory(serviceId)(searchLocationId)?.endevorMap;
    const elementsToUpdate: {
      sourceElement?: Element;
      targetElement?: Element;
    } = moveOptions.bypassElementDelete ? { sourceElement: element } : {};
    let targetElement: Element | undefined = undefined;
    if (!moveOptions.bypassElementDelete) {
      const nextMapLocationId = endevorMap
        ? getNextLocationOnMap(toSubsystemMapPathId(element))(endevorMap)
        : undefined;
      targetElement =
        nextMapLocationId && upTheMapFilterValue
          ? {
              ...element,
              ...fromSubsystemMapPathId(nextMapLocationId),
              lastActionCcid: actionControlValue.ccid.toUpperCase(),
              signoutId: moveOptions.retainSignout
                ? element.signoutId
                : undefined,
              vvll:
                !moveOptions.withHistory || moveOptions.synchronize
                  ? undefined
                  : element.vvll,
            }
          : undefined;
      elementsToUpdate.targetElement = targetElement;
    }
    dispatch({
      type: Actions.ELEMENT_MOVED,
      serviceId,
      searchLocationId,
      bypassElementDelete: moveOptions.bypassElementDelete,
      sourceElement: element,
      targetElement,
    });
    if (elementsToUpdate.sourceElement || elementsToUpdate.targetElement) {
      await fetchMovedElement(dispatch)(serviceId, searchLocationId)(service)(
        elementsToUpdate
      );
    }
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_MOVE_ELEMENT_COMPLETED,
      status: MoveElementCommandCompletedStatus.SUCCESS,
    });
  };

const fetchMovedElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  async (elements: {
    sourceElement?: Element;
    targetElement?: Element;
  }): Promise<void> => {
    const logger = createEndevorLogger({
      serviceId,
      searchLocationId,
    });
    const elementFetchResponse = await withNotificationProgress(
      `Fetching moved element(s) ...`
    )((progressReporter) => {
      const sourceElementPromise = elements.sourceElement
        ? fetchElement(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
              element: elements.sourceElement,
            })
          )(progressReporter)(service)(elements.sourceElement)
        : Promise.resolve(undefined);
      const targetElementPromise = elements.targetElement
        ? fetchElement(
            setLogActivityContext(dispatch, {
              serviceId,
              searchLocationId,
              element: elements.targetElement,
            })
          )(progressReporter)(service)(elements.targetElement)
        : Promise.resolve(undefined);
      return Promise.all([sourceElementPromise, targetElementPromise]);
    });

    const [sourceElement, targetElement] = elementFetchResponse;

    if (isError(sourceElement) || isError(targetElement)) {
      [sourceElement, targetElement].forEach((response) => {
        if (isError(response)) {
          const error = response;
          logger.errorWithDetails(error.name, error.message);
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            // TODO: specific completed status?
            status: FetchElementCommandCompletedStatus.GENERIC_ERROR,
            errorContext: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED,
            error,
          });
        }
      });
      return;
    }
    const elementsToUpdate = [
      ...(sourceElement || []),
      ...(targetElement || []),
    ];
    dispatch({
      type: Actions.SELECTED_ELEMENTS_FETCHED,
      serviceId,
      searchLocationId,
      elements: elementsToUpdate,
    });
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_FETCH_ELEMENT_COMPLETED,
      context: TelemetryEvents.COMMAND_MOVE_ELEMENT_CALLED,
      status: FetchElementCommandCompletedStatus.SUCCESS,
    });
  };
