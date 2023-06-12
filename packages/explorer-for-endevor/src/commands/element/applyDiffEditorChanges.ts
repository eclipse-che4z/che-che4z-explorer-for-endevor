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

import { isErrorEndevorResponse } from '@local/endevor/utils';
import { Uri } from 'vscode';
import { logger, reporter } from '../../globals';
import { formatWithNewLines, isError, isTheSameLocation } from '../../utils';
import {
  closeActiveTextEditor,
  getActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromComparedElementUri } from '../../uri/comparedElementUri';
import { discardEditedElementChanges } from './discardEditedElementChanges';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import { signOutElement, updateElement } from '../../endevor';
import { getFileContent } from '@local/vscode-wrapper/workspace';
import { TextDecoder } from 'util';
import { ENCODING } from '../../constants';
import {
  askToOverrideSignOutForElements,
  askToSignOutElements,
} from '../../dialogs/change-control/signOutDialogs';
import { turnOnAutomaticSignOut } from '../../settings/settings';
import {
  ActionChangeControlValue,
  Element,
  Service,
  ChangeControlValue,
  ElementMapPath,
  SubSystemMapPath,
  Value,
  SignoutElementResponse,
  ErrorResponseType,
  UpdateResponse,
  ElementData,
  ElementDataWithFingerprint,
} from '@local/endevor/_doc/Endevor';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  TelemetryEvents,
  ApplyDiffEditorChangesCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  UploadElementCommandCompletedStatus,
} from '../../_doc/Telemetry';
import { EndevorId } from '../../store/_doc/v2/Store';
import { ElementSearchLocation } from '../../_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import { ConnectionConfigurations, getConnectionConfiguration } from '../utils';

export const applyDiffEditorChanges = async (
  configurations: ConnectionConfigurations,
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
      `Unable to apply the element changes because obtaining the element URI failed with an error:\n${error.message}`
    );
    return;
  }
  const uriParams = fromComparedElementUri(comparedElementUri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      'Unable to apply the element changes.',
      `Unable to apply the element changes because parsing of the element's URI failed with an error:\n${error.message}.`
    );
    return;
  }
  const {
    uploadTargetLocation,
    uploadChangeControlValue,
    element,
    fingerprint,
    initialSearchContext: {
      serviceId,
      searchLocationId,
      initialSearchLocation,
    },
  } = uriParams;
  logger.trace(
    `Apply diff changes for the element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} 
    of ${serviceId.source} connection ${serviceId.name} and ${searchLocationId.source} location ${searchLocationId.name}.`
  );
  const connectionParams = await getConnectionConfiguration(configurations)(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const { service, configuration, searchLocation } = connectionParams;
  const elementData = await readComparedElementContent();
  if (isError(elementData)) {
    const error = elementData;
    logger.error(
      `Unable to apply changes for the element ${uploadTargetLocation.id}.`,
      `Unable to apply changes for the element ${uploadTargetLocation.id} because of error ${error.message}.`
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
    serviceId,
    searchLocationId,
    initialSearchLocation
  )(
    service,
    configuration,
    searchLocation
  )(uploadChangeControlValue, uploadTargetLocation)(
    element,
    comparedElementUri
  )({
    content: elementData.content,
    fingerprint,
    elementFilePath: elementData.elementFilePath,
  });
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Unable to upload the element ${uploadTargetLocation.id} to Endevor.`,
      `${error.message}.`
    );
    return;
  }
  if (uploadResult && isErrorEndevorResponse(uploadResult)) {
    const error = uploadResult;
    logger.error(
      `Unable to upload the element ${uploadTargetLocation.id} to Endevor.`,
      `${formatWithNewLines(error.details.messages)}.`
    );
    return;
  }
  if (
    uploadResult &&
    uploadResult.details?.returnCode &&
    uploadResult.details?.returnCode >= 4
  ) {
    logger.warn(
      `Element ${element.name} was updated with warnings`,
      `Element ${element.name} was updated with warnings: ${formatWithNewLines(
        uploadResult.details.messages
      )}.`
    );
  }
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_DISCARD_EDITED_ELEMENT_CHANGES_CALL,
    context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
  });
  await discardEditedElementChanges(comparedElementUri);
  const isNewElementAdded = uploadTargetLocation.id !== element.name;
  if (isNewElementAdded) {
    await dispatch({
      type: Actions.ELEMENT_ADDED,
      serviceId,
      searchLocationId,
      element: {
        ...uploadTargetLocation,
        id: uploadTargetLocation.id,
        name: uploadTargetLocation.id,
        noSource: false,
        extension: element.extension,
        lastActionCcid: uploadChangeControlValue.ccid.toUpperCase(),
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
    targetElement: {
      ...uploadTargetLocation,
      id: element.id,
      name: element.name,
      noSource: false,
      extension: element.extension,
      lastActionCcid: uploadChangeControlValue.ccid.toUpperCase(),
    },
  });
  logger.info(
    `Applying changes for the element ${uploadTargetLocation.id} was successful!`
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

const readComparedElementContent = async (): Promise<ElementData | Error> => {
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
    const content = new TextDecoder(ENCODING).decode(
      await getFileContent(Uri.file(comparedElementPath))
    );
    return {
      content,
      elementFilePath: comparedElementPath,
    };
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
    configuration: Value,
    overallSearchLocation: ElementSearchLocation
  ) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, elementUri: Uri) =>
  async (
    elementData: ElementDataWithFingerprint
  ): Promise<UpdateResponse | Error | void> => {
    const uploadResult = await withNotificationProgress(
      `Uploading the element ${uploadTargetLocation.id} ...`
    )((progressReporter) => {
      return updateElement(progressReporter)(endevorConnectionDetails)(
        configuration
      )(uploadTargetLocation)(uploadChangeControlValue)(elementData);
    });
    if (isErrorEndevorResponse(uploadResult)) {
      const errorResponse = uploadResult;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to upload the element ${
          uploadTargetLocation.id
        } to Endevor because of an error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warn(
            `The element ${uploadTargetLocation.id} requires a sign out action to update/add elements.`
          );
          const signOutDialogResult = await askToSignOutElements([
            element.name,
          ]);
          if (
            !signOutDialogResult.signOutElements &&
            !signOutDialogResult.automaticSignOut
          ) {
            logger.error(
              `Unable to upload the element ${element.name} to Endevor because it is signed out to somebody else or not at all.`
            );
            return errorResponse;
          }
          if (signOutDialogResult.automaticSignOut) {
            try {
              await turnOnAutomaticSignOut();
            } catch (error) {
              logger.warn(
                `Unable to update the global sign out setting.`,
                `Unable to update the global sign out setting because of an error:\n${error.message}.`
              );
            }
          }
          const preUpdateSignout = await complexSignoutElement(dispatch)(
            endevorConnectionDetails,
            configuration,
            serviceId,
            searchLocationId
          )(element)(uploadChangeControlValue);
          if (isErrorEndevorResponse(preUpdateSignout)) return errorResponse;
          return uploadElement(dispatch)(
            serviceId,
            searchLocationId,
            initialSearchLocation
          )(
            endevorConnectionDetails,
            configuration,
            overallSearchLocation
          )(uploadChangeControlValue, uploadTargetLocation)(
            element,
            elementUri
          )(elementData);
        }
        case ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR: {
          return uploadFingerprintMismatch(
            serviceId,
            searchLocationId,
            initialSearchLocation
          )(endevorConnectionDetails, configuration)(
            uploadChangeControlValue,
            uploadTargetLocation
          )(element, elementUri);
        }
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
          logger.error(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR: {
          logger.error(
            `Unable to connect to Endevor Web Services.`,
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.GENERIC_ERROR: {
          logger.error(
            `Unable to upload the element ${element.name} to Endevor.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_CALLED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        default: {
          throw new UnreachableCaseError(errorResponse.type);
        }
      }
    }
    return uploadResult;
  };

const complexSignoutElement =
  (dispatch: (action: Action) => Promise<void>) =>
  (
    service: Service,
    configuration: Value,
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<SignoutElementResponse> => {
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
      context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
    });
    let signOutResponse = await withNotificationProgress(
      `Signing out the element ${element.name} ...`
    )((progressReporter) =>
      signOutElement(progressReporter)(service)(configuration)(element)({
        signoutChangeControlValue,
      })
    );
    if (isErrorEndevorResponse(signOutResponse)) {
      const errorResponse = signOutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.warn(
            `Element ${element.name} cannot be signout because the element is signed out to somebody else.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_CALLED,
            context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
          });
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.name} will be signed out with override.`
          );
          signOutResponse = await withNotificationProgress(
            `Signing out the element with override ${element.name} ...`
          )((progressReporter) =>
            signOutElement(progressReporter)(service)(configuration)(element)({
              signoutChangeControlValue,
              overrideSignOut: true,
            })
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.COMMAND_SIGNOUT_ERROR_RECOVER_COMPLETED,
            context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_CALLED,
            status: SignoutErrorRecoverCommandCompletedStatus.OVERRIDE_SUCCESS,
          });
          return signOutResponse;
        default:
          return errorResponse;
      }
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
    return signOutResponse;
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

const uploadFingerprintMismatch =
  (
    serviceId: EndevorId,
    searchLocationId: EndevorId,
    initialSearchLocation: SubSystemMapPath
  ) =>
  (endevorConnectionDetails: Service, configuration: Value) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  async (element: Element, elementUri: Uri) => {
    logger.warn(
      `There is a conflict with the remote copy of element ${uploadTargetLocation.id}. Please resolve it before uploading again.`
    );
    await closeActiveTextEditor();
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL,
      context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
    });
    const showCompareDialogResult = await compareElementWithRemoteVersion(
      endevorConnectionDetails,
      configuration,
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
    return;
  };
