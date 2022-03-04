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
  ENDEVOR_CONFIGURATION,
  LOCATIONS_SETTING,
  EDIT_FOLDER_SETTING,
  EDIT_FOLDER_DEFAULT,
  AUTOMATIC_SIGN_OUT_SETTING,
  AUTOMATIC_SIGN_OUT_DEFAULT,
  MAX_PARALLEL_REQUESTS_SETTING,
  MAX_PARALLEL_REQUESTS_DEFAULT,
  LOCATIONS_DEFAULT,
} from '../constants';
import { logger, reporter } from '../globals';
import { parseToType } from '@local/type-parser/parser';
import {
  getEndevorConfigurationValue,
  updateGlobalEndevorConfiguration,
} from '@local/vscode-wrapper/settings';
import * as vscode from 'vscode';
import { Action, Actions } from '../_doc/Actions';
import { LocationConfig } from '../_doc/settings';
import {
  LocationConfigs,
  EditConfig,
  AutoSignOut,
  MaxParallelRequests,
} from '../_ext/settings';
import { replaceWith } from '../utils';
import { TelemetryEvents, SettingChangedStatus } from '../_doc/Telemetry';

export const getLocations = (): ReadonlyArray<LocationConfig> => {
  // please, pay attention: this call can be lazy
  const locations = getEndevorConfigurationValue(ENDEVOR_CONFIGURATION)(
    LOCATIONS_SETTING,
    LOCATIONS_DEFAULT
  );
  return parseToType(LocationConfigs, locations);
};

export const getTempEditFolder = (): string => {
  // please, pay attention: this call can be lazy
  const downloadPath = getEndevorConfigurationValue(ENDEVOR_CONFIGURATION)(
    EDIT_FOLDER_SETTING,
    EDIT_FOLDER_DEFAULT
  );
  return parseToType(EditConfig, downloadPath);
};

export const isAutomaticSignOut = (): boolean => {
  const autoSignOut = getEndevorConfigurationValue(ENDEVOR_CONFIGURATION)(
    AUTOMATIC_SIGN_OUT_SETTING,
    AUTOMATIC_SIGN_OUT_DEFAULT
  );
  return parseToType(AutoSignOut, autoSignOut);
};

export const getMaxParallelRequests = (): number => {
  // please, pay attention: this call can be lazy
  const parallelRequestsAmount = getEndevorConfigurationValue(
    ENDEVOR_CONFIGURATION
  )(MAX_PARALLEL_REQUESTS_SETTING, MAX_PARALLEL_REQUESTS_DEFAULT);
  return parseToType(MaxParallelRequests, parallelRequestsAmount);
};

export const addService = (service: string): Promise<void> => {
  const updatedLocations = updateLocationsWithNewItem(getLocations(), {
    service,
    elementLocations: [],
  });
  return updateConfiguration(updatedLocations);
};

const updateLocationsWithNewItem = (
  locations: ReadonlyArray<LocationConfig>,
  updatedItem: LocationConfig
): ReadonlyArray<LocationConfig> => {
  const existingLocation = locations.find(
    (existingItem) => existingItem.service === updatedItem.service
  );
  if (!existingLocation) {
    return [...locations, updatedItem];
  }
  const result = replaceWith(locations)(
    (item1: LocationConfig, item2: LocationConfig) =>
      item1.service === item2.service,
    updatedItem
  );
  return result;
};

const updateConfiguration = (
  updatedLocations: ReadonlyArray<LocationConfig>
): Promise<void> => {
  logger.trace(
    `Update configuration called for "${ENDEVOR_CONFIGURATION}.${LOCATIONS_SETTING}" with value: ${JSON.stringify(
      updatedLocations,
      null,
      2
    )}`
  );
  return updateGlobalEndevorConfiguration(ENDEVOR_CONFIGURATION)(
    LOCATIONS_SETTING,
    updatedLocations
  );
};

export const addElementLocation = (
  elementLocation: string,
  service: string
) => {
  const allLocations = getLocations();
  const updatedElementLocations = [
    elementLocation,
    ...getElementLocationsForService(allLocations, service),
  ];
  return updateConfiguration(
    updateLocationsWithNewItem(allLocations, {
      service,
      elementLocations: updatedElementLocations,
    })
  );
};

const getElementLocationsForService = (
  locations: ReadonlyArray<LocationConfig>,
  serviceToFind: string
): ReadonlyArray<string> => {
  const foundService = locations.find(
    (location) => location.service === serviceToFind
  );
  return foundService ? foundService.elementLocations : [];
};

export const removeService = (service: string): Promise<void> => {
  const filteredLocations = getLocations().filter(
    (existingLocation) => existingLocation.service !== service
  );
  return updateConfiguration(filteredLocations);
};

export const removeElementLocation = (
  elementLocationToRemove: string,
  service: string
) => {
  const allLocations = getLocations();
  const filteredElementLocations = getElementLocationsForService(
    allLocations,
    service
  ).filter((elementLocation) => elementLocation !== elementLocationToRemove);
  return updateConfiguration(
    updateLocationsWithNewItem(allLocations, {
      service,
      elementLocations: filteredElementLocations,
    })
  );
};

export const watchForLocations = (
  dispatch: (action: Action) => Promise<void>
) => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(`${ENDEVOR_CONFIGURATION}.${LOCATIONS_SETTING}`)
    ) {
      let updatedLocations;
      try {
        updatedLocations = getLocations();
        logger.trace(
          `Settings updated. Value: ${JSON.stringify(
            updatedLocations,
            null,
            2
          )}`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED,
          elementLocations: updatedLocations.map((location) => {
            return {
              elementLocationsAmount: location.elementLocations.length,
            };
          }),
        });
      } catch (e) {
        logger.trace(`Error when reading settings: ${e.message}`);
        updatedLocations = [];
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.ELEMENT_LOCATIONS_PROVIDED,
          status: 'GENERIC_ERROR',
          error: e,
        });
      }
      await dispatch({
        type: Actions.LOCATION_CONFIG_CHANGED,
        payload: updatedLocations,
      });
    }
  });
};

export const watchForSettingChanges = () => {
  return vscode.workspace.onDidChangeConfiguration(async (e) => {
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${AUTOMATIC_SIGN_OUT_SETTING}`
      )
    ) {
      let updatedAutomaticSignout;
      try {
        updatedAutomaticSignout = isAutomaticSignOut();
        logger.trace(
          `Settings updated. Value: ${JSON.stringify(
            updatedAutomaticSignout,
            null,
            2
          )}`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT,
          status: SettingChangedStatus.SUCCESS,
          value: updatedAutomaticSignout,
        });
      } catch (e) {
        logger.trace(`Error when reading settings: ${e.message}`);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_AUTO_SIGN_OUT,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
    if (
      e.affectsConfiguration(`${ENDEVOR_CONFIGURATION}.${EDIT_FOLDER_SETTING}`)
    ) {
      let tempEditFolder;
      try {
        tempEditFolder = getTempEditFolder();
        logger.trace(
          `Settings updated. Value: ${JSON.stringify(tempEditFolder, null, 2)}`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_EDIT_FOLDER,
          status: SettingChangedStatus.SUCCESS,
        });
      } catch (e) {
        logger.trace(`Error when reading settings: ${e.message}`);
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.ERROR,
          errorContext: TelemetryEvents.SETTING_CHANGED_EDIT_FOLDER,
          error: e,
          status: SettingChangedStatus.WRONG_SETTING_TYPE_ERROR,
        });
      }
    }
    if (
      e.affectsConfiguration(
        `${ENDEVOR_CONFIGURATION}.${MAX_PARALLEL_REQUESTS_SETTING}`
      )
    ) {
      let maxParallelRequests;
      try {
        maxParallelRequests = getMaxParallelRequests();
        logger.trace(
          `Settings updated. Value: ${JSON.stringify(
            maxParallelRequests,
            null,
            2
          )}`
        );
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.SETTING_CHANGED_MAX_PARALLEL_REQUESTS,
          status: SettingChangedStatus.SUCCESS,
          value: maxParallelRequests,
        });
      } catch (e) {
        logger.trace(`Error when reading settings: ${e.message}`);
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

export const turnOnAutomaticSignOut = async (): Promise<void> => {
  return updateGlobalEndevorConfiguration(ENDEVOR_CONFIGURATION)(
    AUTOMATIC_SIGN_OUT_SETTING,
    true
  );
};
