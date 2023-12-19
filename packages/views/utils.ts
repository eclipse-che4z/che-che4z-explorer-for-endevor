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

import { CURRENT_CHANGE_LEVEL } from './constants';
import { ElementHistoryData } from './tree/_doc/ChangesTree';

export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};

export const formatWithNewLines = (lines: ReadonlyArray<string>): string =>
  ['', ...lines].join('\n');

export const getPreviousVersionLevel = (
  historyData: ElementHistoryData | undefined,
  currentVvll: string
): string | undefined => {
  if (!historyData?.changeLevels?.length) {
    return;
  }
  const currentChangeNodeIndex =
    currentVvll === CURRENT_CHANGE_LEVEL
      ? historyData.changeLevels.length - 1
      : historyData.changeLevels?.findIndex(
          (changeNode) => changeNode.vvll === currentVvll
        ) ?? -1;
  return historyData.changeLevels && currentChangeNodeIndex > 0
    ? historyData.changeLevels[currentChangeNodeIndex - 1]?.vvll
    : undefined;
};
