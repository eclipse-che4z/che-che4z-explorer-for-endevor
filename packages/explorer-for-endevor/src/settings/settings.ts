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

import {
  ENDEVOR_CONFIGURATION,
  AUTOMATIC_SIGN_OUT_SETTING,
  AUTOMATIC_SIGN_OUT_DEFAULT,
  MAX_PARALLEL_REQUESTS_SETTING,
  MAX_PARALLEL_REQUESTS_DEFAULT,
  PROFILES_CONFIGURATION,
  SYNC_WITH_PROFILES_SETTING,
  SYNC_WITH_PROFILES_DEFAULT,
  FILE_EXT_RESOLUTION_DEFAULT,
  FILE_EXT_RESOLUTION_SETTING,
  ELM_NAME_VALUE,
  TYPE_EXT_VALUE,
  TYPE_EXT_OR_NAME_VALUE,
  WORKSPACE_SYNC_DEFAULT,
  WORKSPACE_SYNC_SETTING,
  EXPERIMENTAL_CONFIGURATION,
  AUTH_WITH_TOKEN_SETTING_DEFAULT,
  AUTH_WITH_TOKEN_SETTING,
} from '../constants';
import { logger, reporter } from '../globals';
import { parseToType } from '@local/type-parser/parser';
import {
  getSettingsValue,
  updateGlobalSettingsValue,
} from '@local/vscode-wrapper/settings';
import * as vscode from 'vscode';
import { FileExtensionResolutions } from './_doc/v2/Settings';
import {
  AutoSignOut,
  FileExtensionsResolution,
  MaxParallelRequests,
  SyncWithProfiles,
  AuthWithToken,
  WorkspaceSync,
} from './_ext/v2/Settings';
import {
  TelemetryEvents,
  SettingChangedStatus,
} from '../_doc/telemetry/Telemetry';
import { reloadWindow } from '@local/vscode-wrapper/window';
import { askToReloadWindowAfterSettingsChanged } from '../dialogs/settings/settingsDialogs';

export const getAutomaticSignOutSettingsValue = (): boolean => {
  const autoSignOut = getSettingsValue(ENDEVOR_CONFIGURATION)(
    AUTOMATIC_SIGN_OUT_SETTING,
    AUTOMATIC_SIGN_OUT_DEFAULT
  );
  return parseToType(AutoSignOut, autoSignOut);
};

export const getAuthWithTokenValue = (): boolean => {
  const authWithToken = getSettingsValue(ENDEVOR_CONFIGURATION)(
    AUTH_WITH_TOKEN_SETTING,
    AUTH_WITH_TOKEN_SETTING_DEFAULT
  );
  return parseToType(AuthWithToken, authWithToken);
};

export const getSyncWithProfilesSettingValue = (): boolean => {
  const syncWithProfiles = getSettingsValue(PROFILES_CONFIGURATION)(
    SYNC_WITH_PROFILES_SETTING,
    SYNC_WITH_PROFILES_DEFAULT
  );
  return parseToType(SyncWithProfiles, syncWithProfiles);
};

export const getMaxParallelRequestsSettingValue = (): number => {
  // please, pay attention: this call can be lazy
  const parallelRequestsAmount = getSettingsValue(ENDEVOR_CONFIGURATION)(
    MAX_PARALLEL_REQUESTS_SETTING,
    MAX_PARALLEL_REQUESTS_DEFAULT
  );
  return parseToType(MaxParallelRequests, parallelRequestsAmount);
};

export const getWorkspaceSyncSettingValue = (): boolean => {
  const workspaceSync = getSettingsValue(EXPERIMENTAL_CONFIGURATION)(
    WORKSPACE_SYNC_SETTING,
    WORKSPACE_SYNC_DEFAULT
  );
  return parseToType(WorkspaceSync, workspaceSync);
};

export const getFileExtensionResolutionSettingValue =
  (): FileExtensionResolutions => {
    const fileExtResolution = getSettingsValue(ENDEVOR_CONFIGURATION)(
      FILE_EXT_RESOLUTION_SETTING,
      FILE_EXT_RESOLUTION_DEFAULT
    );
    const parsedFileExtResolution = parseToType(
      FileExtensionsResolution,
      fileExtResolution
    );
    switch (parsedFileExtResolution) {
      case ELM_NAME_VALUE:
        return FileExtensionResolutions.FROM_NAME;
      case TYPE_EXT_VALUE:
        return FileExtensionResolutions.FROM_TYPE_EXT;
      case TYPE_EXT_OR_NAME_VALUE:
      default:
        return FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME;
    }
  };

export const watchForAutoSignoutChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${AUTOMATIC_SIGN_OUT_SETTING}`
      )
    ) {
      let updatedAutomaticSignout;
      try {
        updatedAutomaticSignout = getAutomaticSignOutSettingsValue();
        logger.trace(
          `Setting ${AUTOMATIC_SIGN_OUT_SETTING} updated with the ${updatedAutomaticSignout} value.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT,
          status: SettingChangedStatus.SUCCESS,
          value: updatedAutomaticSignout,
        });
      } catch (e) {
        logger.trace(
          `Setting ${AUTOMATIC_SIGN_OUT_SETTING} updated with an incorrect value because of ${e.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
  });
};

export const watchForAuthWithTokenChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${AUTH_WITH_TOKEN_SETTING}`
      )
    ) {
      let updatedUseToken;
      try {
        updatedUseToken = getAuthWithTokenValue();
        logger.trace(
          `Setting ${AUTH_WITH_TOKEN_SETTING} updated with the ${updatedUseToken} value.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_AUTH_WITH_TOKEN,
          status: SettingChangedStatus.SUCCESS,
          value: updatedUseToken,
        });
        const reloadNow = await askToReloadWindowAfterSettingsChanged();
        if (reloadNow) {
          await reloadWindow();
        }
      } catch (e) {
        logger.trace(
          `Setting ${AUTH_WITH_TOKEN_SETTING} updated with an incorrect value because of ${e.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_AUTH_WITH_TOKEN,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
  });
};

export const watchForSyncProfilesChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${PROFILES_CONFIGURATION}.${SYNC_WITH_PROFILES_SETTING}`
      )
    ) {
      let updatedSyncWithProfiles;
      try {
        updatedSyncWithProfiles = getSyncWithProfilesSettingValue();
        logger.trace(
          `Setting ${SYNC_WITH_PROFILES_SETTING} updated with the ${updatedSyncWithProfiles} value.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES,
          status: SettingChangedStatus.SUCCESS,
          value: updatedSyncWithProfiles,
        });
        const reloadNow = await askToReloadWindowAfterSettingsChanged();
        if (reloadNow) {
          await reloadWindow();
        }
      } catch (e) {
        logger.trace(
          `Setting ${SYNC_WITH_PROFILES_SETTING} updated with an incorrect value because of ${e.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_SYNC_WITH_PROFILES,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
  });
};

export const watchForWorkspaceSyncChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${EXPERIMENTAL_CONFIGURATION}.${WORKSPACE_SYNC_SETTING}`
      )
    ) {
      let updatedWorkspaceSync;
      try {
        updatedWorkspaceSync = getWorkspaceSyncSettingValue();
        logger.trace(
          `Setting ${WORKSPACE_SYNC_SETTING} updated with the ${updatedWorkspaceSync} value.`
        );
        const reloadNow = await askToReloadWindowAfterSettingsChanged();
        if (reloadNow) {
          await reloadWindow();
        }
      } catch (e) {
        logger.trace(
          `Setting ${WORKSPACE_SYNC_SETTING} updated with an incorrect value because of ${e.message}.`
        );
      }
    }
  });
};

export const watchForMaxEndevorRequestsChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${MAX_PARALLEL_REQUESTS_SETTING}`
      )
    ) {
      let maxParallelRequests;
      try {
        maxParallelRequests = getMaxParallelRequestsSettingValue();
        logger.trace(
          `Setting ${MAX_PARALLEL_REQUESTS_SETTING} updated with the ${maxParallelRequests} value.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS,
          status: SettingChangedStatus.SUCCESS,
          value: maxParallelRequests,
        });
      } catch (e) {
        logger.trace(
          `Setting ${MAX_PARALLEL_REQUESTS_SETTING} updated with an incorrect value because of ${e.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
  });
};

export const watchForFileExtensionResolutionChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${FILE_EXT_RESOLUTION_SETTING}`
      )
    ) {
      try {
        const fileExtResolution = getFileExtensionResolutionSettingValue();
        logger.trace(
          `Setting ${FILE_EXT_RESOLUTION_SETTING} updated with the ${fileExtResolution} value.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION,
          status: SettingChangedStatus.SUCCESS,
          value: fileExtResolution,
        });
      } catch (e) {
        logger.trace(
          `Setting ${FILE_EXT_RESOLUTION_SETTING} updated with an incorrect value because of ${e.message}.`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_FILE_EXT_RESOLUTION,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
  });
};

export const turnOnAutomaticSignOut = async (): Promise<void> => {
  return updateGlobalSettingsValue(ENDEVOR_CONFIGURATION)(
    AUTOMATIC_SIGN_OUT_SETTING,
    true
  );
};

export const isAutomaticSignOut = (): boolean => {
  try {
    return getAutomaticSignOutSettingsValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for automatic signout, default: ${AUTOMATIC_SIGN_OUT_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return AUTOMATIC_SIGN_OUT_DEFAULT;
  }
};

export const isAuthWithToken = (): boolean => {
  try {
    return getAuthWithTokenValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for token authorization, default: ${AUTH_WITH_TOKEN_SETTING_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return AUTH_WITH_TOKEN_SETTING_DEFAULT;
  }
};

export const getMaxParallelRequests = (): number => {
  try {
    return getMaxParallelRequestsSettingValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for the Endevor pool size, default: ${MAX_PARALLEL_REQUESTS_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return MAX_PARALLEL_REQUESTS_DEFAULT;
  }
};

export const isSyncWithProfiles = (): boolean => {
  try {
    return getSyncWithProfilesSettingValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings values for syncing with profiles, default: ${SYNC_WITH_PROFILES_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return SYNC_WITH_PROFILES_DEFAULT;
  }
};

export const isWorkspaceSync = (): boolean => {
  try {
    return getWorkspaceSyncSettingValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for workspace synchronization, default: ${WORKSPACE_SYNC_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return WORKSPACE_SYNC_DEFAULT;
  }
};

export const getFileExtensionResolution = (): FileExtensionResolutions => {
  try {
    return getFileExtensionResolutionSettingValue();
  } catch (e) {
    logger.warn(
      `Cannot read the settings value for the file extensions resolution, default: ${FILE_EXT_RESOLUTION_DEFAULT} will be used instead.`,
      `Reading settings error: ${e.message}.`
    );
    return FileExtensionResolutions.FROM_TYPE_EXT_OR_NAME;
  }
};
