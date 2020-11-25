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

import { assert } from 'chai';
import * as vscode from 'vscode';
import { Commands } from '../../../../commands/Common';
import { EndevorEntity } from '../../../../model/EndevorEntity';
import { EndevorQualifier } from '../../../../model/IEndevorQualifier';
import { Repository } from '../../../../model/Repository';
import { EndevorElementNode } from '../../../../ui/tree/EndevorNodes';
// Explicitly show NodeJS how to find VSCode (required for Jest)
process.vscode = vscode;

describe('Endevor element nodes use cases', () => {
  // input stubs
  const endevorEntity: EndevorEntity = {
    getName(): string | undefined {
      return 'some_value';
    },
    getDescription(): string {
      return 'some_value';
    },
    getRepository(): Repository {
      return new Repository(
        'testRepo',
        'https://example.com:1234',
        'testUser',
        'testPass',
        'testRepo',
        'testConnLabel'
      );
    },
  };
  const endevorQualifier: EndevorQualifier = {
    element: 'some_value',
    env: 'envTest',
    stage: '1',
    subsystem: 'sbsTest',
    system: 'sysTest',
    type: 'COBOL',
  };

  it('will be created with on-click browse command', () => {
    // given
    const elementNode = new EndevorElementNode(endevorEntity, endevorQualifier);
    // when
    const actualOnClickCommand = elementNode.command;
    // then
    assert.isDefined(actualOnClickCommand);
    assert.equal(actualOnClickCommand?.title, 'Browse element');
    assert.equal(actualOnClickCommand?.command, Commands.BrowseElement);
    assert.equal(actualOnClickCommand?.arguments?.pop(), elementNode);
  });
});
