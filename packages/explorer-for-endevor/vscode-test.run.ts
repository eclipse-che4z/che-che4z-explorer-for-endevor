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

import * as path from 'path';
import { runTests } from 'vscode-test';
import { TestOptions } from 'vscode-test/out/runTest';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname);

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './mocha.bootstrap');

    // Set grep value for Mocha, to trigger only the type of tests passed in package.json
    // format is `(type)`, where type = unit | integration | system
    // if no type is passed, ALL tests are executed
    const MOCHA_grep_value =
      process.argv.length > 2 ? `(${process.argv[2]})` : '';

    const testOptions: TestOptions = {
      // Have to use insiders version if we want to run it from CLI as well (as opposed to Run from Activity Bar only)
      // See: https://code.visualstudio.com/api/working-with-extensions/testing-extension#tips
      version: 'stable',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
      extensionTestsEnv: {
        MOCHA_grep: MOCHA_grep_value,
      },
    };
    // Download VS Code, unzip it and run the integration test
    await runTests(testOptions);
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
