/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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

import * as vscode from 'vscode';
import { IEndevorEntity, IRepository } from './entities';

export interface IEndevorNode extends vscode.TreeItem {
  contextValue: string;
  hasChildren: () => boolean;
  getChildren: () => IEndevorNode[];
  setChildren: (value: IEndevorNode[]) => void;
  getNeedReload: () => boolean;
  setNeedReload: (value: boolean) => void;
  updateNeedReload: (parNeedReload: boolean) => void;
  getEntity: () => IEndevorEntity | undefined;
  setEntity(value: IEndevorEntity);
  getRepository: () => IRepository | undefined;
  updateInfo: () => void;
}
