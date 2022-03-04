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

import { EXT_ID, EXT_VERSION, OUTPUT_CHANNEL_NAME } from './constants';
import { createLogger } from '@local/vscode-wrapper/logger';
import { createReporter } from './telemetry';

export const logger = createLogger(OUTPUT_CHANNEL_NAME);

export const reporter = createReporter(
  EXT_ID,
  EXT_VERSION,
  __E4E_TELEMETRY_KEY__
)(logger);
