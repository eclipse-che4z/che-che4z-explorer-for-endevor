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

import * as path from 'path';
import { TestOptions, runTests } from '@vscode/test-electron/out/runTest';
import * as fs from 'fs';
import * as os from 'os';
import { fetchStableVersions } from '@vscode/test-electron/out/download';

export async function runVscodeTests(dirname: string) {
  // timeout for the request fetching stable versions (in seconds)
  const fetchStableVersionsTimeout = 10;

  const numberOfVersionsToTest = 3;
  const defaultLatestVersion = 'stable';

  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(dirname);

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(dirname, './mocha.bootstrap');

    // Set grep value for Mocha, to trigger only the type of tests passed in package.json
    // format is `(type)`, where type = unit | integration | system
    // if no type is passed, ALL tests are executed
    let MOCHA_grep_value = '';
    let version;

    for (let i = 2; i < process.argv.length; i++) {
      if (process.argv[i]?.startsWith('grep=')) {
        MOCHA_grep_value = `(${process.argv[i]?.replace('grep=', '')})`;
        continue;
      }
      if (process.argv[i]?.startsWith('version=')) {
        version = `${process.argv[i]?.replace('version=', '')}`;
        continue;
      }
    }
    version = version || defaultLatestVersion;
    let versionsToTest = [version];
    if (version.startsWith('last3')) {
      // fetched versions should be sorted, but just to be sure we sort it ourselves
      const stableVersions = (
        await fetchStableVersions(fetchStableVersionsTimeout * 1000)
      ).sort(versionCompareFn);
      const lastNumberOfVersions = getLastPatchVersions(
        stableVersions,
        numberOfVersionsToTest
      );
      versionsToTest = lastNumberOfVersions || [defaultLatestVersion];
    }
    for (const versionToTest of versionsToTest) {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), versionToTest.replace('.', '_') + 'vscode_test')
      );
      const testOptions: TestOptions = {
        // Have to use insiders version if we want to run it from CLI as well (as opposed to Run from Activity Bar only)
        // See: https://code.visualstudio.com/api/working-with-extensions/testing-extension#tips
        version: versionToTest,
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: ['--disable-extensions', `--user-data-dir=${tmpDir}`],
        extensionTestsEnv: {
          MOCHA_grep: MOCHA_grep_value,
        },
      };
      // Download VS Code, unzip it and run the integration test
      await runTests(testOptions);
    }
  } catch (err) {
    console.error(`Failed to run tests: ${err.message}`);
    return 1;
  }

  return 0;
}

function versionCompareFn(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);
  if (!versionA || !versionB) {
    // should not happen, but in case it does, move undefined to end
    return !versionA ? 1 : -1;
  }
  if (versionB.major - versionA.major !== 0) {
    return versionB.major - versionA.major;
  }
  if (versionB.minor - versionA.minor !== 0) {
    return versionB.minor - versionA.minor;
  }
  return versionB.patch - versionA.patch;
}

function getLastPatchVersions(
  versions: string[],
  numberOfVersions: number
): string[] | undefined {
  const result: string[] = [];
  let versionIndex = 0;
  let lastVersion = parseVersion(versions[versionIndex]);
  if (!lastVersion) {
    return;
  }
  result.push(versionToString(lastVersion));
  for (let i = 0; i < numberOfVersions - 1; i++) {
    const versionToCheckIndex = versions.findIndex((version, index) => {
      const versionToCheck = parseVersion(version);
      if (!lastVersion || !versionToCheck) {
        return false;
      }
      return (
        index > versionIndex &&
        (versionToCheck.major < lastVersion.major ||
          versionToCheck.minor < lastVersion.minor)
      );
    });
    const foundVersion = versions[versionToCheckIndex];
    if (!foundVersion) {
      break;
    }
    result.push(foundVersion);
    versionIndex = versionToCheckIndex;
    lastVersion = parseVersion(foundVersion);
  }
  return result;
}

function versionToString(version: {
  major: number;
  minor: number;
  patch: number;
}): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function parseVersion(
  version: string | undefined
): { major: number; minor: number; patch: number } | undefined {
  if (!version) {
    return;
  }
  let versionToParse = version;
  if (version.startsWith('^') || version.startsWith('~')) {
    versionToParse = version.slice(1);
  }
  const versionArray = versionToParse.split('.');
  if (!versionArray || versionArray.length <= 1) {
    return;
  }
  const result = {
    major: 0,
    minor: 0,
    patch: 0,
  };
  result.major = +(versionArray[0] || 0);
  result.minor = +(versionArray[1] || 0);
  if (versionArray.length > 2) {
    result.patch = +(versionArray[2] || 0);
  }
  return result;
}
