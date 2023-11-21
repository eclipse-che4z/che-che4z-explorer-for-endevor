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

const {
  getLicenseInformationForCompilation,
  getSortedLicenseInformation,
  overrideLicenses,
} = require('license-checker-webpack-plugin/src/licenseUtils');
const { writeFile, readFile } = require('fs').promises;
const os = require('os');

// os specifics
const lineSeparator = os.EOL;
const ENCODING = 'utf-8';

async function bundleLicenses(compilation, options) {
  const depsLicenses = getDependenciesLicenseInfo(
    compilation,
    options.override
  );
  await Promise.all([
    writeNoticeFile(depsLicenses, options.noticeTemplateFilePath),
    writeLicenseFile(depsLicenses, options.licenseTemplateFilePath),
  ]);
}

function getDependenciesLicenseInfo(compilation, override) {
  // collect licenses for every production dependency, except @local scoped
  const filter =
    /(^.*[/\\]node_modules[/\\]((?:@(?:(?!local)[^@/\\])+[/\\])?(?:[^@/\\]+)))/;
  let licenses = getLicenseInformationForCompilation(compilation, filter);
  const overrideOverkill = duplicateLicenseObjectsForWindows(override);
  licenses = overrideLicenses(licenses, overrideOverkill);
  return getSortedLicenseInformation(licenses);
}

/**
 * Format override keys to Windows compliant keys by replacing slash (/) with double backslash (\\).
 * Done to ensure an original override key or a formatted key will match a key collected by getLicenseInformationForCompilation() on any platform.
 * @param override - the original override object.
 * @returns - override object with both original and formatted Windows compliant keys, and duplicated values.
 */
function duplicateLicenseObjectsForWindows(override) {
  return Object.entries(override).reduce(
    (accum, [originalWebpackKey, duplicatedOverrideObject]) => {
      accum[originalWebpackKey] = duplicatedOverrideObject;
      const windowsComplientKey = originalWebpackKey.replace(/\//g, '\\');
      accum[windowsComplientKey] = duplicatedOverrideObject;
      return accum;
    },
    {}
  );
}

async function writeNoticeFile(depsLicenses, noticeTemplateFilePath) {
  const noticeText = (await readFile(noticeTemplateFilePath))
    .toString(ENCODING)
    .trim();
  const header = noticeText;
  const separator = `${lineSeparator}${lineSeparator}`;
  const depsContent = depsLicenses
    .map(
      (dep) =>
        `${dep.name} (${dep.version})${lineSeparator}${lineSeparator}- License: ${dep.licenseName}${lineSeparator}- Project: https://www.npmjs.com/package/${dep.name}`
    )
    .join(separator);
  const content = `${header}${separator}${depsContent}${lineSeparator}`;
  await writeFile('NOTICE.md', content);
}

async function writeLicenseFile(depsLicenses, licenseTemplateFilePath) {
  const licenseText = (await readFile(licenseTemplateFilePath)).toString(
    ENCODING
  );
  const header = licenseText;
  const separator = `${lineSeparator}${lineSeparator}---${lineSeparator}${lineSeparator}`;
  const depsContent = depsLicenses
    .map((dep) => {
      const depHeader = `${dep.licenseName}${lineSeparator}(${dep.name} ${dep.version})`;
      if (dep.licenseText) {
        return `${depHeader}${lineSeparator}${lineSeparator}${dep.licenseText.trim()}`;
      }
      return depHeader;
    })
    .join(separator);
  const content = `${header}${separator}${depsContent}${lineSeparator}`;
  await writeFile('LICENSE.txt', content);
}

module.exports = bundleLicenses;
