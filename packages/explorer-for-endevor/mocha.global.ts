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

// https://stackoverflow.com/questions/50952917/nodejs-mocha-unit-testing-with-global-injected-variables-from-webpack-defineplug
globalThis.__E4E_BUILD_NUMBER__ = 'test-build';
globalThis.__E4E_TELEMETRY_KEY__ = '';
