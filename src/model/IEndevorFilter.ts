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

import { Element } from './Element';
import { EndevorQualifier } from './IEndevorQualifier';
import { Repository } from './Repository';

export const FILTER_ALL_STRING = '*/*/*/*/*/*';

export interface IEndevorFilter {
  loadElements: (newElements: Element[], append: boolean) => void;
  getName: () => string;
  getUri: () => string;
  getDescription: () => string;
  getRepository: () => Repository;
  setRepository: (value: Repository) => void;
  getElements: () => Element[];
  getQualifier: () => EndevorQualifier;
  updateFilterString: (filterString: string) => void;
  editFilter: (name: string) => void;
  deleteFilter: () => void;
}
