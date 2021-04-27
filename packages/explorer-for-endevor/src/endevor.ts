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

import { logger } from './globals';
import * as endevor from '@local/endevor/endevor';

export const getInstanceNames = endevor.getInstanceNames(logger);
export const searchForElements = endevor.searchForElements(logger);
export const viewElement = endevor.viewElement(logger);
export const retrieveElement = endevor.retrieveElement(logger);
export const generateElement = endevor.generateElement(logger);
export const retrieveElementWithDependencies = endevor.retrieveElementWithDependencies(
  logger
);
export const retrieveElementWithFingerprint = endevor.retrieveElementWithFingerprint(
  logger
);
export const printElement = endevor.printElement(logger);
export const printListing = endevor.printListing(logger);
export const updateElement = endevor.updateElement(logger);
