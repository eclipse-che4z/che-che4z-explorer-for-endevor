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

import { Uri } from 'vscode';

export type ChangeLevels = Array<ChangeLevelNode>;
export type HistoryLines = Array<HistoryLine>;

export type HistoryLine = Readonly<{
  addedVersion: string;
  line: number;
  removedVersion: string;
}> &
  Partial<
    Readonly<{
      changed: boolean;
      lineLength: number;
    }>
  >;

export type ChangeLevelNode = Readonly<{
  uri: Uri;
  vvll: string;
  user: string | undefined;
  date: string | undefined;
  time: string | undefined;
  ccid: string | undefined;
  comment: string | undefined;
}> & { lineNums?: HistoryLine[] };

export const enum HistoryViewModes {
  SHOW_IN_EDITOR = 'SHOW_IN_EDITOR',
  ONLY_SHOW_CHANGES = 'ONLY_SHOW_CHANGES',
  CLEAR_AND_SHOW = 'CLEAR_NODES/SHOW_IN_EDITOR',
  DEFAULT = 'DEFAULT',
}

export type ElementHistoryData = Partial<{
  historyLines: HistoryLines;
  changeLevels: ChangeLevels;
  historyContent: string;
}>;
