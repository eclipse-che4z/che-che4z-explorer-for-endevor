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

import { TextEditor, Uri } from 'vscode';
import {
  closeActiveTextEditor,
  getActiveTextEditor,
  getAllOpenedTextEditors,
  showFileContent,
} from '@local/vscode-wrapper/window';
import { deleteFile } from '@local/vscode-wrapper/workspace';
import { logger } from '../globals';
import { fromComparedElementUri } from '../uri/comparedElementUri';
import { isEditedElementUri } from '../uri/editedElementUri';
import { isError } from '../utils';

export const discardEditedElementChanges = async (incomingUri?: Uri) => {
  let comparedElementUri: Uri;
  // theia workaround because of unmerged https://github.com/eclipse-theia/theia/pull/9492
  if (!incomingUri) {
    const activeDiffEditor = getActiveTextEditor();
    if (!activeDiffEditor) {
      logger.error(
        `Element cannot be uploaded to Endevor because the active diff editor was closed.`
      );
      return;
    }
    comparedElementUri = activeDiffEditor.document.uri;
  } else {
    comparedElementUri = incomingUri;
  }
  const comparedUriParams = fromComparedElementUri(comparedElementUri);
  if (isError(comparedUriParams)) {
    const error = comparedUriParams;
    logger.error(
      `Element session cannot be discarded.`,
      `Element session cannot be discarded. Parsing the element's URI failed with error: ${error.message}`
    );
    return;
  }
  const activeDiffEditor = getActiveTextEditor();
  if (activeDiffEditor) {
    if (editorContainsUnsavedChanges(activeDiffEditor)) {
      await saveEditor(activeDiffEditor);
    }
    await closeActiveTextEditor();
  }
  const { initialElementTempFilePath } = comparedUriParams;
  const editedElementEditor = findEditorWithOpenedEditedFile(
    getAllOpenedTextEditors()
  )(initialElementTempFilePath);
  if (editedElementEditor) {
    if (!editorContainsUnsavedChanges(editedElementEditor)) {
      await focusOnEditor(editedElementEditor);
      await closeActiveTextEditor();
    }
  }
  await safeDeleteTempFile(initialElementTempFilePath);
  const { remoteVersionTempFilePath } = comparedUriParams;
  await safeDeleteTempFile(remoteVersionTempFilePath);
  const localVersionTempFilePath = comparedElementUri.fsPath;
  await safeDeleteTempFile(localVersionTempFilePath);
};

const editorContainsUnsavedChanges = (editor: TextEditor) => {
  return editor.document.isDirty;
};

const findEditorWithOpenedEditedFile = (editors: ReadonlyArray<TextEditor>) => (
  initialElementTempFilePath: string
) => {
  return editors
    .filter((editor) => isEditedElementUri(editor.document.uri))
    .find(
      (editor) => editor.document.uri.fsPath === initialElementTempFilePath
    );
};

const focusOnEditor = async (editor: TextEditor) => {
  await showFileContent(editor.document.uri);
};

const saveEditor = async (editor: TextEditor) => {
  await editor.document.save();
};

const safeDeleteTempFile = async (tempFilePath: string) => {
  try {
    return deleteFile(Uri.file(tempFilePath));
  } catch (error) {
    logger.trace(
      `Temp file: ${tempFilePath} was not deleted because of: ${error.message}.`
    );
  }
};
