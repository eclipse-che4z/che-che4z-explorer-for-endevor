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

import { FINGERPRINT_MISMATCH_ERROR } from '../const';

export function getTypedErrorFromEndevorError(endevorMessage: string): Error {
  switch (true) {
    case endevorMessage.includes(FINGERPRINT_MISMATCH_ERROR):
      return new FingerprintMismatchError();
    default:
      return new Error(endevorMessage);
  }
}

export class FingerprintMismatchError extends Error {
  constructor() {
    super(`Fingerprint provided does not match record in Endevor.`);
  }
}

export class UpdateError extends Error {
  causeError: Error | undefined;
  constructor(elementName: string, causeError?: Error) {
    super(`Unable to update element ${elementName}. ${causeError?.message}`);
    this.causeError = causeError;
  }
}
