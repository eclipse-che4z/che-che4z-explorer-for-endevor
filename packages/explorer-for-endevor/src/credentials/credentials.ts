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

import { Credential } from '@local/endevor/_doc/Credential';
import { askForCredentialWithDefaultPasswordPolicy } from '../dialogs/credentials/endevorCredentialDialogs';
import { Action, Actions } from '../_doc/Actions';

export const resolveCredential =
  (
    serviceName: string,
    getCredentialFromStore: (name: string) => Credential | undefined,
    dispatch: (action: Action) => void
  ) =>
  async (
    credentialFromProfile: Credential | undefined
  ): Promise<Credential | undefined> => {
    let credential: Credential | undefined =
      getCredentialFromStore(serviceName) ?? credentialFromProfile;
    if (!credential) {
      credential = await askForCredentialWithDefaultPasswordPolicy();
      if (credential) {
        dispatch({
          type: Actions.ENDEVOR_CREDENTIAL_ADDED,
          serviceName,
          credential,
        });
      }
    }
    return credential;
  };
