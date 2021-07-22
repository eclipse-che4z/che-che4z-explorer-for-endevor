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
import { discardEditedElementChanges } from '../commands/discardEditedElementChanges';
import { CommandId } from '../commands/id';
import * as assert from 'assert';
import {
  ChangeControlValue,
  Element,
  Service,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import {
  mockClosingActiveEditorWith,
  mockShowingFileContentWith as mockFocusingOnEditorWith,
  mockGettingActiveEditorWith,
  mockGettingAllOpenedEditorsWith,
} from '../_mocks/window';
import { mockDeletingFileWith } from '../_mocks/workspace';
import { toEditedElementUri } from '../uri/editedElementUri';
import * as sinon from 'sinon';
import { join } from 'path';

describe('discarding local changes in compared element', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.DISCARD_COMPARED_ELEMENT,
      discardEditedElementChanges
    );
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  it('should discard local changes and close edit & compare sessions', async () => {
    // arrange
    const localElementVersionFsPath = join(
      __dirname,
      'temp',
      'local',
      'element'
    );
    const service: Service = {
      location: {
        port: 1234,
        protocol: 'http',
        hostname: 'anything',
        basePath: 'anythingx2',
      },
      credential: {
        type: CredentialType.BASE,
        user: 'test',
        password: 'something',
      },
      rejectUnauthorized: false,
    };
    const element: Element = {
      instance: 'ANY',
      environment: 'ENV',
      system: 'SYS',
      subSystem: 'SUBSYS',
      stageNumber: '1',
      type: 'TYP',
      name: 'ELM',
    };
    const uploadChangeControlValue: ChangeControlValue = {
      ccid: 'some_ccid',
      comment: 'some_comment',
    };
    const remoteElementVersionFingerprint = 'element_fingerprint';
    const remoteElementVersionFsPath = join(
      __dirname,
      'temp',
      'remote',
      'element'
    );
    const editedElementFsPath = join(__dirname, 'temp', 'element');
    const comparedElementUri = toComparedElementUri(localElementVersionFsPath)({
      service,
      element,
      uploadChangeControlValue,
      fingerprint: remoteElementVersionFingerprint,
      remoteVersionTempFilePath: remoteElementVersionFsPath,
      initialElementTempFilePath: editedElementFsPath,
    });
    if (isError(comparedElementUri)) {
      const error = comparedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    const localElementVersionFileUri = vscode.Uri.file(
      localElementVersionFsPath
    );
    const remoteElementVersionFileUri = vscode.Uri.file(
      remoteElementVersionFsPath
    );
    const dirty = true;
    const successSaving = Promise.resolve(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const activeDiffEditor: vscode.TextEditor = ({
      document: {
        uri: comparedElementUri,
        isDirty: dirty,
        save: () => successSaving,
      },
    } as unknown) as vscode.TextEditor;
    const getActiveDiffEditorStub = mockGettingActiveEditorWith(
      activeDiffEditor
    );
    const localElementVersionFingerprint = 'something';
    const editedElementUri = toEditedElementUri(editedElementFsPath)({
      element,
      service,
      fingerprint: localElementVersionFingerprint,
      searchLocation: {
        instance: 'ANY',
      },
    });
    if (isError(editedElementUri)) {
      const error = editedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
    const nonDirty = false;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const editedElementEditor: vscode.TextEditor = ({
      document: {
        isDirty: nonDirty,
        uri: editedElementUri,
      },
    } as unknown) as vscode.TextEditor;
    mockGettingAllOpenedEditorsWith([editedElementEditor]);
    const successResult = Promise.resolve();
    const focusOnEditedElementEditorStub = mockFocusingOnEditorWith(
      editedElementUri
    )(successResult);
    const closeActiveEditorsStub = mockClosingActiveEditorWith(successResult);
    const deleteTempFilesStub = mockDeletingFileWith([
      [editedElementUri, successResult],
      [localElementVersionFileUri, successResult],
      [remoteElementVersionFileUri, successResult],
    ]);
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.DISCARD_COMPARED_ELEMENT,
        comparedElementUri
      );
    } catch (e) {
      assert.fail(
        `Test failed because of uncatched error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(
      getActiveDiffEditorStub.called,
      `Fetching active diff editor was not called`
    );
    // TODO: check saving of dirty changes in active diff editor

    assert.ok(
      focusOnEditedElementEditorStub.called,
      `Edited element editor was not made active`
    );
    const actualEditedElementUri = focusOnEditedElementEditorStub.args[0]?.[0];
    assert.strictEqual(
      actualEditedElementUri?.fsPath,
      editedElementFsPath,
      `Edited element editor was not made active because of diff in expected ${editedElementFsPath} and actual ${actualEditedElementUri?.fsPath}`
    );
    assert.ok(
      closeActiveEditorsStub.calledTwice,
      `Diff and/or edited element editor were not closed, stub was called ${closeActiveEditorsStub.callCount} times`
    );

    assert.ok(
      deleteTempFilesStub.calledThrice,
      `Delete temp files was not performed for all required items, it was called ${
        deleteTempFilesStub.callCount
      } times with args: ${JSON.stringify(deleteTempFilesStub.args)}`
    );
    const [
      actualEditedElementDeleteCall,
      remoteElementVersionDeleteCall,
      localElementVersionDeleteCall,
    ] = deleteTempFilesStub.args;
    const actualEditedFileUri = actualEditedElementDeleteCall?.[0];
    assert.strictEqual(
      actualEditedFileUri?.fsPath,
      editedElementFsPath,
      `Delete temp file was not called with expected ${editedElementFsPath}, it was called with ${actualEditedFileUri?.fsPath}`
    );
    const actualRemoteVersionElementFileUri =
      remoteElementVersionDeleteCall?.[0];
    assert.strictEqual(
      actualRemoteVersionElementFileUri?.fsPath,
      remoteElementVersionFsPath,
      `Delete temp file was not called with expected ${remoteElementVersionFsPath}, it was called with ${actualRemoteVersionElementFileUri?.fsPath}`
    );
    const actualLocalVersionElementFileUri = localElementVersionDeleteCall?.[0];
    assert.strictEqual(
      actualLocalVersionElementFileUri?.fsPath,
      localElementVersionFsPath,
      `Delete temp file was not called with expected ${localElementVersionFsPath}, it was called with ${actualLocalVersionElementFileUri?.fsPath}`
    );
  });
});
