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
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import {
  ElementMapPath,
  ElementSearchLocation,
  ServiceLocation,
} from '@local/endevor/_doc/Endevor';
import { isDefined } from '../utils';
import { toCompositeKey as toStorageCompositeKey } from './storage/utils';
import {
  CachedElement,
  ElementCcidsFilter,
  ElementFilter,
  ElementFilterType,
  ElementNamesFilter,
  ElementsUpTheMapFilter,
  EndevorId,
} from './_doc/v2/Store';

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
  if (credential) {
    switch (credential.type) {
      case CredentialType.BASE:
        user = credential.user;
        break;
    }
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

export const isElementsNameFilter = (
  filter: ElementFilter
): filter is ElementNamesFilter => {
  return filter.type === ElementFilterType.ELEMENT_NAMES_FILTER;
};

export const isElementsCcidFilter = (
  filter: ElementFilter
): filter is ElementCcidsFilter => {
  return filter.type === ElementFilterType.ELEMENT_CCIDS_FILTER;
};

export const isElementsUpTheMapFilter = (
  filter: ElementFilter
): filter is ElementsUpTheMapFilter => {
  return filter.type === ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER;
};

const prepareFilterPattern = (items: ReadonlyArray<string>): RegExp => {
  const validationPattern = items
    .map((item) =>
      item
        // make mainframers happy
        .replace(/%/g, '.')
        // replace * to proper regex symbol
        .replace(/\*/g, '.*')
        // escape the rest (probably) of regex reserved symbols
        .replace(/[+?^${}()[\]\\]/g, '\\$&')
    )
    .map((item) => ['^', item, '$'].join(''))
    .join('|');

  return new RegExp(validationPattern, 'i');
};

const filterElement =
  (filterType: ElementFilterType) =>
  (regExp: RegExp) =>
  (cachedElement: CachedElement) => {
    let match;
    switch (filterType) {
      case ElementFilterType.ELEMENT_NAMES_FILTER:
        match = regExp.exec(cachedElement.element.name);
        break;
      case ElementFilterType.ELEMENT_CCIDS_FILTER:
        match = regExp.exec(cachedElement.element.lastActionCcid);
        break;
      case ElementFilterType.ELEMENTS_UP_THE_MAP_FILTER:
        return;
      default:
        throw new UnreachableCaseError(filterType);
    }
    return match ? cachedElement : undefined;
  };

export const getAllFilteredElements =
  (cachedElements: ReadonlyArray<CachedElement>) =>
  (
    filter: ElementNamesFilter | ElementCcidsFilter
  ): ReadonlyArray<CachedElement> => {
    return cachedElements
      .map(filterElement(filter.type)(prepareFilterPattern(filter.value)))
      .filter(isDefined);
  };

export const getFirstFoundFilteredElement =
  (cachedElements: ReadonlyArray<CachedElement>) =>
  (
    filter: ElementNamesFilter | ElementCcidsFilter
  ): CachedElement | undefined => {
    return cachedElements.find(
      filterElement(filter.type)(prepareFilterPattern(filter.value))
    );
  };
