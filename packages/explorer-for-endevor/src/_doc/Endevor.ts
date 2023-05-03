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

import {
  ChangeControlValue,
  StageNumber,
  Value,
} from '@local/endevor/_doc/Endevor';

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
  Partial<EnvironmentStageSearchLocation> &
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

// any subsystem in any system in the search environment & stage number
export type SubsystemMapPathId = string;
// code routes up the Endevor map
type Routes = ReadonlyArray<SubsystemMapPathId>;

export type EndevorMap = Readonly<{
  [endevorMapNode: SubsystemMapPathId]: Routes;
}>;
