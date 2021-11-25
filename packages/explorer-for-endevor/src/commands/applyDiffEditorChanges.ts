/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import {
  isFingerprintMismatchError,
  isSignoutError,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
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
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import {
  overrideSignOutElement,
  signOutElement,
  updateElement,
} from '../endevor';
import { getFileContent } from '@local/vscode-wrapper/workspace';
import { TextDecoder } from 'util';
import { ENCODING } from '../constants';
import {
  askToOverrideSignOutForElements,
  askToSignOutElements,
} from '../dialogs/change-control/signOutDialogs';
import { turnOnAutomaticSignOut } from '../settings/settings';
import { ComparedElementUriQuery } from '../_doc/Uri';
import {
  ActionChangeControlValue,
  Element,
  Service,
  ElementSearchLocation,
} from '@local/endevor/_doc/Endevor';
import { Action, Actions } from '../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

export const applyDiffEditorChanges = async (
  dispatch: (action: Action) => Promise<void>,
  incomingUri?: Uri
): Promise<void> => {
  const comparedElementUri = await toElementUriEvenInTheia(incomingUri);
  if (isError(comparedElementUri)) {
    const error = comparedElementUri;
    logger.error(
      `Element cannot be uploaded to Endevor.`,
      `Element cannot be uploaded to Endevor because of ${error.message}`
    );
    return;
  }
  const uriParms = fromComparedElementUri(comparedElementUri);
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
        query: JSON.parse(comparedElementUri.query),
        path: comparedElementUri.fsPath,
      }
    )}`
  );
  const { serviceName, service, searchLocation, searchLocationName, element } =
    uriParms;
  const content = await readComparedElementContent();
  if (isError(content)) {
    const error = content;
    logger.error(
      `Element ${element.name} cannot be uploaded to Endevor.`,
      `Element ${element.name} cannot be uploaded to Endevor because of ${error.message}.`
    );
    return;
  }
  const uploadResult = await uploadElement(dispatch)(content)(
    comparedElementUri
  )(uriParms);
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Element ${element.name} cannot be uploaded to Endevor.`,
      `Element ${element.name} cannot be uploaded to Endevor because of ${error.message}.`
    );
    return;
  }
  await updateTreeAfterSuccessfulUpload(dispatch)(
    serviceName,
    service,
    searchLocationName,
    searchLocation,
    [element]
  );
  await discardEditedElementChanges(comparedElementUri);
  logger.info(`Update of ${element.name} successful!`);
  return;
};

const toElementUriEvenInTheia = async (
  incomingUri?: Uri
): Promise<Uri | Error> => {
  // theia workaround because of unmerged https://github.com/eclipse-theia/theia/pull/9492
  if (!incomingUri) {
    const activeDiffEditor = getActiveTextEditor();
    if (!activeDiffEditor) {
      return new Error(
        `Element cannot be uploaded to Endevor because the active diff editor was closed.`
      );
    }
    if (activeDiffEditor.document.isDirty) {
      await activeDiffEditor.document.save();
    }
    return activeDiffEditor.document.uri;
  } else {
    return incomingUri;
  }
};

const readComparedElementContent = async (): Promise<string | Error> => {
  const activeDiffEditor = getActiveTextEditor();
  if (!activeDiffEditor) {
    return new Error(
      `Element cannot be uploaded to Endevor because the active diff editor was closed.`
    );
  }
  const comparedElementPath = activeDiffEditor.document.uri.fsPath;
  if (activeDiffEditor.document.isDirty) {
    await activeDiffEditor.document.save();
  }
  if (isError(comparedElementPath)) {
    const error = comparedElementPath;
    return error;
  }
  try {
    return new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(comparedElementPath))
    );
  } catch (error) {
    logger.trace(`Element content cannot be read because of ${error.message}`);
    return new Error(`Element content cannot be read`);
  }
};

const uploadElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (content: string) =>
  (elementUri: Uri) =>
  async ({
    service,
    serviceName,
    element,
    uploadChangeControlValue,
    fingerprint,
    searchLocation,
    searchLocationName,
    initialElementTempFilePath,
    remoteVersionTempFilePath,
  }: ComparedElementUriQuery): Promise<void | Error> => {
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
    if (isSignoutError(uploadResult)) {
      logger.warn(
        `Endevor location requires the signout action to update/add elements.`
      );
      const signOutResult = await complexSignoutElement(dispatch)(
        service,
        searchLocation,
        serviceName,
        searchLocationName
      )(element)(uploadChangeControlValue);
      if (isError(signOutResult)) {
        logger.error(signOutResult.message);
        return signOutResult;
      }
      return uploadElement(dispatch)(content)(elementUri)({
        service,
        serviceName,
        element,
        uploadChangeControlValue,
        fingerprint,
        searchLocation,
        searchLocationName,
        initialElementTempFilePath,
        remoteVersionTempFilePath,
      });
    }
    if (isFingerprintMismatchError(uploadResult)) {
      const fingerprintError = uploadResult;
      logger.error(
        `There is a conflict with the remote copy of element ${element.name}. Please resolve it before uploading again.`,
        `Element ${element.name} cannot be uploaded to Endevor because of ${fingerprintError.message}`
      );
      await closeActiveTextEditor();
      const showCompareDialogResult = await compareElementWithRemoteVersion(
        service,
        searchLocation
      )(uploadChangeControlValue)(
        element,
        initialElementTempFilePath,
        serviceName,
        searchLocationName
      )(elementUri.fsPath);
      if (isError(showCompareDialogResult)) {
        const error = showCompareDialogResult;
        logger.error(
          `Element ${element.name} cannot be uploaded to Endevor.`,
          `Element ${element.name} cannot be uploaded because of version conflicts and diff dialog cannot be opened because of ${error.message}.`
        );
        return fingerprintError;
      }
      return;
    }
    return;
  };

const complexSignoutElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    service: Service,
    searchLocation: ElementSearchLocation,
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<void | Error> => {
    const signOut = await askToSignOutElements([element.name]);
    if (!signOut.signOutElements && !signOut.automaticSignOut) {
      return new Error(
        `${element.name} cannot be uploaded because it is signed out to somebody else.`
      );
    }
    if (signOut.automaticSignOut) {
      try {
        await turnOnAutomaticSignOut();
      } catch (e) {
        logger.warn(
          `Global signout setting cannot be updated`,
          `Global signout setting cannot be updated, because of ${e.message}`
        );
      }
    }
    const signOutResult = await withNotificationProgress(
      `Signing out element: ${element.name}`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(element)(
        signoutChangeControlValue
      )
    );
    if (isSignoutError(signOutResult)) {
      logger.warn(
        `Element ${element.name} cannot be signed out, because it signed out to somebody else.`
      );
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        return new Error(
          `${element.name} cannot be uploaded because it is signed out to somebody else.`
        );
      }
      const overrideSignoutResult = await withNotificationProgress(
        `Signing out element: ${element.name}`
      )((progressReporter) =>
        overrideSignOutElement(progressReporter)(service)(element)(
          signoutChangeControlValue
        )
      );
      if (isError(overrideSignoutResult)) {
        return new Error(
          `${element.name} cannot be uploaded because override signout action cannot be performed.`
        );
      }
      await updateTreeAfterSuccessfulSignout(dispatch)(
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        [element]
      );
      return overrideSignoutResult;
    }
    if (isError(signOutResult)) {
      return new Error(`${element.name} cannot be signed out.`);
    }
    await updateTreeAfterSuccessfulSignout(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
  };

const updateTreeAfterSuccessfulSignout =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    searchLocation: ElementSearchLocation,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNEDOUT,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };

const updateTreeAfterSuccessfulUpload =
  (dispatch: (action: Action) => Promise<void>) =>
  async (
    serviceName: EndevorServiceName,
    service: Service,
    searchLocationName: ElementLocationName,
    searchLocation: ElementSearchLocation,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_UPDATED,
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      elements,
    });
  };
