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

import * as path from 'path';
import * as fs from 'fs/promises';
import { initWorkspace, isWorkspace } from '../workspace';
import { isError } from '@local/endevor/utils';
import { WorkspaceResponseStatus } from '../_doc/Error';

jest.mock('vscode', () => ({}), { virtual: true });
jest.mock(
  '../../../globals',
  () => ({
    logger: {
      trace: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

const fixtureDirName = '__fixture__';
const toFixturePath = (relativePath?: string): string =>
  path.join(__dirname, fixtureDirName, relativePath ? relativePath : '');
const fixtureDir = toFixturePath();

describe('synchronized workspace check', () => {
  it('should detect the folder as synchronized workspace', () => {
    // arrange
    const metadataTemplateDirName = 'metadata-template';
    const metadataTemplateDir = toFixturePath(metadataTemplateDirName);
    const synchedWorkspaceDir = metadataTemplateDir;
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const isSyncedWorkspace = isWorkspace({
      fsPath: synchedWorkspaceDir,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isSyncedWorkspace).toBeTruthy();
  });
  it('should not detect regular VSCode folder', () => {
    // arrange
    const unsyncedWorkspaceDir = fixtureDir;
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const isSyncedWorkspace = isWorkspace({
      fsPath: unsyncedWorkspaceDir,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isSyncedWorkspace).toBeFalsy();
  });
  it('should not detect non existing folder', () => {
    // arrange
    const nonExistentWorkspaceDir = toFixturePath('non/existent/path');
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const isSyncedWorkspace = isWorkspace({
      fsPath: nonExistentWorkspaceDir,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isSyncedWorkspace).toBeFalsy();
  });
});

// eslint-disable-next-line jest/no-disabled-tests
describe('endevor workspace initialization', () => {
  const containsEndevorFolder = async (
    folderPath: string
  ): Promise<boolean> => {
    try {
      await fs.access(path.join(folderPath, '.endevor'));
      return true;
    } catch (e) {
      return false;
    }
  };
  const removeEndevorFolder = async (folderPath: string) => {
    try {
      await fs.rmdir(path.join(folderPath, '.endevor'));
    } catch (e) {
      // do nothing
    }
  };

  it('should initialize an open folder as endevor workspace', async () => {
    // arrange
    const metadataTemplateDirName = 'empty-folder';
    const metadataTemplateDir = toFixturePath(metadataTemplateDirName);
    const emptyFolder = metadataTemplateDir;
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = await initWorkspace({
      fsPath: emptyFolder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isError(result)).toBeFalsy();
    expect(
      !isError(result) && result.status === WorkspaceResponseStatus.SUCCESS
    ).toBeTruthy();
    expect(await containsEndevorFolder(emptyFolder)).toBeTruthy();

    await removeEndevorFolder(emptyFolder);
  });
  it('should skip the initialization of the endevor workspace', async () => {
    // arrange
    const metadataTemplateDirName = 'metadata-template';
    const metadataTemplateDir = toFixturePath(metadataTemplateDirName);
    const initializedFolder = metadataTemplateDir;
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = await initWorkspace({
      fsPath: initializedFolder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isError(result)).toBeFalsy();
    expect(
      !isError(result) && result.status === WorkspaceResponseStatus.SUCCESS
    ).toBeTruthy();
    expect(await containsEndevorFolder(initializedFolder)).toBeTruthy();
  });
  it('should return an error in case of initializing a non existing folder', async () => {
    // arrange
    const nonExistentFolder = toFixturePath('non/existent/path');
    // act
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = await initWorkspace({
      fsPath: nonExistentFolder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // assert
    expect(isError(result)).toBeTruthy();
  });
});
