/* eslint-disable no-case-declarations */
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

import * as vscode from 'vscode';
import { OUTPUT_CHANNEL_NAME } from './constants';
import { make as makeLogger } from './logger';

/*
This is the only module that is allowed to execute code directly
in the module scope! All other modules should define and export functions.
*/
const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
export const logger = makeLogger(outputChannel);
