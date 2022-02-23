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

import * as vscode from 'vscode';
import { showDocument as showElementContent } from '@local/vscode-wrapper/window';
import { getElementContent } from '../view/elementContentProvider';
import { reporter } from '../globals';
import { TelemetryEvents } from '../_doc/Telemetry';

export const printElement = async (elementUri: vscode.Uri) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_PRINT_ELEMENT_CALLED,
  });
  try {
    const elementContent = await getElementContent(elementUri);
    if (!elementContent.getText()) {
      return;
    }
    await showElementContent(elementContent);
  } catch (error) {
    return;
  }
};
