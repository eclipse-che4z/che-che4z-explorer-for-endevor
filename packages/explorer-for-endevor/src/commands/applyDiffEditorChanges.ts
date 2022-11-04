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
  isErrorUpdateResponse,
  isFingerprintMismatchError,
  isSignoutError,
  stringifyWithHiddenCredential,
} from '@local/endevor/utils';
import { Uri } from 'vscode';
import { logger, reporter } from '../globals';
import { isError, isTheSameLocation } from '../utils';
import {
  closeActiveTextEditor,
  getActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromComparedElementUri } from '../uri/comparedElementUri';
import { discardEditedElementChanges } from './discardEditedElementChanges';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { signOutElement, updateElement } from '../endevor';
import { getFileContent } from '@local/vscode-wrapper/workspace';
import { TextDecoder } from 'util';
import { ENCODING } from '../constants';
import {
  askToOverrideSignOutForElements,
  askToSignOutElements,
} from '../dialogs/change-control/signOutDialogs';
import { turnOnAutomaticSignOut } from '../settings/settings';
import {
  ActionChangeControlValue,
  Element,
  Service,
  ElementSearchLocation,
  ChangeControlValue,
  ElementMapPath,
  SubSystemMapPath,
  SuccessUpdateResponse,
} from '@local/endevor/_doc/Endevor';
import { Action, Actions } from '../store/_doc/Actions';
import {
  TelemetryEvents,
  ApplyDiffEditorChangesCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
} from '../_doc/Telemetry';
import { EndevorId } from '../store/_doc/v2/Store';

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
  const {
    uploadTargetLocation,
    element,
    initialSearchContext: {
      serviceId,
      searchLocationId,
      initialSearchLocation,
    },
  } = uriParms;
  const content = await readComparedElementContent();
  if (isError(content)) {
    const error = content;
    logger.error(
      `Unable to apply changes for the element ${uploadTargetLocation.name}.`,
      `Unable to apply changes for the element ${uploadTargetLocation.name} because of error ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
      status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const uploadResult = await uploadElement(dispatch)(
    uriParms.initialSearchContext.serviceId,
    uriParms.initialSearchContext.searchLocationId,
    uriParms.initialSearchContext.initialSearchLocation
  )(
    uriParms.endevorConnectionDetails,
    uriParms.initialSearchContext.overallSearchLocation
  )(uriParms.uploadChangeControlValue, uriParms.uploadTargetLocation)(
    uriParms.element,
    comparedElementUri
  )(uriParms.fingerprint, content);
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Unable to upload the element ${uploadTargetLocation.name} to Endevor.`,
      `${error.message}.`
    );
    return;
  }
  if (uploadResult && uploadResult.additionalDetails.returnCode >= 4) {
    logger.warn(
      `Element ${element.name} was updated with warnings`,
      `Element ${element.name} was updated with warnings: ${uploadResult.additionalDetails.message}`
    );
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL,
    context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
  });
  await discardEditedElementChanges(comparedElementUri);
  const isNewElementAdded = uploadTargetLocation.name !== element.name;
  if (isNewElementAdded) {
    await dispatch({
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId,
      element: {
        ...uploadTargetLocation,
        extension: element.extension,
      },
    });
    return;
  }
  const isElementEditedInPlace =
    isTheSameLocation(uploadTargetLocation)(element);
  if (isElementEditedInPlace) {
    await dispatch({
      type: Actions.ELEMENT_UPDATED_IN_PLACE,
      serviceId,
      searchLocationId,
      element,
    });
    return;
  }
  await dispatch({
    type: Actions.ELEMENT_UPDATED_FROM_UP_THE_MAP,
    treePath: {
      serviceId,
      searchLocationId,
      searchLocation: initialSearchLocation,
    },
    pathUpTheMap: element,
    targetLocation: uploadTargetLocation,
  });
  logger.info(
    `Applying changes for the element ${uploadTargetLocation.name} was successful!`
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
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    initialSearchLocation: SubSystemMapPath
  ) =>
  (
    endevorConnectionDetails: Service,
    overallSearchLocation: ElementSearchLocation
  ) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, elementUri: Uri) =>
  async (
    fingerprint: string,
    content: string
  ): Promise<void | Error | SuccessUpdateResponse> => {
    const uploadResult = await withNotificationProgress(
      `Uploading the element ${uploadTargetLocation.name}...`
    )((progressReporter) => {
      return updateElement(progressReporter)(endevorConnectionDetails)(
        uploadTargetLocation
      )(uploadChangeControlValue)({
        fingerprint,
        content,
      });
    });
    if (!isErrorUpdateResponse(uploadResult)) {
      return uploadResult;
    }
    const uploadError = uploadResult.additionalDetails.error;
    if (isSignoutError(uploadError)) {
      logger.warn(
        `The element ${uploadTargetLocation.name} requires a sign out action to update/add elements.`
      );
      const signOutResult = await complexSignoutElement(dispatch)(
        endevorConnectionDetails,
        serviceId,
        searchLocationId
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
      return uploadElement(dispatch)(
        serviceId,
        searchLocationId,
        initialSearchLocation
      )(endevorConnectionDetails, overallSearchLocation)(
        uploadChangeControlValue,
        uploadTargetLocation
      )(element, elementUri)(fingerprint, content);
    }
    if (isFingerprintMismatchError(uploadError)) {
      logger.warn(
        `There is a conflict with the remote copy of element ${uploadTargetLocation.name}. Please resolve it before uploading again.`
      );
      const fingerprintError = uploadError;
      await closeActiveTextEditor();
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL,
        context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
      });
      const showCompareDialogResult = await compareElementWithRemoteVersion(
        endevorConnectionDetails,
        overallSearchLocation,
        element
      )(uploadChangeControlValue, uploadTargetLocation)(
        serviceId,
        searchLocationId,
        initialSearchLocation
      )(elementUri.fsPath);
      if (isError(showCompareDialogResult)) {
        const error = showCompareDialogResult;
        return error;
      }
      return fingerprintError;
    }
    if (isError(uploadError)) {
      const error = uploadError;
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
  (service: Service, serviceId: EndevorId, searchLocationId: EndevorId) =>
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
      signOutElement(progressReporter)(service)(element)({
        signoutChangeControlValue,
      })
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
        signOutElement(progressReporter)(service)(element)({
          signoutChangeControlValue,
          overrideSignOut: true,
        })
      );
      if (isError(overrideSignoutResult)) {
        const error = overrideSignoutResult;
        return new Error(
          `Unable to perform an override signout of the element ${element.name} because of error ${error.message}`
        );
      }
      await updateTreeAfterSuccessfulSignout(dispatch)(
        serviceId,
        searchLocationId,
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
      serviceId,
      searchLocationId,
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
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    elements: ReadonlyArray<Element>
  ): Promise<void> => {
    await dispatch({
      type: Actions.ELEMENT_SIGNED_OUT,
      serviceId,
      searchLocationId,
      elements,
    });
  };
