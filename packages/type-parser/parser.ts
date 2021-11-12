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

import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter';
import { fold } from 'fp-ts/lib/Either';

/**
 * Verifies that `input` is a valid `type`
 * @param type
 * @param input
 */
export const parseToType = <T, O, I>(type: t.Type<T, O, I>, input: I): T => {
  const result = type.decode(input);
  return fold<t.Errors, T, T>(
    (_errors) => {
      // validation failed, tell the user why `input` does not match `type`
      const messages = PathReporter.report(result);
      throw new Error(messages.join('\n'));
    },
    (value) => value
  )(result);
};
