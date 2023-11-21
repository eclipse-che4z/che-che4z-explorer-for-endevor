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

import { Credential } from '@local/endevor/_doc/Credential';
import {
  ChangeControlValue,
  ServiceLocation,
  StageNumber,
  Value,
} from '@local/endevor/_doc/Endevor';

// TODO move to the endevor package to be reused on the API level too
// TODO rejectUnauthorized may be put in dependency on the protocol which is used
export type EndevorUnauthorizedService = Readonly<{
  location: ServiceLocation;
  rejectUnauthorized: boolean;
}>;

// TODO move to the endevor package to be reused on the API level too
export type EndevorAuthorizedService = EndevorUnauthorizedService &
  Readonly<{
    configuration: string;
    credential: Credential;
  }>;

export type EnvironmentStageSearchLocation = Readonly<{
  environment: Value;
  stageNumber: StageNumber;
}>;

// we do not use wildcards as a values.
// every value is uppercased by default, except the configuration.
export type ElementSearchLocation = Partial<
  Readonly<{
    configuration: Value;
  }>
> &
  Readonly<EnvironmentStageSearchLocation> &
  Partial<
    Readonly<{
      system: Value;
      subsystem: Value;
      type: Value;
      element: Value;
    }>
  > &
  Partial<ChangeControlValue>;

export type SearchLocation = Omit<ElementSearchLocation, 'configuration'>;

// any environment & stage number
export type EnvironmentStageMapPathId = string;
// any system in the search environment & stage number
export type SystemMapPathId = string;
// any subsystem in any system in the search environment & stage number
export type SubsystemMapPathId = string;
// any type in any system in the search environment & stage number
export type TypeMapPathId = string;

// code routes up the Endevor map
type Routes = ReadonlyArray<SubsystemMapPathId>;

export type EndevorMap = Readonly<{
  [endevorMapNode: SubsystemMapPathId]: Routes;
}>;
