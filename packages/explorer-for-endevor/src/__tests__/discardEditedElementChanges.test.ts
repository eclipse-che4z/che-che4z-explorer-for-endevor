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

import * as vscode from 'vscode';
import { discardEditedElementChanges } from '../commands/discardEditedElementChanges';
import { CommandId } from '../commands/id';
import * as assert from 'assert';
import {
  ChangeControlValue,
  Element,
  Service,
  ElementSearchLocation,
  ServiceApiVersion,
} from '@local/endevor/_doc/Endevor';
import { CredentialType } from '@local/endevor/_doc/Credential';
import { toComparedElementUri } from '../uri/comparedElementUri';
import { isError } from '../utils';
import {
  mockClosingActiveEditorWith,
  mockGettingActiveEditorWith,
} from '../_mocks/window';
import { mockDeletingFileWith } from '../_mocks/workspace';
import * as sinon from 'sinon';
import { join } from 'path';
import { Source } from '../store/storage/_doc/Storage';

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
    const localElementVersionFileUri = vscode.Uri.file(
      localElementVersionFsPath
    );
    const serviceName = 'serviceName';
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
      apiVersion: ServiceApiVersion.V2,
    };
    const element: Element = {
      configuration: 'ANY',
      environment: 'ENV',
      system: 'SYS',
      subSystem: 'SUBSYS',
      stageNumber: '1',
      type: 'TYP',
      name: 'ELM',
      extension: 'ext',
    };
    const uploadChangeControlValue: ChangeControlValue = {
      ccid: 'some_ccid',
      comment: 'some_comment',
    };
    const remoteElementVersionFsPath = join(
      __dirname,
      'temp',
      'remote',
      'element'
    );
    const remoteElementVersionFileUri = vscode.Uri.file(
      remoteElementVersionFsPath
    );
    const remoteElementVersionFingerprint = 'element_fingerprint';
    const searchLocationName = 'searchLocationName';
    const searchLocation: ElementSearchLocation = {
      configuration: 'ANY-CONFIG',
    };
    const comparedElementUri = toComparedElementUri(localElementVersionFsPath)({
      element,
      endevorConnectionDetails: service,
      fingerprint: remoteElementVersionFingerprint,
      uploadChangeControlValue,
      uploadTargetLocation: element,
      remoteVersionTempFilePath: remoteElementVersionFsPath,
      initialSearchContext: {
        serviceId: {
          name: serviceName,
          source: Source.INTERNAL,
        },
        searchLocationId: {
          name: searchLocationName,
          source: Source.INTERNAL,
        },
        overallSearchLocation: searchLocation,
        initialSearchLocation: element,
      },
    });
    if (isError(comparedElementUri)) {
      const error = comparedElementUri;
      assert.fail(
        `Uri was not built correctly for tests because of: ${error.message}`
      );
    }
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
    const successResult = Promise.resolve();
    const closeActiveEditorsStub = mockClosingActiveEditorWith(successResult);
    const deleteTempFilesStub = mockDeletingFileWith([
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
        `Test failed because of uncaught error inside command: ${e.message}`
      );
    }
    // assert
    assert.ok(
      getActiveDiffEditorStub.called,
      `Fetching active diff editor was not called`
    );
    // TODO: check saving of dirty changes in active diff editor
    assert.ok(
      closeActiveEditorsStub.calledOnce,
      `Diff and/or edited element editor were not closed, stub was called ${closeActiveEditorsStub.callCount} times`
    );

    assert.ok(
      deleteTempFilesStub.calledTwice,
      `Delete temp files was not performed for all required items, it was called ${
        deleteTempFilesStub.callCount
      } times with args: ${JSON.stringify(deleteTempFilesStub.args)}`
    );
    const [remoteElementVersionDeleteCall, localElementVersionDeleteCall] =
      deleteTempFilesStub.args;
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
