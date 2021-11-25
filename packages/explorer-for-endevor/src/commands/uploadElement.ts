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
import {
  deleteFile,
  getFileContent,
  saveFileIntoWorkspaceFolder,
} from '@local/vscode-wrapper/workspace';
import { Uri } from 'vscode';
import {
  askForChangeControlValue,
  dialogCancelled as changeControlDialogCancelled,
} from '../dialogs/change-control/endevorChangeControlDialogs';
import {
  askForUploadLocation,
  dialogCancelled as uploadLocationDialogCancelled,
} from '../dialogs/locations/endevorUploadLocationDialogs';
import {
  overrideSignOutElement,
  signOutElement,
  updateElement,
} from '../endevor';
import { logger } from '../globals';
import { isError } from '../utils';
import { ANY_VALUE } from '@local/endevor/const';
import {
  closeActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromEditedElementUri } from '../uri/editedElementUri';
import {
  ActionChangeControlValue,
  ChangeControlValue,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { TextDecoder } from 'util';
import { ENCODING } from '../constants';
import {
  askToOverrideSignOutForElements,
  askToSignOutElements,
} from '../dialogs/change-control/signOutDialogs';
import { turnOnAutomaticSignOut } from '../settings/settings';
import * as path from 'path';
import { Action, Actions } from '../_doc/Actions';
import { ElementLocationName, EndevorServiceName } from '../_doc/settings';

export const uploadElementCommand = async (
  dispatch: (action: Action) => Promise<void>,
  elementUri: Uri
): Promise<void> => {
  const editSessionParams = fromEditedElementUri(elementUri);
  if (isError(editSessionParams)) {
    const error = editSessionParams;
    logger.error(
      `Element cannot be uploaded to Endevor.`,
      `Element cannot be uploaded to Endevor. Parsing the element's URI failed with error: ${error.message}`
    );
    return;
  }
  logger.trace(
    `Upload element command was called for: ${stringifyWithHiddenCredential({
      query: JSON.parse(elementUri.query),
      path: elementUri.fsPath,
    })}`
  );
  const {
    element,
    searchLocation,
    service,
    fingerprint,
    searchLocationName,
    serviceName,
  } = editSessionParams;
  const uploadValues = await askForUploadValues(searchLocation, element);
  if (isError(uploadValues)) {
    const error = uploadValues;
    logger.error(error.message);
    return;
  }
  const [uploadLocation, uploadChangeControlValue] = uploadValues;
  const uploadResult = await uploadElement(dispatch)(
    service,
    searchLocation,
    serviceName,
    searchLocationName
  )({
    ...uploadLocation,
    extension: element.extension,
  })(uploadChangeControlValue)(elementUri.fsPath, fingerprint);
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Element cannot be uploaded to Endevor.`,
      `Element cannot be uploaded to Endevor because of ${error.message}.`
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
  await closeEditSession(elementUri);
  logger.info('Update successful!');
};

const askForUploadValues = async (
  searchLocation: ElementSearchLocation,
  element: Element
): Promise<Error | [ElementMapPath, ActionChangeControlValue]> => {
  const uploadType =
    searchLocation.type && searchLocation.type !== ANY_VALUE
      ? searchLocation.type
      : element.type;
  const uploadLocation = await askForUploadLocation({
    environment: searchLocation.environment,
    stageNumber: searchLocation.stageNumber,
    system: searchLocation.system,
    subsystem: searchLocation.subsystem,
    type: uploadType,
    element: element.name,
    instance: element.instance,
  });
  if (uploadLocationDialogCancelled(uploadLocation)) {
    return new Error(
      `Upload location must be specified to upload element ${element.name}.`
    );
  }
  const uploadChangeControlValue = await askForChangeControlValue({
    ccid: searchLocation.ccid,
    comment: searchLocation.comment,
  });
  if (changeControlDialogCancelled(uploadChangeControlValue)) {
    return new Error(
      `CCID and Comment must be specified to upload element ${uploadLocation.name}.`
    );
  }
  return [uploadLocation, uploadChangeControlValue];
};

const uploadElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    service: Service,
    searchLocation: ElementSearchLocation,
    serviceName: EndevorServiceName,
    searchLocationName: ElementLocationName
  ) =>
  (element: Element) =>
  (uploadChangeControlValue: ChangeControlValue) =>
  async (
    elementFilePath: string,
    fingerprint: string
  ): Promise<void | Error> => {
    const content = await readEditedElementContent(elementFilePath);
    if (isError(content)) {
      const error = content;
      logger.error(error.message);
      return;
    }
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
      const signoutResult = await complexSignoutElement(dispatch)(
        service,
        searchLocation,
        serviceName,
        searchLocationName
      )(element)(uploadChangeControlValue);
      if (isError(signoutResult)) {
        const error = signoutResult;
        return error;
      }
      return uploadElement(dispatch)(
        service,
        searchLocation,
        serviceName,
        searchLocationName
      )(element)(uploadChangeControlValue)(elementFilePath, fingerprint);
    }
    if (isFingerprintMismatchError(uploadResult)) {
      const savedLocalElementVersionUri = await saveLocalElementVersion(
        elementFilePath
      )(element)(content);
      if (isError(savedLocalElementVersionUri)) {
        const error = savedLocalElementVersionUri;
        logger.trace(error.message);
        return new Error(
          `Unable to save a local version of the element ${element.name} to compare elements.`
        );
      }
      const showCompareDialogResult = await compareElementWithRemoteVersion(
        service,
        searchLocation
      )(uploadChangeControlValue)(
        element,
        elementFilePath,
        serviceName,
        searchLocationName
      )(savedLocalElementVersionUri.fsPath);
      if (isError(showCompareDialogResult)) {
        const error = showCompareDialogResult;
        return error;
      }
      return new Error(
        `There is a conflict with the remote copy of element ${element.name}. Please resolve it before uploading again.`
      );
    }
    return uploadResult;
  };

const readEditedElementContent = async (
  elementTempFilePath: string
): Promise<string | Error> => {
  try {
    return new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(elementTempFilePath))
    );
  } catch (error) {
    logger.trace(`Element content cannot be read because of ${error.message}`);
    return new Error(`Element content cannot be read`);
  }
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

const saveLocalElementVersion =
  (elementFilePath: string) =>
  (element: Element) =>
  async (content: string): Promise<Uri | Error> => {
    const tempEditFolder = path.dirname(elementFilePath);
    if (!tempEditFolder) {
      return new Error(
        'Unable to get a valid edit folder name to compare elements.'
      );
    }

    const tempEditFolderUri = Uri.file(tempEditFolder);
    return saveFileIntoWorkspaceFolder(tempEditFolderUri)(
      {
        fileName: `${element.name}-local-version`,
        fileExtension: element.extension,
      },
      content
    );
  };

const closeEditSession = async (editedFileUri: Uri) => {
  await closeActiveTextEditor();
  try {
    await deleteFile(editedFileUri);
  } catch (e) {
    logger.trace(
      `Edited file: ${editedFileUri.fsPath} was not deleted because of: ${e}.`
    );
  }
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
