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
import * as assert from 'assert';
import { CommandId } from '../commands/id';
import { applyDiffEditorChanges } from '../commands/applyDiffEditorChanges';
import {
  ChangeControlValue,
  Service,
  Element,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import { mockGettingActiveEditorWith } from '../_mocks/window';
import * as sinon from 'sinon';
import * as discardCommand from '../commands/discardEditedElementChanges';
import { mockGettingFileContentWith } from '../_mocks/workspace';
import { mockUploadingElementWith } from '../_mocks/endevor';
import { TextEncoder } from 'util';
import { join } from 'path';

describe('accepting local changes in compared element', () => {
  before(() => {
    vscode.commands.registerCommand(
      CommandId.UPLOAD_COMPARED_ELEMENT,
      applyDiffEditorChanges
    );
  });

  afterEach(() => {
    // Sinon has some issues with cleaning up the environment after itself, so we have to do it
    // TODO: take a look into Fake API instead of Stub
    sinon.restore();
  });

  const mockDiscardCommandWith =
    (comparedUriArg: vscode.Uri) => (mockResult: Promise<void>) => {
      return sinon
        .stub(discardCommand, 'discardEditedElementChanges')
        .withArgs(comparedUriArg)
        .returns(mockResult);
    };

  it('should upload local changes and close edit & compare sessions', async () => {
    // arrange
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
    const localElementVersionFsPath = join(
      __dirname,
      'temp',
      'local',
      'element'
    );
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
    const comparedElementContent = 'something';
    const dirty = true;
    const successSaving = Promise.resolve(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const activeDiffEditor: vscode.TextEditor = {
      document: {
        uri: comparedElementUri,
        isDirty: dirty,
        save: () => successSaving,
      },
    } as unknown as vscode.TextEditor;
    const getActiveDiffEditorStub =
      mockGettingActiveEditorWith(activeDiffEditor);
    const localElementVersionFileUri = vscode.Uri.file(
      localElementVersionFsPath
    );
    const getElementContentFromFileStub = mockGettingFileContentWith(
      localElementVersionFileUri
    )(Promise.resolve(new TextEncoder().encode(comparedElementContent)));

    const uploadElementContentStub = mockUploadingElementWith(
      service,
      element,
      uploadChangeControlValue,
      {
        content: comparedElementContent,
        fingerprint: remoteElementVersionFingerprint,
      }
    )();

    const successDiscarding = Promise.resolve();
    const callDiscardCommandStub =
      mockDiscardCommandWith(comparedElementUri)(successDiscarding);
    // act
    try {
      await vscode.commands.executeCommand(
        CommandId.UPLOAD_COMPARED_ELEMENT,
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
      `Fetch active diff editor was not called`
    );
    // TODO: check saving of dirty changes in active diff editor
    assert.ok(
      getElementContentFromFileStub.called,
      `Fetch local version content was not called`
    );
    const actualLocalElementVersionUri =
      getElementContentFromFileStub.args[0]?.[0];
    assert.strictEqual(
      actualLocalElementVersionUri?.fsPath,
      localElementVersionFsPath,
      `Get local version content was not called with expected ${localElementVersionFsPath}, it was called with ${actualLocalElementVersionUri?.fsPath}`
    );

    const [
      generalUploadFunctionStub,
      uploadWithServiceStub,
      uploadWithElementStub,
      uploadWithActionCcidStub,
      uploadWithElementContentStub,
    ] = uploadElementContentStub;
    assert.ok(
      generalUploadFunctionStub.called,
      `Upload element content was not called`
    );
    const actualService = uploadWithServiceStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualService,
      service,
      `Upload element content was not called with expected ${service}, it was called with ${actualService}`
    );
    const actualElement = uploadWithElementStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualElement,
      element,
      `Upload element content was not called with expected ${element}, it was called with ${actualElement}`
    );
    const actualChangeControlValue = uploadWithActionCcidStub.args[0]?.[0];
    assert.deepStrictEqual(
      actualChangeControlValue,
      uploadChangeControlValue,
      `Upload element content was not called with expected ${uploadChangeControlValue}, it was called with ${actualChangeControlValue}`
    );
    const actualContentValue = uploadWithElementContentStub.args[0]?.[0];
    const expectedContenValue = {
      content: comparedElementContent,
      fingerprint: remoteElementVersionFingerprint,
    };
    assert.deepStrictEqual(
      actualContentValue,
      expectedContenValue,
      `Upload element content was not called with expected ${expectedContenValue}, it was called with ${actualContentValue}`
    );

    assert.ok(callDiscardCommandStub.called, `Discard command was not called`);
    const actualComparedUri = callDiscardCommandStub.args[0]?.[0];
    assert.strictEqual(
      actualComparedUri,
      comparedElementUri,
      `Discard command was not called with expected ${comparedElementUri}, it was called with ${actualComparedUri}`
    );
  });
});
