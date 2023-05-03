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

import { Service } from '@local/endevor/_doc/Endevor';
import { logger } from '../globals';
import { toServiceLocationCompositeKey } from '../store/utils';
import {
  EndevorConfiguration,
  EndevorId,
  ValidEndevorConnection,
  ValidEndevorCredential,
} from '../store/_doc/v2/Store';
import { ElementNode } from '../tree/_doc/ElementTree';
import { SearchLocation } from '../_doc/Endevor';
import { Uri } from 'vscode';
import { showFileContent } from '@local/vscode-wrapper/window';

export type ConnectionConfigurations = {
  getConnectionDetails: (
    id: EndevorId
  ) => Promise<ValidEndevorConnection | undefined>;
  getEndevorConfiguration: (
    serviceId?: EndevorId,
    searchLocationId?: EndevorId
  ) => Promise<EndevorConfiguration | undefined>;
  getCredential: (
    connection: ValidEndevorConnection,
    configuration: EndevorConfiguration
  ) => (credentialId: EndevorId) => Promise<ValidEndevorCredential | undefined>;
  getSearchLocation: (
    searchLocationId: EndevorId
  ) => Promise<SearchLocation | undefined>;
};

export const getConnectionConfiguration =
  ({
    getConnectionDetails,
    getEndevorConfiguration,
    getCredential,
    getSearchLocation,
  }: ConnectionConfigurations) =>
  async (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ): Promise<
    | {
        service: Service;
        configuration: EndevorConfiguration;
        searchLocation: SearchLocation;
      }
    | undefined
  > => {
    const connectionDetails = await getConnectionDetails(serviceId);
    if (!connectionDetails) {
      logger.error(
        `Unable to resolve connection details for ${serviceId.name}.`
      );
      return;
    }
    const configuration = await getEndevorConfiguration(
      serviceId,
      searchLocationId
    );
    if (!configuration) {
      logger.error(
        `Unable to resolve configuration for ${serviceId.name}/${searchLocationId.name}.`
      );
      return;
    }
    const credential = await getCredential(
      connectionDetails,
      configuration
    )(serviceId);
    if (!credential) {
      logger.error(`Unable to resolve credentials for ${serviceId.name}.`);
      return;
    }
    const searchLocation = await getSearchLocation(searchLocationId);
    if (!searchLocation) {
      logger.error(
        `Unable to resolve inventory location for ${searchLocationId.name}.`
      );
      return;
    }
    return {
      service: {
        location: connectionDetails.value.location,
        rejectUnauthorized: connectionDetails.value.rejectUnauthorized,
        credential: credential.value,
      },
      configuration,
      searchLocation,
    };
  };

type GroupedElementNodes = {
  [searchLocationId: string]: ReadonlyArray<ElementNode>;
};
export const groupBySearchLocationId = (
  elementNodes: ReadonlyArray<ElementNode>
): Readonly<GroupedElementNodes> => {
  return elementNodes.reduce((acc: GroupedElementNodes, currentNode) => {
    const serviceLocationId = toServiceLocationCompositeKey(
      currentNode.serviceId
    )(currentNode.searchLocationId);
    acc[serviceLocationId] = [...(acc[serviceLocationId] || []), currentNode];
    return acc;
  }, {});
};

export const showElementToEdit = async (
  fileUri: Uri
): Promise<void | Error> => {
  try {
    await showFileContent(fileUri);
  } catch (e) {
    return new Error(
      `Unable to open the file ${fileUri.fsPath} because of error ${e.message}`
    );
  }
};
