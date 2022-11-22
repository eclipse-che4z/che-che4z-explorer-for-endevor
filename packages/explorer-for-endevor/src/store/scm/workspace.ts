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
  ConfirmResolution,
  ElementVersionStatus,
  EndevorWorkspaceFilter,
  IElementBasicData,
  IEndevorWorkspaceState,
  InitWorkspace,
  SyncWorkspace,
  WorkspaceDictionary,
  WorkspaceUtils,
} from '@broadcom/endevor-for-zowe-cli/lib/api';
import { parseToType } from '@local/type-parser/parser';
import { logger } from '../../globals';
import { isDefined, isError } from '../../utils';
import {
  WorkspaceElement as ExternalWorkspaceElement,
  WorkspaceResponse as ExternalWorkspaceResponse,
  WorkspaceState as ExternalWorkspaceState,
} from './_ext/Workspace';
import {
  WorkspaceElementType,
  WorkspaceElements,
  WorkspaceElement,
} from './_doc/Workspace';
import { Uri } from 'vscode';
import {
  ActionChangeControlValue,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toSecuredEndevorSession } from '@local/endevor/endevor';
import { ANY_VALUE } from '@local/endevor/const';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { IHandlerProgressApi } from '@zowe/imperative';
import { stringifyPretty } from '@local/endevor/utils';
import { WorkspaceResponse, WorkspaceSyncResponse } from './_doc/Error';
import { getWorkspaceResponse, getWorkspaceSyncResponse } from './error';

export const isWorkspace = (folderUri: Uri): boolean => {
  return WorkspaceUtils.isWorkspace(folderUri.fsPath);
};

export const initWorkspace = async (
  folderUri: Uri
): Promise<WorkspaceResponse | Error> => {
  const workspaceDir = folderUri.fsPath;
  const workspaceArgs: WorkspaceDictionary = {
    'workspace-dir': workspaceDir,
  };
  let response;
  try {
    response = await InitWorkspace.initWorkspace(workspaceArgs);
  } catch (error) {
    return new Error(
      `Unable to initialize workspace folder ${workspaceDir} because of an error:\n${error.message}`
    );
  }
  let parsedResponse: ExternalWorkspaceResponse;
  try {
    parsedResponse = parseToType(ExternalWorkspaceResponse, response);
  } catch (error) {
    logger.trace(
      `Unable to provide a failed response reason because of error:\n${
        error.message
      }\nof an incorrect response:\n${stringifyPretty(response)}.`
    );
    return new Error(
      `Unable to initialize workspace folder ${workspaceDir} because of an incorrect response`
    );
  }
  return getWorkspaceResponse(parsedResponse);
};

export const confirmConflictResolution = async (
  fileUri: Uri
): Promise<WorkspaceResponse | Error> => {
  const filePath = fileUri.fsPath;
  const workspaceArgs: WorkspaceDictionary = {
    'workspace-file': filePath,
  };
  let response;
  try {
    response = await ConfirmResolution.confirmResolution(workspaceArgs);
  } catch (error) {
    return new Error(
      `Unable to confirm conflict resolution for workspace file ${filePath} because of an error: ${error.message}`
    );
  }
  let parsedResponse: ExternalWorkspaceResponse;
  try {
    parsedResponse = parseToType(ExternalWorkspaceResponse, response);
  } catch (error) {
    logger.trace(
      `Unable to provide a failed response reason because of error:\n${
        error.message
      }\nof an incorrect response:\n${stringifyPretty(response)}.`
    );
    return new Error(
      `Unable to confirm conflict resolution for workspace file ${filePath} because of an incorrect response`
    );
  }
  return getWorkspaceResponse(parsedResponse);
};

export const syncWorkspace =
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async (folderUri: Uri): Promise<WorkspaceSyncResponse | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const location: IElementBasicData = {
      environment: environment ?? ANY_VALUE,
      stageNumber: stageNumber ?? ANY_VALUE,
      system: system ?? ANY_VALUE,
      subsystem: subsystem ?? ANY_VALUE,
      type: type ?? ANY_VALUE,
      element: element ?? ANY_VALUE,
    };
    const workspaceDir = folderUri.fsPath;
    const defaultLimit = 0; // do not limit anything
    const workspaceArgs: WorkspaceDictionary = {
      'workspace-dir': workspaceDir,
      limit: defaultLimit,
      ccid,
      comment,
    };
    const progressApi: IHandlerProgressApi = {
      startBar: (params) => {
        progress.report({
          message: params.task.statusMessage,
        });
      },
      endBar: () => {
        return;
      },
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await SyncWorkspace.syncWorkspace(
        session,
        configuration,
        location,
        workspaceArgs,
        progressApi
      );
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to synchronize workspace folder ${workspaceDir} because of an error:\n${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: ExternalWorkspaceResponse;
    try {
      parsedResponse = parseToType(ExternalWorkspaceResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to provide a failed response reason because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to synchronize workspace folder ${workspaceDir} because of an incorrect response`
      );
    }
    progress.report({ increment: 20 });
    return getWorkspaceSyncResponse(parsedResponse);
  };

export const syncWorkspaceOneWay =
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation) =>
  async (folderUri: Uri): Promise<WorkspaceSyncResponse | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const location: IElementBasicData = {
      environment: environment ?? ANY_VALUE,
      stageNumber: stageNumber ?? ANY_VALUE,
      system: system ?? ANY_VALUE,
      subsystem: subsystem ?? ANY_VALUE,
      type: type ?? ANY_VALUE,
      element: element ?? ANY_VALUE,
    };
    const workspaceDir = folderUri.fsPath;
    const defaultLimit = 0; // do not limit anything
    const workspaceArgs: WorkspaceDictionary = {
      'workspace-dir': workspaceDir,
      limit: defaultLimit,
      'one-way': true,
    };
    const progressApi: IHandlerProgressApi = {
      startBar: (params) => {
        progress.report({
          message: params.task.statusMessage,
        });
      },
      endBar: () => {
        return;
      },
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await SyncWorkspace.syncWorkspace(
        session,
        configuration,
        location,
        workspaceArgs,
        progressApi
      );
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to synchronize workspace folder ${workspaceDir} because of an error: ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: ExternalWorkspaceResponse;
    try {
      parsedResponse = parseToType(ExternalWorkspaceResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to provide a failed response reason because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to synchronize workspace folder ${workspaceDir} because of an incorrect response`
      );
    }
    progress.report({ increment: 20 });
    return getWorkspaceSyncResponse(parsedResponse);
  };

export const getWorkspaceState = async (
  folderUri: Uri
): Promise<WorkspaceElements | Error> => {
  const workspaceState = await getLatestWorkspaceState(folderUri.fsPath);
  if (isError(workspaceState)) {
    return workspaceState;
  }
  return toWorkspaceState(workspaceState);
};

const getLatestWorkspaceState = async (
  workspaceDir: string
): Promise<ExternalWorkspaceState | Error> => {
  let state: IEndevorWorkspaceState;
  try {
    state = await WorkspaceUtils.getLocalState(
      workspaceDir,
      new EndevorWorkspaceFilter()
    );
  } catch (error) {
    return new Error(
      `Unable to retrieve local state for the workspace ${workspaceDir} because of: ${error.message}`
    );
  }
  try {
    await WorkspaceUtils.detectNewLocalFiles(state);
  } catch (error) {
    return new Error(
      `Unable to detect new files in the workspace ${workspaceDir} because of: ${error.message}`
    );
  }
  try {
    return parseToType(ExternalWorkspaceState, state);
  } catch (error) {
    return new Error(
      `Invalid data format for the detected workspace state because of: ${
        error.message
      }, the actual value is: ${JSON.stringify(state)}`
    );
  }
};

const toWorkspaceState = (state: ExternalWorkspaceState): WorkspaceElements => {
  return Object.values(state.environments)
    .flatMap((envStage) => {
      return Object.values(envStage.systems).flatMap((system) => {
        return Object.values(system.subsystems).flatMap((subsystem) => {
          return Object.values(subsystem.elements).flatMap((element) => {
            return {
              envStage,
              system,
              subsystem,
              element,
            };
          });
        });
      });
    })
    .map(({ envStage, system, subsystem, element }) => {
      let parsedElement;
      try {
        parsedElement = parseToType(ExternalWorkspaceElement, element);
      } catch (error) {
        logger.trace(
          `Skipping invalid element metadata '${element}' because of: ${error.message}.`
        );
        return undefined;
      }
      return {
        localStatus: parsedElement.localStatus,
        element: {
          environment: envStage.envName,
          stageNumber: envStage.stageNumber,
          system: system.name,
          subSystem: subsystem.name,
          type: parsedElement.type,
          name: parsedElement.fullName,
        },
        fileCachedVersion: {
          hashValue: parsedElement.localFileVersion.sha1,
          hashFilePath: parsedElement.localFileVersion.sha1File,
        },
        filePath: parsedElement.localFile,
      };
    })
    .map((externalElement) => {
      if (!isDefined(externalElement)) return;
      const { localStatus, element, fileCachedVersion, filePath } =
        externalElement;
      let workspaceElement: WorkspaceElement;
      switch (localStatus) {
        case ElementVersionStatus.CHANGED:
          workspaceElement = {
            elementType: WorkspaceElementType.ELEMENT_MODIFIED,
            element,
            workspaceElementUri: Uri.file(filePath),
            originalCacheVersion: fileCachedVersion,
          };
          return workspaceElement;
        case ElementVersionStatus.MISSING:
          workspaceElement = {
            elementType: WorkspaceElementType.ELEMENT_REMOVED,
            element,
            workspaceElementUri: Uri.file(filePath),
            originalCacheVersion: fileCachedVersion,
          };
          return workspaceElement;
        case ElementVersionStatus.NEW:
          workspaceElement = {
            elementType: WorkspaceElementType.ELEMENT_ADDED,
            element,
            workspaceElementUri: Uri.file(filePath),
          };
          return workspaceElement;
        case ElementVersionStatus.CONFLICT_RESOLUTION:
          workspaceElement = {
            elementType: WorkspaceElementType.ELEMENT_CONFLICTED,
            element,
            workspaceElementUri: Uri.file(filePath),
            originalCacheVersion: fileCachedVersion,
          };
          return workspaceElement;
        case ElementVersionStatus.INSYNC:
          workspaceElement = {
            elementType: WorkspaceElementType.ELEMENT_SYNCED,
            element,
            workspaceElementUri: Uri.file(filePath),
            originalCacheVersion: fileCachedVersion,
          };
          return workspaceElement;
        default:
          return undefined;
      }
    })
    .filter(isDefined);
};
