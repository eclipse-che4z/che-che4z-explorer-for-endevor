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

import { Element } from '@local/endevor/_doc/Endevor';
import { MoveOptions } from '../dialogs/multi-step/moveOptions';

export const generateMoveSCL = (element: Element, options: MoveOptions) => {
  return `
MOVE ELEMENT '${element.name}'
FROM ENVIRONMENT '${element.environment}'
     SYSTEM '${element.system}'
     SUBSYSTEM '${element.subSystem}'
     TYPE '${element.type}'
     STAGE NUM ${element.stageNumber}
${getOptionsSCL(options)}.
`;
};

const getOptionsSCL = (options: MoveOptions): string => {
  let optionsScl = '';
  if (options.ccid) {
    optionsScl += `CCID '${options.ccid}' `;
  }
  if (options.comment) {
    optionsScl += `COMMENT '${options.comment}' `;
  }
  if (options.withHistory) {
    optionsScl += 'WITH HISTORY ';
  }
  if (options.bypassElementDelete) {
    optionsScl += 'BYPASS ELEMENT DELETE ';
  }
  if (options.synchronize) {
    optionsScl += 'SYNCHRONIZE ';
  }
  if (options.retainSignout) {
    optionsScl += 'RETAIN SIGNOUT ';
  }
  if (options.ackElementJump) {
    optionsScl += 'JUMP ';
  }
  return `${optionsScl === '' ? '' : 'OPTIONS ' + optionsScl}
`;
};
