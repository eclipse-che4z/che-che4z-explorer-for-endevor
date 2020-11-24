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
import { IEndevorQualifier } from '../interface/IEndevorQualifier';
import { Repository } from '../entities/Repository';
import { proxyBrowseElement } from '../service/EndevorCliProxy';
import { logger } from '../globals';
import { IEndevorController } from '../interface/dataProvider_controller';

export async function browseElement(
  arg: any,
  controllerInstance: IEndevorController
) {
  const repo: Repository = arg.getRepository();
  const elementName: string = arg.label;
  const eq: IEndevorQualifier = arg.getQualifier();
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Loading: ${elementName}...`,
    },
    async (progress) => {
      progress.report({ increment: 10 });
      try {
        const data = await proxyBrowseElement(repo, eq, controllerInstance);
        progress.report({ increment: 50 });
        const doc = await vscode.workspace.openTextDocument({
          content: data,
        });
        progress.report({ increment: 100 });
        return vscode.window.showTextDocument(doc, { preview: false });
      } catch (error) {
        if (!error.cancelled) {
          logger.error(error.error);
        }
      }
    }
  );
}
