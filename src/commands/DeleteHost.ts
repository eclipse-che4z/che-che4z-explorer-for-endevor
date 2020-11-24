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

import { Repository } from '../entities/Repository';
import { EndevorController } from '../EndevorController';
import * as vscode from 'vscode';
import { logger } from '../globals';

export function deleteHost(arg: any) {
  if (arg.contextValue === 'repository') {
    const repo: Repository | undefined = arg.getRepository();
    if (repo) {
      logger.trace(`Remove configuration ${repo.getName()}`);
      vscode.window
        .showWarningMessage(
          'Remove Configuration: ' + repo.getName() + '?',
          'OK'
        )
        .then((message) => {
          if (message === 'OK') {
            const profileLabel = repo.getProfileLabel()
              ? repo.getProfileLabel()
              : '';
            const repoName = repo.getName();
            if (repoName) {
              EndevorController.instance.removeRepository(
                repoName,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                profileLabel!
              );
            }
            EndevorController.instance.updateSettings();
            logger.trace('Configuration removed');
          } else {
            logger.trace('Operation cancelled.');
          }
        });
    }
  }
}
