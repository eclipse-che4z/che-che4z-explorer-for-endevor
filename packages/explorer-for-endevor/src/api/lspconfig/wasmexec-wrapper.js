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

import { Headers } from 'undici';

('use strict');

globalThis.require = require;
globalThis.fs = require('fs');
globalThis.TextEncoder = require('util').TextEncoder;
globalThis.TextDecoder = require('util').TextDecoder;
globalThis.Headers = Headers;

// NOTE: cannot be reassigned in NodeJS 18+
const crypto = require('crypto');
globalThis.crypto = {
  getRandomValues(b) {
    crypto.randomFillSync(b);
  },
};

// Bit hacky way to dynamically load modules needed by exportz API if they are present
// More info here:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import
// and
// https://medium.com/front-end-weekly/webpack-and-dynamic-imports-doing-it-right-72549ff49234
const lspWasmDir = 'lspwasm';
await import(`../../../resources/${lspWasmDir}/wasm_exec`);
