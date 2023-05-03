/*
 * © 2023 Broadcom Inc and/or its subsidiaries; All rights reserved
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
} from '@local/vscode-wrapper/window';
import { deleteFile } from '@local/vscode-wrapper/workspace';
import { logger, reporter } from '../../globals';
import { fromComparedElementUri } from '../../uri/comparedElementUri';
import { isError } from '../../utils';
import { TelemetryEvents } from '../../_doc/Telemetry';

export const discardEditedElementChanges = async (incomingUri?: Uri) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALLED,
  });
  let comparedElementUri: Uri;
  // theia workaround because of unmerged https://github.com/eclipse-theia/theia/pull/9492
  if (!incomingUri) {
    const activeDiffEditor = getActiveTextEditor();
    if (!activeDiffEditor) {
      logger.error(
        `Unable to discard the element changes because the active diff editor was closed.`
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
      `Unable to discard the element changes.`,
      `Unable to discard the element changes because the element's URI parsing finished with error ${error.message}.`
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
  const { remoteVersionTempFilePath } = comparedUriParams;
  await safeDeleteTempFile(remoteVersionTempFilePath);
  const localVersionTempFilePath = comparedElementUri.fsPath;
  await safeDeleteTempFile(localVersionTempFilePath);
};

const editorContainsUnsavedChanges = (editor: TextEditor) => {
  return editor.document.isDirty;
};

const saveEditor = async (editor: TextEditor) => {
  await editor.document.save();
};

const safeDeleteTempFile = async (tempFilePath: string) => {
  try {
    return deleteFile(Uri.file(tempFilePath));
  } catch (error) {
    logger.error(
      `Unable to remove the temporary file ${tempFilePath}.`,
      `Unable to remove the temporary file ${tempFilePath} because of error ${error.message}.`
    );
  }
};
