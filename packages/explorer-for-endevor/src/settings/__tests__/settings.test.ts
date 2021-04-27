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

import { assert } from 'chai';
import {
  EDIT_FOLDER_DEFAULT,
  EDIT_FOLDER_SETTING,
  ENDEVOR_CONFIGURATION,
  LOCATIONS_DEFAULT,
  LOCATIONS_SETTING,
  MAX_PARALLEL_REQUESTS_DEFAULT,
  MAX_PARALLEL_REQUESTS_SETTING,
} from '../../constants';
import { updateGlobalEndevorConfiguration } from '@local/vscode-wrapper/settings';
import { LocationConfig } from '../../_doc/settings';
import {
  addElementLocation,
  addService,
  getLocations,
  getMaxParallelRequests,
  getTempEditFolder,
  removeElementLocation,
  removeService,
} from '../settings';
import { ConfigurationTarget, workspace } from 'vscode';

describe('extension settings', () => {
  type NotDefined = undefined;
  let beforeTestsLocations: ReadonlyArray<LocationConfig> | NotDefined;
  let beforeTestsRequestsAmount: number | NotDefined;
  let beforeTestsEditFolder: string | NotDefined;
  beforeEach(async () => {
    beforeTestsLocations = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(LOCATIONS_SETTING);
    beforeTestsRequestsAmount = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(MAX_PARALLEL_REQUESTS_SETTING);
    beforeTestsEditFolder = workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .get(EDIT_FOLDER_SETTING);
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(LOCATIONS_SETTING, LOCATIONS_DEFAULT, ConfigurationTarget.Global);
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        MAX_PARALLEL_REQUESTS_SETTING,
        MAX_PARALLEL_REQUESTS_DEFAULT,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        EDIT_FOLDER_DEFAULT,
        ConfigurationTarget.Global
      );
  });
  afterEach(async () => {
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        LOCATIONS_SETTING,
        beforeTestsLocations,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        MAX_PARALLEL_REQUESTS_SETTING,
        beforeTestsRequestsAmount,
        ConfigurationTarget.Global
      );
    await workspace
      .getConfiguration(ENDEVOR_CONFIGURATION)
      .update(
        EDIT_FOLDER_SETTING,
        beforeTestsEditFolder,
        ConfigurationTarget.Global
      );
  });

  it('should add service name', async () => {
    // arrange
    const service = 'test';
    // act
    await addService(service);
    // assert
    assert.isDefined(findServiceFromSettingsByName(service));

    await removeService(service);
    assert.isUndefined(findServiceFromSettingsByName(service));
  });

  const findServiceFromSettingsByName = (
    name: string
  ): LocationConfig | undefined => {
    return getLocations().find((location) => location.service === name);
  };

  it('should add element location for service', async () => {
    // arrange
    const service = 'service';
    const elementLocation = 'element-location';
    // act
    await addElementLocation(elementLocation, service);
    // assert
    assert.isDefined(
      findElementLocationFromService(
        elementLocation,
        findServiceFromSettingsByName(service)
      )
    );

    await removeElementLocation(elementLocation, service);
    assert.isUndefined(
      findElementLocationFromService(
        elementLocation,
        findServiceFromSettingsByName(service)
      )
    );
  });

  const findElementLocationFromService = (
    elementLocationToFind: string,
    endevorService: LocationConfig | undefined
  ): string | undefined => {
    return endevorService?.elementLocations.find(
      (location) => location === elementLocationToFind
    );
  };

  it('should return max Endevor parallel requests amount', async () => {
    // arrange
    const requestsAmount = 10;
    await updateGlobalEndevorConfiguration(ENDEVOR_CONFIGURATION)(
      MAX_PARALLEL_REQUESTS_SETTING,
      requestsAmount
    );
    // act
    const actualRequestsAmount = getMaxParallelRequests();
    // assert
    assert.equal(actualRequestsAmount, requestsAmount);
  });

  it('should return edit temp folder', async () => {
    // arrange
    const folderName = 'some_name';
    await updateGlobalEndevorConfiguration(ENDEVOR_CONFIGURATION)(
      EDIT_FOLDER_SETTING,
      folderName
    );
    // act
    const actualFolderName = getTempEditFolder();
    // assert
    assert.equal(actualFolderName, folderName);
  });
});
