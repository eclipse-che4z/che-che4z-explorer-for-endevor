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

import { logger } from './globals';
import * as endevor from '@local/endevor/endevor';

export const getInstanceNames = endevor.getInstanceNames(logger);
export const getAllEnvironmentStages = endevor.getAllEnvironmentStages(logger);
export const getAllSystems = endevor.getAllSystems(logger);
export const getAllSubSystems = endevor.getAllSubSystems(logger);
export const searchForElements = endevor.searchForElements(logger);
export const viewElement = endevor.viewElement(logger);
export const retrieveElement = endevor.retrieveElementWithoutSignout(logger);
export const generateElement = endevor.generateElement(logger);
export const retrieveElementWithDependenciesWithoutSignout =
  endevor.retrieveElementWithDependenciesWithoutSignout(logger);
export const retrieveElementWithDependenciesWithSignout =
  endevor.retrieveElementWithDependenciesWithSignout(logger);
export const retrieveElementWithDependenciesOverrideSignout =
  endevor.retrieveElementWithDependenciesOverrideSignout(logger);
export const retrieveElementWithFingerprint =
  endevor.retrieveElementWithFingerprint(logger);
export const printElement = endevor.printElement(logger);
export const printListing = endevor.printListing(logger);
export const updateElement = endevor.updateElement(logger);
export const retrieveElementWithoutSignout =
  endevor.retrieveElementWithoutSignout(logger);
export const retrieveElementWithSignout =
  endevor.retrieveElementWithSignout(logger);
export const retrieveElementWithOverrideSignout =
  endevor.retrieveElementWithOverrideSignout(logger);
export const signOutElement = endevor.signOutElement(logger);
export const overrideSignOutElement = endevor.overrideSignOutElement(logger);
export const signInElement = endevor.signInElement(logger);
export const addElement = endevor.addElement(logger);
