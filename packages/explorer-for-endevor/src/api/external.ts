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

import { Element, ResponseStatus } from '@local/endevor/_doc/Endevor';
import { withNotificationProgress } from '@local/vscode-wrapper/window';
import { EventEmitter, Uri } from 'vscode';
import { EndevorId } from '../store/_doc/v2/Store';
import {
  fromEditedElementUri,
  toEditedElementUri,
} from '../uri/editedElementUri';
import {
  formatWithNewLines,
  getEditFolderUri,
  isDefined,
  isError,
} from '../utils';
import { logger } from '../globals';
import { EndevorAuthorizedService, SearchLocation } from './_doc/Endevor';
import { validateStageNumber } from '@local/endevor/utils';
import { Action } from '../store/_doc/Actions';
import { createEndevorLogger, logActivity } from '../logger';
import {
  printMemberAndLogActivity,
  retrieveElementFirstFoundAndLogActivity,
  searchForAllMembersFromDatasetAndLogActivity,
  searchForFirstFoundElementsAndLogActivity,
} from './endevor';
import { getConfiguration } from './lspconfig/lspconfig';
import { ErrorResponseType as ConfigsErrorResponseType } from './lspconfig/_doc/Endevor';
import { ExternalEndevorApi, ElementInfo } from './_doc/Api';

export const emitElementsUpdatedEvent =
  (
    elementInvalidateEmitter: EventEmitter<ElementInfo[]>,
    getTempEditFolderUri: () => Uri
  ) =>
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    elements: ReadonlyArray<Element>
  ) => {
    if (!elements.length) {
      return;
    }
    const changedElements = elements
      .map((element) => {
        if (!element.fingerprint) {
          return;
        }
        const editFolderUri = getEditFolderUri(getTempEditFolderUri())(
          serviceId,
          searchLocationId
        )(element);
        const editedElementUri = toEditedElementUri(editFolderUri.fsPath)({
          element,
          fingerprint: element.fingerprint,
          searchContext: {
            serviceId,
            searchLocationId,
            initialSearchLocation: {
              subSystem: element.subSystem,
              system: element.system,
              stageNumber: element.stageNumber,
              environment: element.environment,
            },
          },
        });
        return isError(editedElementUri)
          ? undefined
          : {
              sourceUri: editedElementUri.toString(),
              environment: element.environment,
              stage: element.stageNumber,
              system: element.system,
              subsystem: element.subSystem,
              type: element.type,
              processorGroup: element.processorGroup,
              fingerprint: element.fingerprint,
              element: element.name,
            };
      })
      .filter(isDefined);
    elementInvalidateEmitter.fire(changedElements);
  };

const getElementInfoFromUri = async (
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
  uriString: string
): Promise<
  | {
      service: EndevorAuthorizedService;
      serviceId: EndevorId;
      searchLocationId: EndevorId;
      element: Element;
    }
  | Error
> => {
  const uri = Uri.parse(uriString);
  const uriParams = fromEditedElementUri(uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.trace(
      `Unable to list elements because parsing of the element's URI failed with error ${error.message}.`
    );
    return error;
  }
  const e4eLogger = createEndevorLogger({
    serviceId: uriParams.searchContext.serviceId,
    searchLocationId: uriParams.searchContext.searchLocationId,
  });
  const connectionConfiguration = await getConnectionConfiguration(
    uriParams.searchContext.serviceId,
    uriParams.searchContext.searchLocationId
  );
  if (!connectionConfiguration) {
    const error = new Error('Cannot find connection configuration');
    e4eLogger.traceWithDetails(error.message);
    return error;
  }
  return {
    service: connectionConfiguration.service,
    serviceId: uriParams.searchContext.serviceId,
    searchLocationId: uriParams.searchContext.searchLocationId,
    element: uriParams.element,
  };
};

export const make =
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
    getTempEditFolderUri: () => Uri
  ) =>
  (
    elementInvalidateEmitter: EventEmitter<ElementInfo[]>
  ): ExternalEndevorApi => {
    return {
      isEndevorElement(uriString) {
        const uri = Uri.parse(uriString);
        const uriParams = fromEditedElementUri(uri);
        if (isError(uriParams)) return false;
        return uri.path
          .toLowerCase()
          .startsWith(getTempEditFolderUri().path.toLowerCase());
      },
      async getEndevorElementInfo(uriString) {
        const connectionInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(connectionInfo)) {
          return connectionInfo;
        }
        const { service, element } = connectionInfo;
        return [
          {
            environment: element.environment,
            stage: element.stageNumber,
            system: element.system,
            subsystem: element.subSystem,
            type: element.type,
            element: element.name,
            processorGroup: element.processorGroup,
            fingerprint: element.fingerprint,
          },
          service.configuration,
        ];
      },
      async listElements(uriString, type) {
        const connectionInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(connectionInfo)) {
          return connectionInfo;
        }
        const stageNumber = validateStageNumber(type.stage);
        if (isError(stageNumber)) {
          return stageNumber;
        }
        return withNotificationProgress('Listing Elements ...')(
          async (progress) => {
            const elementsResponse =
              await searchForFirstFoundElementsAndLogActivity(
                logActivity(dispatch, {
                  serviceId: connectionInfo.serviceId,
                  searchLocationId: connectionInfo.searchLocationId,
                })
              )(progress)(connectionInfo.service)({
                environment: type.environment,
                stageNumber,
              })(type.system, type.subsystem, type.type);
            if (elementsResponse.status === ResponseStatus.ERROR) {
              return new Error(
                `Unable to fetch elements information because of error:${formatWithNewLines(
                  elementsResponse.details.messages
                )}`
              );
            }
            return elementsResponse.result.map((element) => [
              element.name,
              element.fingerprint ?? '',
            ]);
          }
        );
      },
      async getElement(uriString, type) {
        const connectionInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(connectionInfo)) {
          return connectionInfo;
        }
        const stageNumber = validateStageNumber(type.stage);
        if (isError(stageNumber)) {
          return stageNumber;
        }
        return withNotificationProgress(
          `Getting Element ${type.element} of type ${type.type} ...`
        )(async (progress) => {
          const elementResponse = await retrieveElementFirstFoundAndLogActivity(
            logActivity(dispatch, {
              serviceId: connectionInfo.serviceId,
              searchLocationId: connectionInfo.searchLocationId,
            })
          )(progress)(connectionInfo.service)({
            environment: type.environment,
            stageNumber,
            system: type.system,
            subSystem: type.subsystem,
            type: type.type,
            id: type.element,
          });
          if (elementResponse.status === ResponseStatus.ERROR) {
            return new Error(
              `Unable to print the content of element ${type.environment}/${
                type.stage
              }/${type.system}/${type.subsystem}/${type.type}/${
                type.element
              } because of error:\n${formatWithNewLines(
                elementResponse.details.messages
              )}`
            );
          }
          return [
            elementResponse.result.content,
            elementResponse.result.fingerprint,
          ];
        });
      },
      async listMembers(uriString, type) {
        const connectionInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(connectionInfo)) {
          return connectionInfo;
        }
        return withNotificationProgress(
          `Listing Members from dataset ${type.dataset} ...`
        )(async (progress) => {
          const membersResponse =
            await searchForAllMembersFromDatasetAndLogActivity(
              logActivity(dispatch, {
                serviceId: connectionInfo.serviceId,
                searchLocationId: connectionInfo.searchLocationId,
              })
            )(progress)(connectionInfo.service)({ name: type.dataset });
          if (membersResponse.status === ResponseStatus.ERROR) {
            return new Error(
              `Unable to fetch members information from dataset ${
                type.dataset
              } because of error:${formatWithNewLines(
                membersResponse.details.messages
              )}`
            );
          }
          return membersResponse.result.map((member) => member.name);
        });
      },
      async getMember(uriString, type) {
        const connectionInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(connectionInfo)) {
          return connectionInfo;
        }
        return withNotificationProgress(
          `Getting Member ${type.member} from ${type.dataset}`
        )(async (progress) => {
          const printMemberResponse = await printMemberAndLogActivity(
            logActivity(dispatch, {
              serviceId: connectionInfo.serviceId,
              searchLocationId: connectionInfo.searchLocationId,
            })
          )(progress)(connectionInfo.service)({
            name: type.member,
            dataset: { name: type.dataset },
          });
          if (printMemberResponse.status === ResponseStatus.ERROR) {
            return new Error(
              `Unable to print the content of member ${
                type.member
              } from dataset ${
                type.dataset
              } because of error:\n${formatWithNewLines(
                printMemberResponse.details.messages
              )}`
            );
          }
          return printMemberResponse.result;
        });
      },
      getConfiguration: async (uriString: string) => {
        const elementInfo = await getElementInfoFromUri(
          getConnectionConfiguration,
          uriString
        );
        if (isError(elementInfo)) {
          return elementInfo;
        }
        const { service, element } = elementInfo;
        const result = await withNotificationProgress(
          `Getting endevor configurations`
        )(async (progress) => {
          return getConfiguration(progress)(service)({
            environment: element.environment,
            stageNumber: element.stageNumber,
            system: element.system,
            subSystem: element.subSystem,
            type: element.type,
            id: element.id,
          })();
        });
        if (result.status === ResponseStatus.ERROR) {
          const errorMessage = result.details.messages
            .map((message) => message.trim())
            .join(',');
          if (result.type === ConfigsErrorResponseType.IMPORT_ERROR) {
            logger.warn(
              `Failed to instantiate Endevor Configurations API`,
              `Failed to instantiate Endevor Configurations API because of error: ${errorMessage}`
            );
            return new Error(errorMessage);
          }
          logger.warn(
            `Failed to fetch Endevor Configurations`,
            `Failed to fetch Endevor Configurations because of error: ${errorMessage}`
          );
          return new Error(errorMessage);
        }
        return result.result;
      },
      getElementInvalidateEmitter: (): EventEmitter<ElementInfo[]> =>
        elementInvalidateEmitter,
    };
  };
