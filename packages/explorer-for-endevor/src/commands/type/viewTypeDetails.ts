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

import { TypeNode } from '../../tree/_doc/ElementTree';
import {
  getProcessorGroupsByTypeAndLogActivity,
  searchForTypesInPlaceAndLogActivity,
} from '../../api/endevor';
import {
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';
import { Action } from '../../store/_doc/Actions';
import {
  showWebView,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { formatWithNewLines } from '../../utils';
import {
  ElementTypeResponseObject,
  ErrorResponseType,
  ProcessorGroupResponseObject,
} from '@local/endevor/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { COMMAND_PREFIX } from '../../constants';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';

export const viewTypeDetails =
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
    >
  ) =>
  async (typeNode: TypeNode): Promise<void> => {
    const logger = createEndevorLogger();
    logger.traceWithDetails(
      `View type details command was called for ${typeNode.name}`
    );
    const serviceId = typeNode.parent.serviceId;
    const searchLocationId = typeNode.parent.searchLocationId;
    const connectionParams = await getConnectionConfiguration(
      serviceId,
      searchLocationId
    );
    if (!connectionParams) return;
    const { service, searchLocation } = connectionParams;
    const [successfulTypesResponse, processorGroupsResponse] =
      await withNotificationProgress('Fetching type info ...')(
        (progressReporter) =>
          Promise.all([
            (async (): Promise<ElementTypeResponseObject | undefined> => {
              const typeInfoResponse =
                await searchForTypesInPlaceAndLogActivity(
                  setLogActivityContext(dispatch, {
                    serviceId,
                    searchLocationId,
                  })
                )(progressReporter)(service)(searchLocation)({
                  ...searchLocation,
                  type: typeNode.name,
                });

              if (isErrorEndevorResponse(typeInfoResponse)) {
                const errorResponse = typeInfoResponse;
                // TODO: format using all possible error details
                const error = new Error(
                  `Unable to retrieve type details for type ${
                    typeNode.name
                  } because of error:${formatWithNewLines(
                    errorResponse.details.messages
                  )}`
                );
                switch (errorResponse.type) {
                  case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
                  case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
                    logger.errorWithDetails(
                      `Endevor credentials are incorrect or expired.`,
                      `${error.message}.`
                    );
                    // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
                    return;
                  case ErrorResponseType.CERT_VALIDATION_ERROR:
                  case ErrorResponseType.CONNECTION_ERROR:
                    logger.errorWithDetails(
                      `Unable to connect to Endevor Web Services.`,
                      `${error.message}.`
                    );
                    // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
                    return;
                  case ErrorResponseType.GENERIC_ERROR:
                    logger.errorWithDetails(
                      `Unable to retrieve type details for type ${typeNode.name}`,
                      `${error.message}.`
                    );
                    return;
                  default:
                    throw new UnreachableCaseError(errorResponse.type);
                }
              }

              const successfulTypesResponse = typeInfoResponse.result[0];
              if (!successfulTypesResponse) {
                logger.errorWithDetails(
                  `Unable to retrieve type details for type ${typeNode.name}`
                );
                return;
              }
              return successfulTypesResponse;
            })(),
            (async (): Promise<
              ReadonlyArray<ProcessorGroupResponseObject> | undefined
            > => {
              const processorGroupsResponse =
                await getProcessorGroupsByTypeAndLogActivity(
                  setLogActivityContext(dispatch, {
                    serviceId,
                    searchLocationId,
                  })
                )(service)(progressReporter)({
                  ...searchLocation,
                  type: typeNode.name,
                })();

              if (isErrorEndevorResponse(processorGroupsResponse)) {
                const errorResponse = processorGroupsResponse;
                // TODO: format using all possible error details
                const error = new Error(
                  `Unable to retrieve processor groups info for type ${
                    typeNode.name
                  } because of error:${formatWithNewLines(
                    errorResponse.details.messages
                  )}`
                );
                switch (errorResponse.type) {
                  case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
                  case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
                    logger.errorWithDetails(
                      `Endevor credentials are incorrect or expired.`,
                      `${error.message}.`
                    );
                    // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
                    return;
                  case ErrorResponseType.CERT_VALIDATION_ERROR:
                  case ErrorResponseType.CONNECTION_ERROR:
                    logger.errorWithDetails(
                      `Unable to connect to Endevor Web Services.`,
                      `${error.message}.`
                    );
                    // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
                    return;
                  case ErrorResponseType.GENERIC_ERROR:
                    logger.errorWithDetails(
                      `Unable to retrieve processor groups info for type ${typeNode.name}`,
                      `${error.message}.`
                    );
                    return;
                  default:
                    throw new UnreachableCaseError(errorResponse.type);
                }
              }
              return processorGroupsResponse.result;
            })(),
          ])
      );
    if (!successfulTypesResponse || !processorGroupsResponse) return;
    showTypeAttributes(
      typeNode,
      processorGroupsResponse,
      successfulTypesResponse
    );
  };

const showTypeAttributes = (
  typeNode: TypeNode,
  processorGroups: ReadonlyArray<ProcessorGroupResponseObject>,
  successTypesResponse: ElementTypeResponseObject
): void => {
  const panelTitle = typeNode.name + ' - Details';
  const panelBody = renderTypeAttributes(
    typeNode.name,
    successTypesResponse,
    processorGroups
  );
  showWebView(COMMAND_PREFIX)(panelTitle, panelBody);
};

const renderTypeAttributes = (
  typeName: string,
  successTypesResponse: ElementTypeResponseObject,
  processorGroups: ReadonlyArray<ProcessorGroupResponseObject>
) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${typeName} - Details</title>
</head>
<body>
  <table>
    <tr>
      <td> environment </td>
      <td>:</td>
      <td>${successTypesResponse.environment} </td>
    </tr>
    <tr>
      <td> stageId </td>
      <td>:</td>
      <td>${successTypesResponse.stageId} </td>
    </tr>
    <tr>
      <td> system </td>
      <td>:</td>
      <td>${successTypesResponse.system} </td>
    </tr>
    <tr>
      <td> type </td>
      <td>:</td>
      <td>${successTypesResponse.type} </td>
    </tr>
    <tr>
      <td> description </td>
      <td>:</td>
      <td>${successTypesResponse.description} </td>
    </tr>
    <tr>
      <td> dataFm </td>
      <td>:</td>
      <td>${successTypesResponse.dataFm || 'N/A'} </td>
    </tr>
    <tr>
      <td> fileExt </td>
      <td>:</td>
      <td>${successTypesResponse.fileExt || 'N/A'} </td>
    </tr>
    <tr>
      <td> lang </td>
      <td>:</td>
      <td>${successTypesResponse.lang} </td>
    </tr>
    <tr>
      <td> defaultPrcGrp </td>
      <td>:</td>
      <td>${successTypesResponse.defaultPrcGrp} </td>
    </tr>
    <tr>
      <td style="vertical-align: top;"> processor group names </td>
      <td style="vertical-align: top;">:</td>
      <td>${processorGroups
        .map((group) => `${group.procGroupName}`)
        .join('<br>')} </td>
    </tr>
  </table>
</body>
</html>`;
