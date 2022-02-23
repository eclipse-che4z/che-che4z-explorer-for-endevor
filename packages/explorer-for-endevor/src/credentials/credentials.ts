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

import { Credential } from '@local/endevor/_doc/Credential';
import { askForCredentialWithDefaultPasswordPolicy } from '../dialogs/credentials/endevorCredentialDialogs';
import { logger, reporter } from '../globals';
import { Action, Actions } from '../_doc/Actions';
import { TelemetryEvents } from '../_doc/Telemetry';

export const resolveCredential =
  (
    serviceName: string,
    getCredentialFromStore: (name: string) => Credential | undefined,
    dispatch: (action: Action) => Promise<void>
  ) =>
  async (
    credentialFromProfile: Credential | undefined
  ): Promise<Credential | undefined> => {
    let credential: Credential | undefined =
      getCredentialFromStore(serviceName) ?? credentialFromProfile;
    if (!credential) {
      logger.warn(
        `No saved Endevor credentials found for the service: ${serviceName}, please, provide them in the dialog, they will be saved in the current session only.`
      );
      reporter.sendTelemetryEvent({
        type: TelemetryEvents.MISSING_CREDENTIALS_PROMPT_CALLED,
      });
      credential = await askForCredentialWithDefaultPasswordPolicy();
      if (credential) {
        await dispatch({
          type: Actions.ENDEVOR_CREDENTIAL_ADDED,
          serviceName,
          credential,
        });
        reporter.sendTelemetryEvent({
          type: TelemetryEvents.MISSING_CREDENTIALS_PROVIDED,
        });
      }
    }
    return credential;
  };
