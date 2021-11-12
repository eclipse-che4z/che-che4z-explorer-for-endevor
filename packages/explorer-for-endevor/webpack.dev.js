/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

const distFolderPath = path.resolve(__dirname, 'dist');

/**@type {import('webpack').Configuration}*/
const config = {
  mode: 'development',
  optimization: {
    minimize: false,
    usedExports: true,
  },
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder, 📖 -> https://webpack.js.org/configuration/output/
    path: distFolderPath,
    filename: 'extension.bundle.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: (info) => {
      const source = info.absoluteResourcePath;
      if (source.startsWith('/')) {
        return path.relative(distFolderPath, source);
      }
      if (source.startsWith('webpack/')) {
        return 'webpack: ' + source.slice(8);
      }
      if (source.startsWith('external ')) {
        return 'external: ' + source.slice(9);
      }
      return source;
    },
  },
  devtool: 'source-map',
  externals: {
    // Add modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    keytar: 'commonjs keytar',
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
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
