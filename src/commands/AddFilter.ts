/* eslint-disable @typescript-eslint/consistent-type-assertions */
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

import { filterStringValidator } from '../FilterUtils';
import { Repository } from '../model/Repository';
import { EndevorFilter } from '../model/EndevorFilter';
import { EndevorController } from '../EndevorController';
import * as vscode from 'vscode';

export function addFilter(arg: any) {
  //If it came from a type node prefil it.
  let filterString = '';
  if (arg.contextValue === 'type') {
    filterString =
      arg.qualifier.env +
      '/' +
      arg.qualifier.stage +
      '/' +
      arg.qualifier.system +
      '/' +
      arg.qualifier.subsystem +
      '/' +
      arg.qualifier.type +
      '/*';
  }
  const inputBoxOptions: vscode.InputBoxOptions = {
    value: filterString,
    prompt: 'Create a new Endevor filter.',
    placeHolder: 'env/stgnum/sys/subsys/type/element',
    ignoreFocusOut: true,
    validateInput(value: string) {
      return filterStringValidator(arg.getRepository(), value);
    },
  };
  vscode.window.showInputBox(inputBoxOptions).then((filterUri) => {
    if (filterUri) {
      const repo: Repository = <Repository>arg.getRepository();
      repo.filters.push(new EndevorFilter(repo, filterUri));
      EndevorController.instance.updateSettings();
    }
  });
}
