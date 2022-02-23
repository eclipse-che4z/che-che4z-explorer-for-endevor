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

// will be inserted using Webpack Define plugin
// using this advice to make a type check of new globalThis properties: https://stackoverflow.com/a/64723740
/* eslint-disable no-var */
declare namespace globalThis {
  var __E4E_BUILD_NUMBER__: string;
  var __E4E_TELEMETRY_KEY__: string;
}
