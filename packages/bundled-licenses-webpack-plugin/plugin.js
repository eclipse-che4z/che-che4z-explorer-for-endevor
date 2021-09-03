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

const bundleLicenses = require('./deps');

const defaultOptions = {
  override: {},
  licenseTemplateFilePath: 'license-template.txt',
};

class BundledLicensesPlugin {
  // override option spec: https://github.com/microsoft/license-checker-webpack-plugin#options
  constructor(options = defaultOptions) {
    this.options = options;
  }
  apply(compiler) {
    compiler.hooks.emit.tapPromise(
      'BundledLicensesWebpackPlugin',
      async (compilation) => await bundleLicenses(compilation, this.options)
    );
  }
}

module.exports = BundledLicensesPlugin;
