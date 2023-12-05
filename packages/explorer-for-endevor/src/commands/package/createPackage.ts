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
import { logger } from '../../globals';
import {
  areElementNodesFromSameSearchLocation,
  formatWithNewLines,
} from '../../utils';
import { ElementNode } from '../../tree/_doc/ElementTree';
import { EndevorId } from '../../store/_doc/v2/Store';
import { generateMoveSCL } from '../../scl/move';
import { ErrorResponseType } from '@local/endevor/_doc/Endevor';
import { isErrorEndevorResponse } from '@local/endevor/utils';
import { createEndevorLogger, logActivity } from '../../logger';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { createPackageAndLogActivity } from '../../api/endevor';
import { Action } from '../../store/_doc/Actions';
import { multiStepCreatePackageOptions } from '../../dialogs/multi-step/packageCreate';
import { multiStepMoveOptionsForPackage } from '../../dialogs/multi-step/moveOptions';

export const createPackageCommand =
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
  async (elementNode: ElementNode, nodes?: ElementNode[]) => {
    const elementNodes = nodes?.length ? nodes : [elementNode];
    if (!elementNodes.length) {
      return;
    }
    if (!areElementNodesFromSameSearchLocation(elementNodes)) {
      logger.error(
        'Elements selected for Create package command need to be from the same search location'
      );
      return;
    }
    logger.trace(
      `Create package command was called for ${elementNodes
        .map((node) => {
          const element = node.element;
          `${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${node.name}`;
        })
        .join(',\n ')}.`
    );
    await createPackage(elementNodes, dispatch, getConnectionConfiguration);
  };

const createPackage = async (
  elementNodes: ElementNode[],
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
) => {
  const serviceId = elementNodes[0]?.serviceId;
  const searchLocationId = elementNodes[0]?.searchLocationId;
  if (!serviceId || !searchLocationId) return;
  const logger = createEndevorLogger({
    serviceId,
    searchLocationId,
  });
  const packageOptions = await multiStepCreatePackageOptions();
  if (!packageOptions) {
    logger.errorWithDetails(`Create package was cancelled.`);
    return;
  }
  const packageName = packageOptions.name;
  const moveOptions = await multiStepMoveOptionsForPackage(packageName);
  if (!moveOptions) {
    logger.errorWithDetails(`Create package ${packageName} was cancelled.`);
    return;
  }
  const scl = elementNodes.reduce((finalScl: string, elementNode) => {
    return finalScl + generateMoveSCL(elementNode.element, moveOptions);
  }, '');
  const connectionParams = await getConnectionConfiguration(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const createPackageResponse = await withNotificationProgress(
    `Creating package ${packageName} ...`
  )(async (progressReporter) => {
    return createPackageAndLogActivity(
      logActivity(dispatch, {
        serviceId,
        searchLocationId,
      })
    )(progressReporter)(connectionParams.service)({
      name: packageName,
      description: packageOptions.description,
    })(packageOptions)(scl);
  });
  if (isErrorEndevorResponse(createPackageResponse)) {
    const errorResponse = createPackageResponse;
    const error = new Error(
      `Unable to create package ${packageName} because of an error:${formatWithNewLines(
        errorResponse.details.messages
      )}`
    );
    switch (errorResponse.type) {
      case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
      case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR:
        logger.errorWithDetails(
          'Endevor credentials are incorrect or expired.',
          `${error.message}.`
        );
        return;
      case ErrorResponseType.CERT_VALIDATION_ERROR:
      case ErrorResponseType.CONNECTION_ERROR:
        logger.errorWithDetails(
          'Unable to connect to Endevor Web Services.',
          `${error.message}.`
        );
        return;
      case ErrorResponseType.GENERIC_ERROR:
        logger.errorWithDetails(
          `Unable to create package ${packageName}.`,
          `${error.message}.`
        );
        return;
      default:
        break;
    }
  }
  logger.infoWithDetails(`Package ${packageName} was created successfully!`);
  return scl;
};
