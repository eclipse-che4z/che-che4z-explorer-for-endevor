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

/* eslint-env node */
//@ts-check
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const BundledLicensesPlugin = require('@local/bundled-licenses-webpack-plugin');
const webpack = require('webpack');
const childProcess = require('child_process');
const process = require('process');

const distFolderPath = path.resolve(__dirname, 'dist');

var latestGitCommit = childProcess
  .execSync('git rev-parse HEAD')
  .toString()
  .trim();

// receive an api key from pipeline env variable for prod builds
var telemetryApiKey = process.env.E4E_TELEMETRY_KEY || '';

/**@type {import('webpack').Configuration}*/
const config = {
  mode: 'production',
  plugins: [
    new BundledLicensesPlugin({
      override: {
        '@broadcom/endevor-for-zowe-cli@6.4.0': {
          licenseName: 'Broadcom Internal',
        },
        'promise-pool-tool@1.3.3': {
          licenseText: `
Copyright (c) 4-digit year, Company or Person's Name

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.
          
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.`,
        },
      },
      licenseTemplateFilePath: path.resolve(__dirname, 'license-template.txt'),
    }),
    new webpack.DefinePlugin({
      // the plugin will insert the runtime value by pure text replacement, so we need 'surrounding'
      __E4E_BUILD_NUMBER__: `'${latestGitCommit}'`,
      __E4E_TELEMETRY_KEY__: `'${telemetryApiKey}'`,
    }),
  ],
  optimization: {
    minimize: true,
    usedExports: true,
  },
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: distFolderPath,
    filename: 'extension.bundle.js',
    libraryTarget: 'commonjs2',
  },
  devtool: 'false',
  externals: {
    // Add modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    keytar: 'commonjs keytar',
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
  },
  stats: {
    // Ignore warnings
    warnings: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
};

module.exports = config;
