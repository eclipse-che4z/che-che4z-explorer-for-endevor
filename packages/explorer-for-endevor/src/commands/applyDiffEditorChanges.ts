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

import {
  isFingerprintMismatchError,
  isSignoutError,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
import { Uri } from 'vscode';
import { logger, reporter } from '../globals';
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
import {
  TelemetryEvents,
  ApplyDiffEditorChangesCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../_doc/Telemetry';

export const applyDiffEditorChanges = async (
  dispatch: (action: Action) => Promise<void>,
  incomingUri?: Uri
): Promise<void> => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
  });
  const comparedElementUri = await toElementUriEvenInTheia(incomingUri);
  if (isError(comparedElementUri)) {
    const error = comparedElementUri;
    logger.error(
      'Unable to apply the element changes.',
      `Unable to apply the element changes because obtaining the element URI failed with error ${error.message}`
    );
    return;
  }
  const uriParms = fromComparedElementUri(comparedElementUri);
  if (isError(uriParms)) {
    const error = uriParms;
    logger.error(
      'Unable to apply the element changes.',
      `Unable to apply the element changes because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  logger.trace(
    `Apply the element changes command was called for ${stringifyWithHiddenCredential(
      {
        query: JSON.parse(decodeURIComponent(comparedElementUri.query)),
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
      `Unable to apply changes for the element ${element.name}.`,
      `Unable to apply changes for the element ${element.name} because of error ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
      status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const uploadResult = await uploadElement(dispatch)(content)(
    comparedElementUri
  )(uriParms);
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Unable to upload the element ${element.name} to Endevor.`,
      `${error.message}.`
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
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL,
    context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
  });
  await discardEditedElementChanges(comparedElementUri);
  logger.info(
    `Applying changes for the element ${element.name} was successful!`
  );
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
        'Unable to open the active diff editor because it was closed'
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
      'Unable to open the active diff editor because it was closed'
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
    return new Error(
      `Unable to read the element content because of error ${error.message}`
    );
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
    remoteVersionTempFilePath,
  }: ComparedElementUriQuery): Promise<void | Error> => {
    const uploadResult = await withNotificationProgress(
      `Uploading the element ${element.name}...`
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
        `The element ${element.name} requires a sign out action to update/add elements.`
      );
      const signOutResult = await complexSignoutElement(dispatch)(
        service,
        searchLocation,
        serviceName,
        searchLocationName
      )(element)(uploadChangeControlValue);
      if (isError(signOutResult)) {
        const error = signOutResult;
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
          status: SignoutErrorRecoverCommandCompletedStatus.GENERIC_ERROR,
          error,
        });
        return error;
      }
      return uploadElement(dispatch)(content)(elementUri)({
        service,
        serviceName,
        element,
        uploadChangeControlValue,
        fingerprint,
        searchLocation,
        searchLocationName,
        remoteVersionTempFilePath,
      });
    }
    if (isFingerprintMismatchError(uploadResult)) {
      logger.warn(
        `There is a conflict with the remote copy of element ${element.name}. Please resolve it before uploading again.`
      );
      const fingerprintError = uploadResult;
      await closeActiveTextEditor();
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL,
        context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
      });
      const showCompareDialogResult = await compareElementWithRemoteVersion(
        service,
        searchLocation
      )(uploadChangeControlValue)(
        element,
        serviceName,
        searchLocationName
      )(elementUri.fsPath);
      if (isError(showCompareDialogResult)) {
        const error = showCompareDialogResult;
        return error;
      }
      return fingerprintError;
    }
    if (isError(uploadResult)) {
      const error = uploadResult;
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.ERROR,
        errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
        status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR,
        error,
      });
      return error;
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
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
      context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
    });
    const signOut = await askToSignOutElements([element.name]);
    if (!signOut.signOutElements && !signOut.automaticSignOut) {
      return new Error(
        `Unable to upload the element ${element.name} because it is signed out to somebody else`
      );
    }
    if (signOut.automaticSignOut) {
      try {
        await turnOnAutomaticSignOut();
      } catch (e) {
        logger.warn(
          `Unable to update the global sign out setting.`,
          `Unable to update the global sign out setting because of error ${e.message}.`
        );
      }
    }
    const signOutResult = await withNotificationProgress(
      `Signing out the element ${element.name}...`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(element)(
        signoutChangeControlValue
      )
    );
    if (isSignoutError(signOutResult)) {
      logger.warn(
        `Unable to sign out the element ${element.name} because it is signed out to somebody else.`
      );
      const overrideSignout = await askToOverrideSignOutForElements([
        element.name,
      ]);
      if (!overrideSignout) {
        return new Error(
          `The element ${element.name} is signed out to somebody else, override signout action is not selected`
        );
      }
      const overrideSignoutResult = await withNotificationProgress(
        `Signing out the element ${element.name}...`
      )((progressReporter) =>
        overrideSignOutElement(progressReporter)(service)(element)(
          signoutChangeControlValue
        )
      );
      if (isError(overrideSignoutResult)) {
        const error = overrideSignoutResult;
        return new Error(
          `Unable to perform an override signout of the element ${element.name} because of error ${error.message}`
        );
      }
      await updateTreeAfterSuccessfulSignout(dispatch)(
        serviceName,
        service,
        searchLocationName,
        searchLocation,
        [element]
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
        context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
        status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
      });
      return overrideSignoutResult;
    }
    if (isError(signOutResult)) {
      const error = signOutResult;
      return new Error(
        `Unable to sign out the element ${element.name} because of error ${error.message}`
      );
    }
    await updateTreeAfterSuccessfulSignout(dispatch)(
      serviceName,
      service,
      searchLocationName,
      searchLocation,
      [element]
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
      context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
      status: SignoutErrorRecoverCommandCompletedStatus.SIGNOUT_SUCCESS,
    });
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
