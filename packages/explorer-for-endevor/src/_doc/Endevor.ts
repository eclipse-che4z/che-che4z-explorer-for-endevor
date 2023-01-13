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

import { toEndevorStageNumber } from '@local/endevor/utils';
import { SubSystemMapPath } from '@local/endevor/_doc/Endevor';
import { isDefined } from '../utils';

// any subsystem in any system in the search environment & stage number
export type SubsystemMapPathId = string;
// code routes up the Endevor map
type Routes = ReadonlyArray<SubsystemMapPathId>;

export type EndevorMap = Readonly<{
  [endevorMapNode: SubsystemMapPathId]: Routes;
}>;

export const toSubsystemMapPathId = ({
  environment,
  stageNumber,
  system,
  subSystem,
}: SubSystemMapPath): SubsystemMapPathId => {
  return `${environment}/${stageNumber}/${system}/${subSystem}`;
};

export const fromSubsystemMapPathId = (
  subsystemMapPathId: SubsystemMapPathId
): SubSystemMapPath | undefined => {
  const [environment, stageNumber, system, subSystem] =
    subsystemMapPathId.split('/');
  if (!environment || !stageNumber || !system || !subSystem) {
    return;
  }
  const stageNumberValue = toEndevorStageNumber(stageNumber);
  if (!stageNumberValue) return;
  return {
    environment,
    system,
    subSystem,
    stageNumber: stageNumberValue,
  };
};

export const mapSubsystems = (
  endevorMap: EndevorMap
): ReadonlyArray<{
  system: string;
  subSystem: string;
}> => {
  return Object.keys(endevorMap)
    .map((subsystemMapPathId) => {
      return fromSubsystemMapPathId(subsystemMapPathId);
    })
    .filter(isDefined);
};
