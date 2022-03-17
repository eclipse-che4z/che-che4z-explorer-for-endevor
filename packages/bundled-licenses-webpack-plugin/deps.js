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
  const filter = /(^.*[/\\]node_modules[/\\]((?:@[^/\\]+[/\\])?(?:[^/\\]+)))/;
  let licenses = getLicenseInformationForCompilation(compilation, filter);
  licenses = overrideLicenses(licenses, override);
  return getSortedLicenseInformation(licenses);
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
    .map(
      (dep) =>
        `${dep.licenseName}${lineSeparator}(${dep.name} ${
          dep.version
        })${lineSeparator}${lineSeparator}${dep.licenseText.trim()}`
    )
    .join(separator);
  const content = `${header}${separator}${depsContent}${lineSeparator}`;
  await writeFile('LICENSE', content);
}

module.exports = bundleLicenses;
