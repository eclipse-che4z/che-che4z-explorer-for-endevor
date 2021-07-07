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

import { stringifyWithHiddenCredential } from '@local/endevor/utils';
import { Uri } from 'vscode';
import { logger } from '../globals';
import { isError } from '../utils';
import {
  closeActiveTextEditor,
  getActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromComparedElementUri } from '../uri/comparedElementUri';
import { discardEditedElementChanges } from './discardEditedElementChanges';
import {
  FingerprintMismatchError,
  UpdateError,
} from '@local/endevor/_doc/Error';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { updateElement } from '../endevor';
import { getFileContent } from '../../../vscode-wrapper/workspace';
import { TextDecoder } from 'util';
import { ENCODING } from '../constants';

export const applyDiffEditorChanges = async (
  incomingUri?: Uri
): Promise<void> => {
  let elementUri: Uri;
  // theia workaround because of unmerged https://github.com/eclipse-theia/theia/pull/9492
  if (!incomingUri) {
    const activeDiffEditor = getActiveTextEditor();
    if (!activeDiffEditor) {
      logger.error(
        `Element cannot be uploaded to Endevor because the active diff editor was closed.`
      );
      return;
    }
    if (activeDiffEditor.document.isDirty) {
      await activeDiffEditor.document.save();
    }
    elementUri = activeDiffEditor.document.uri;
  } else {
    elementUri = incomingUri;
  }
  const uriParms = fromComparedElementUri(elementUri);
  if (isError(uriParms)) {
    const error = uriParms;
    logger.error(
      `Element cannot be uploaded to Endevor.`,
      `Element cannot be uploaded to Endevor. Parsing the element's URI failed with error: ${error.message}.`
    );
    return;
  }
  logger.trace(
    `Upload compared element command was called for: ${stringifyWithHiddenCredential(
      {
        query: JSON.parse(elementUri.query),
        path: elementUri.fsPath,
      }
    )}`
  );
  const activeDiffEditor = getActiveTextEditor();
  if (!activeDiffEditor) {
    logger.error(
      `Element cannot be uploaded to Endevor because the active diff editor was closed.`
    );
    return;
  }
  const comparedElementPath = activeDiffEditor.document.uri.fsPath;
  if (activeDiffEditor.document.isDirty) {
    await activeDiffEditor.document.save();
  }
  let content: string;
  try {
    content = new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(comparedElementPath))
    );
  } catch (error) {
    logger.error(
      `Updated element content cannot be read.`,
      `Updated element ${comparedElementPath} content cannot be read because of ${error.message}.`
    );
    return;
  }
  const {
    service,
    element,
    uploadChangeControlValue,
    fingerprint,
    initialElementTempFilePath,
  } = uriParms;
  const uploadResult = await withNotificationProgress(
    `Uploading element: ${element.name}`
  )((progressReporter) => {
    return updateElement(progressReporter)(service)(element)(
      uploadChangeControlValue
    )({
      fingerprint,
      content,
    });
  });
  if (
    uploadResult instanceof UpdateError &&
    uploadResult.causeError instanceof FingerprintMismatchError
  ) {
    const fingerprintError = uploadResult;
    logger.error(
      `There is a conflict with the remote copy of element ${element.name}. Please resolve it before uploading again.`,
      `Element ${element.name} cannot be uploaded to Endevor because of ${fingerprintError.message}`
    );
    await closeActiveTextEditor();
    const showCompareDialogResult = await compareElementWithRemoteVersion(
      service
    )(uploadChangeControlValue)(
      element,
      initialElementTempFilePath
    )(elementUri.fsPath);
    if (isError(showCompareDialogResult)) {
      const error = showCompareDialogResult;
      logger.error(
        `Element ${element.name} cannot be uploaded to Endevor.`,
        `Element ${element.name} cannot be uploaded because of version conflicts and diff dialog cannot be opened because of ${error.message}.`
      );
      return;
    }
    return;
  }
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Element ${element.name} cannot be uploaded to Endevor.`,
      `Element ${element.name} cannot be uploaded to Endevor because of ${error.message}.`
    );
    return;
  }
  await discardEditedElementChanges(elementUri);
  logger.info('Update successful!');
  return;
};
