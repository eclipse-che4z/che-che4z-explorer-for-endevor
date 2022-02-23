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

module.exports = {
  testEnvironment: 'node', // make test faster

  // ts preprocessor
  testMatch: ['**/__tests__/**/*-test.ts'],
  preset: 'ts-jest',

  // coverage
  coverageDirectory: '<rootDir>/results/unit/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
