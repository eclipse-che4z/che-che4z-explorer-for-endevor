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

import { ANY_VALUE } from '@local/endevor/const';
import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import {
  ElementMapPath,
  ElementSearchLocation,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { toCompositeKey as toStorageCompositeKey } from './storage/utils';
import { EndevorId } from './_doc/v2/Store';

export const toServiceLocationCompositeKey =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId): string => {
    return `${toStorageCompositeKey(serviceId)}/${toStorageCompositeKey(
      searchLocationId
    )}`;
  };

export const toElementCompositeKey =
  (serviceId: EndevorId) =>
  (searchLocationId: EndevorId) =>
  (element: ElementMapPath): string => {
    return `${toServiceLocationCompositeKey(serviceId)(searchLocationId)}/${
      element.configuration
    }/${element.environment}/${element.stageNumber}/${element.system}/${
      element.subSystem
    }/${element.type}/${element.name}`;
  };

export const toServiceUrl = (
  service: ServiceLocation,
  credential?: Credential
): string => {
  let basePath = service.basePath;
  if (basePath.startsWith('/')) basePath = basePath.slice(1);
  if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
  let user;
  switch (credential?.type) {
    case CredentialType.BASE:
      user = credential.user;
      break;
  }
  return `${service.protocol}://${user ? user + '@' : ''}${service.hostname}:${
    service.port
  }/${basePath}`;
};

export const toSearchPath = (
  elementSearchLocation: ElementSearchLocation
): string => {
  const configuration = elementSearchLocation.configuration;
  const env = elementSearchLocation.environment;
  const stage = elementSearchLocation.stageNumber;
  const sys = elementSearchLocation.system;
  const subsys = elementSearchLocation.subsystem;
  const type = elementSearchLocation.type;
  return [
    configuration,
    env ? env : ANY_VALUE,
    stage ?? ANY_VALUE,
    sys ? sys : ANY_VALUE,
    subsys ? subsys : ANY_VALUE,
    type ? type : ANY_VALUE,
  ].join('/');
};

export const normalizeSearchLocation = (
  searchLocation: ElementSearchLocation
): ElementSearchLocation => {
  return {
    configuration: searchLocation.configuration,
    environment: searchLocation.environment?.toUpperCase(),
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system
      ? searchLocation.system !== ANY_VALUE
        ? searchLocation.system.toUpperCase()
        : undefined
      : undefined,
    subsystem: searchLocation.subsystem
      ? searchLocation.subsystem !== ANY_VALUE
        ? searchLocation.subsystem.toUpperCase()
        : undefined
      : undefined,
    type: searchLocation.type
      ? searchLocation.type !== ANY_VALUE
        ? searchLocation.type.toUpperCase()
        : undefined
      : undefined,
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  };
};
