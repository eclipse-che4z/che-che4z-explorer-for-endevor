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

import * as path from 'path';
import * as os from 'os';
import { Logger } from '@local/extension/_doc/Logger';

export const getProfilesDir = (logger: Logger) => {
  const zoweDir =
    process.env['ZOWE_CLI_HOME'] || path.join(os.homedir(), '.zowe');
  logger.trace(`ZOWE HOME detected as: ${zoweDir}`);
  return path.join(zoweDir, 'profiles');
};
