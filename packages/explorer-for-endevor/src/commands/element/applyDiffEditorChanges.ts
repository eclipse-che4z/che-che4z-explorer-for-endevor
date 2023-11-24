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
import { reporter } from '../../globals';
import { formatWithNewLines, isError, isTheSameLocation } from '../../utils';
import {
  closeActiveTextEditor,
  getActiveTextEditor,
  withNotificationProgress,
} from '@local/vscode-wrapper/window';
import { fromComparedElementUri } from '../../uri/comparedElementUri';
import { discardEditedElementChanges } from './discardEditedElementChanges';
import { compareElementWithRemoteVersion } from './compareElementWithRemoteVersion';
import {
  signOutElementAndLogActivity,
  updateElementAndLogActivity,
} from '../../api/endevor';
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
  ChangeControlValue,
  ElementMapPath,
  SubSystemMapPath,
  SignoutElementResponse,
  ErrorResponseType,
  UpdateResponse,
  ElementData,
  ElementDataWithFingerprint,
  ProcessorGroupValue,
} from '@local/endevor/_doc/Endevor';
import { Action, Actions } from '../../store/_doc/Actions';
import {
  TelemetryEvents,
  ApplyDiffEditorChangesCompletedStatus,
  SignoutErrorRecoverCommandCompletedStatus,
  UploadElementCommandCompletedStatus,
} from '../../telemetry/_doc/Telemetry';
import { EndevorId } from '../../store/_doc/v2/Store';
import {
  EndevorAuthorizedService,
  SearchLocation,
} from '../../api/_doc/Endevor';
import { UnreachableCaseError } from '@local/endevor/typeHelpers';
import {
  EndevorLogger,
  createEndevorLogger,
  logActivity as setLogActivityContext,
} from '../../logger';

export const applyDiffEditorChanges = async (
  dispatch: (action: Action) => Promise<void>,
  getConnectionConfiguration: (
    serviceId: EndevorId,
    searchLocationId: EndevorId
  ) => Promise<
    | {
        service: EndevorAuthorizedService;
        searchLocation: SearchLocation;
      }
    | undefined
  >,
  incomingUri?: Uri
): Promise<void> => {
  const logger = createEndevorLogger();
  const comparedElementUri = await toElementUriEvenInTheia(incomingUri);
  if (isError(comparedElementUri)) {
    const error = comparedElementUri;
    logger.error(
      'Unable to apply element changes.',
      `Unable to apply element changes because obtaining the element URI failed with an error:\n${error.message}`
    );
    return;
  }
  const uriParams = fromComparedElementUri(comparedElementUri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      'Unable to apply element changes.',
      `Unable to apply element changes because parsing of the element's URI failed with an error:\n${error.message}.`
    );
    return;
  }
  const {
    uploadTargetLocation,
    uploadChangeControlValue,
    uploadProcessorGroupValue,
    element,
    fingerprint,
    initialSearchContext: {
      serviceId,
      searchLocationId,
      initialSearchLocation,
    },
  } = uriParams;
  logger.updateContext({ serviceId, searchLocationId });
  logger.traceWithDetails(
    `Apply diff changes for element ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name}.`
  );
  const connectionParams = await getConnectionConfiguration(
    serviceId,
    searchLocationId
  );
  if (!connectionParams) return;
  const { service } = connectionParams;
  const elementData = await readComparedElementContent();
  if (isError(elementData)) {
    const error = elementData;
    logger.errorWithDetails(
      `Unable to apply changes for element ${uploadTargetLocation.id}.`,
      `Unable to apply changes for element ${uploadTargetLocation.environment}/${uploadTargetLocation.stageNumber}/${uploadTargetLocation.system}/${uploadTargetLocation.subSystem}/${uploadTargetLocation.type}/${uploadTargetLocation.id} because of error ${error.message}.`
    );
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.ERROR,
      errorContext: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
      status: ApplyDiffEditorChangesCompletedStatus.GENERIC_ERROR,
      error,
    });
    return;
  }
  const uploadResult = await uploadElement(logger)(dispatch)(
    serviceId,
    searchLocationId
  )(service)(initialSearchLocation)(
    uploadChangeControlValue,
    uploadProcessorGroupValue,
    uploadTargetLocation
  )(
    element,
    comparedElementUri
  )({
    content: elementData.content,
    fingerprint,
    elementFilePath: elementData.elementFilePath,
  });
  if (isError(uploadResult)) {
    const error = uploadResult;
    logger.errorWithDetails(
      `Unable to upload element ${uploadTargetLocation.id} to Endevor.`,
      `${error.message}.`
    );
    return;
  }
  if (uploadResult && isErrorEndevorResponse(uploadResult)) {
    const error = uploadResult;
    logger.errorWithDetails(
      `Unable to upload element ${uploadTargetLocation.id} to Endevor.`,
      `${formatWithNewLines(error.details.messages)}.`
    );
    return;
  }
  if (
    uploadResult &&
    uploadResult.details?.returnCode &&
    uploadResult.details?.returnCode >= 4
  ) {
    logger.warnWithDetails(
      `Element ${element.name} was updated with warnings`,
      `Element  ${element.environment}/${element.stageNumber}/${
        element.system
      }/${element.subSystem}/${element.type}/${
        element.name
      } was updated with warnings: ${formatWithNewLines(
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
        processorGroup: element.processorGroup,
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
      processorGroup: element.processorGroup,
    },
  });
  logger.infoWithDetails(
    `Applying changes for element ${uploadTargetLocation.id} was successful!`
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
      `Unable to read element content because of error:\n${error.message}`
    );
  }
};

const uploadElement =
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (initialSearchLocation: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadProcessorGroupValue: ProcessorGroupValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  (element: Element, elementUri: Uri) =>
  async (
    elementData: ElementDataWithFingerprint
  ): Promise<UpdateResponse | Error | void> => {
    const uploadResult = await withNotificationProgress(
      `Uploading element ${uploadTargetLocation.id} ...`
    )((progressReporter) => {
      return updateElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(uploadTargetLocation)(
        uploadProcessorGroupValue
      )(uploadChangeControlValue)(elementData);
    });
    if (isErrorEndevorResponse(uploadResult)) {
      const errorResponse = uploadResult;
      // TODO: format using all possible error details
      const error = new Error(
        `Unable to upload element ${uploadTargetLocation.environment}/${
          uploadTargetLocation.stageNumber
        }/${uploadTargetLocation.system}/${uploadTargetLocation.subSystem}/${
          uploadTargetLocation.type
        }/${
          uploadTargetLocation.id
        } to Endevor because of error:${formatWithNewLines(
          errorResponse.details.messages
        )}`
      );
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR: {
          logger.warnWithDetails(
            `Element ${uploadTargetLocation.id} requires a sign out action to update/add elements.`
          );
          const signOutDialogResult = await askToSignOutElements([
            element.name,
          ]);
          if (
            !signOutDialogResult.signOutElements &&
            !signOutDialogResult.automaticSignOut
          ) {
            logger.errorWithDetails(
              `Unable to upload element ${element.name} to Endevor because it is signed out to somebody else or not at all.`
            );
            return errorResponse;
          }
          if (signOutDialogResult.automaticSignOut) {
            try {
              await turnOnAutomaticSignOut();
            } catch (error) {
              logger.warnWithDetails(
                `Unable to update the global sign out setting.`,
                `Unable to update the global sign out setting because of error:\n${error.message}.`
              );
            }
          }
          const preUpdateSignout = await complexSignoutElement(logger)(
            dispatch
          )(
            serviceId,
            searchLocationId
          )(service)(element)(uploadChangeControlValue);
          if (isErrorEndevorResponse(preUpdateSignout)) return errorResponse;
          return uploadElement(logger)(dispatch)(serviceId, searchLocationId)(
            service
          )(initialSearchLocation)(
            uploadChangeControlValue,
            uploadProcessorGroupValue,
            uploadTargetLocation
          )(
            element,
            elementUri
          )(elementData);
        }
        case ErrorResponseType.FINGERPRINT_MISMATCH_ENDEVOR_ERROR: {
          return uploadFingerprintMismatch(logger)(dispatch)(
            serviceId,
            searchLocationId
          )(service)(initialSearchLocation)(
            uploadChangeControlValue,
            uploadProcessorGroupValue,
            uploadTargetLocation
          )(element, elementUri);
        }
        case ErrorResponseType.WRONG_CREDENTIALS_ENDEVOR_ERROR:
        case ErrorResponseType.UNAUTHORIZED_REQUEST_ERROR: {
          logger.errorWithDetails(
            `Endevor credentials are incorrect or expired.`,
            `${error.message}.`
          );
          // TODO: introduce a quick credentials recovery process (e.g. button to show a credentials prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.CERT_VALIDATION_ERROR:
        case ErrorResponseType.CONNECTION_ERROR: {
          logger.errorWithDetails(
            `Unable to connect to Endevor Web Services.`,
            `${error.message}.`
          );
          // TODO: introduce a quick connection details recovery process (e.g. button to show connection details prompt to fix, etc.)
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
            status: UploadElementCommandCompletedStatus.GENERIC_ERROR,
            error,
          });
          return errorResponse;
        }
        case ErrorResponseType.GENERIC_ERROR: {
          logger.errorWithDetails(
            `Unable to upload element ${element.name} to Endevor.`,
            `${error.message}.`
          );
          reporter.sendTelemetryEvent({
            type: TelemetryEvents.ERROR,
            errorContext: TelemetryEvents.COMMAND_UPLOAD_ELEMENT_COMPLETED,
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
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<SignoutElementResponse> => {
    let signOutResponse = await withNotificationProgress(
      `Signing out element ${element.name} ...`
    )((progressReporter) =>
      signOutElementAndLogActivity(
        setLogActivityContext(dispatch, {
          serviceId,
          searchLocationId,
          element,
        })
      )(progressReporter)(service)(element)({
        signoutChangeControlValue,
      })
    );
    if (isErrorEndevorResponse(signOutResponse)) {
      const errorResponse = signOutResponse;
      switch (errorResponse.type) {
        case ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR:
          logger.warnWithDetails(
            `Element ${element.name} cannot be signout because it is signed out to somebody else.`
          );
          if (!(await askToOverrideSignOutForElements([element.name]))) {
            logger.trace(`Override signout option was not chosen.`);
            return errorResponse;
          }
          logger.trace(
            `Override signout option was chosen, ${element.environment}/${element.stageNumber}/${element.system}/${element.subSystem}/${element.type}/${element.name} will be signed out with override.`
          );
          signOutResponse = await withNotificationProgress(
            `Signing out element with override ${element.name} ...`
          )((progressReporter) =>
            signOutElementAndLogActivity(
              setLogActivityContext(dispatch, {
                serviceId,
                searchLocationId,
                element,
              })
            )(progressReporter)(service)(element)({
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
  (logger: EndevorLogger) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (serviceId: EndevorId, searchLocationId: EndevorId) =>
  (service: EndevorAuthorizedService) =>
  (initialSearchLocation: SubSystemMapPath) =>
  (
    uploadChangeControlValue: ChangeControlValue,
    uploadProcessorGroupValue: ProcessorGroupValue,
    uploadTargetLocation: ElementMapPath
  ) =>
  async (element: Element, elementUri: Uri) => {
    logger.warnWithDetails(
      `There is a conflict with the remote copy of element ${uploadTargetLocation.id}. Please resolve it before uploading again.`
    );
    await closeActiveTextEditor();
    reporter.sendTelemetryEvent({
      type: TelemetryEvents.COMMAND_RESOLVE_CONFLICT_WITH_REMOTE_CALL,
      context: TelemetryEvents.COMMAND_APPLY_DIFF_EDITOR_CHANGES_COMPLETED,
    });
    const showCompareDialogResult = await compareElementWithRemoteVersion(
      dispatch
    )(
      serviceId,
      searchLocationId
    )(service)(initialSearchLocation)(
      uploadChangeControlValue,
      uploadProcessorGroupValue,
      uploadTargetLocation
    )(element, elementUri.fsPath);
    if (isError(showCompareDialogResult)) {
      const error = showCompareDialogResult;
      return error;
    }
    return;
  };
