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

import { getFileContent } from '@local/vscode-wrapper/workspace';
import * as path from 'path';
import * as fs from 'fs';
import { Uri } from 'vscode';
import { LspConfigApi } from './_doc/LspConfig';

declare const WebAssembly: {
  instantiate: (
    buff: Uint8Array,
    imports: unknown
  ) => Promise<{
    instance: unknown;
  }>;
};

export const make = async (): Promise<Error | LspConfigApi> => {
  if (
    !fs.existsSync(
      path.resolve(__dirname, '../resources/lspwasm/lspconf.wasm')
    ) ||
    !fs.existsSync(path.resolve(__dirname, '../resources/lspwasm/wasm_exec.js'))
  ) {
    const errorMessage = 'Endevor Configuration APIs not found';
    return new Error(errorMessage);
  }
  await require('./wasmexec-wrapper');
  // Ignore next line, should be imported by wasm_exec
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const go = new Go();

  let wasmBuff;
  try {
    wasmBuff = await getFileContent(
      Uri.file(path.resolve(__dirname, '../resources/lspwasm/lspconf.wasm'))
    );
  } catch (e) {
    return e;
  }
  let wasm;
  try {
    wasm = await WebAssembly.instantiate(wasmBuff, go.importObject);
  } catch (error) {
    const errorMessage = `Failed to instantiate Endevor Configuration APIs`;
    return new Error(errorMessage);
  }

  go.run(wasm.instance);
  let counter = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await waitMs(100);
    if (go.exports.lspConfig) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return go.exports as LspConfigApi;
    }
    counter++;
    // wait 1 sec max
    if (counter === 10) break;
  }
  const errorMessage = 'Failed to load Endevor Configuration APIs';
  return new Error(errorMessage);
};

const waitMs = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
