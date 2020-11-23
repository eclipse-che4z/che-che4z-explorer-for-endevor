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

import { IFilter } from './IFilter';

export interface Host {
  id?: number;
  name: string;
  url: string;
  username?: string;
  password?: string;
  datasource: string;
  filters?: IFilter[];
  profileLabel?: string;
}

export interface DataSource {
  name: string;
}
