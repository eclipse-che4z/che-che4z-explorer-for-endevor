/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
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

import { IElementBasicData } from '@broadcom/endevor-for-zowe-cli';
import { ISession, Session } from '@zowe/imperative';
import { IEndevorQualifier } from './interface/IEndevorQualifier';
import { CredentialsInputBox } from './ui/tree/CredentialsInput';
import { QuickPickItem, QuickPick } from 'vscode';
import { logger } from './globals';
import { IEndevorElementNode } from './interface/IEndevorElementNode';
import { IRepository } from './interface/IRepository';

export async function resolveQuickPickHelper(
  quickpick: QuickPick<QuickPickItem>
): Promise<QuickPickItem | undefined> {
  return new Promise<QuickPickItem | undefined>((c) =>
    quickpick.onDidAccept(() => c(quickpick.activeItems[0]))
  );
}

export class FilterItem implements QuickPickItem {
  constructor(private text: string) {}
  get label(): string {
    return this.text;
  }
  get description(): string {
    return '';
  }
  get alwaysShow(): boolean {
    return false;
  }
}

export class FilterDescriptor implements QuickPickItem {
  constructor(private text: string) {}
  get label(): string {
    return this.text;
  }
  get description(): string {
    return '';
  }
  get alwaysShow(): boolean {
    return true;
  }
}

export function toArray<T>(data: any): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  } else if (data) {
    return [data] as T[];
  } else {
    return [];
  }
}

export function constructFilterName(uri: string): string {
  let name = '';
  const splitString = uri.split('/');
  splitString.forEach((member) => {
    if (
      !(
        member === 'env' ||
        member === 'stgnum' ||
        member === 'sys' ||
        member === 'subsys' ||
        member === 'type' ||
        member === 'ele'
      )
    ) {
      name = name + '/' + member;
    }
  });
  return name.replace('//', '/');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function constructFilterUri(uri: string): string {
  const uriFormatted = '';

  return uriFormatted;
}

export function prepareElementNodesForRetrieve(
  selection: any[]
): IEndevorElementNode[] {
  const selectedElementNodes: IEndevorElementNode[] = [];
  for (let i = 0; i < selection.length; i++) {
    if ('qualifier' in selection[i]) {
      selectedElementNodes.push(selection[i]);
    }
  }
  return selectedElementNodes;
}

export function multipleElementsSelected(selection: any[]): boolean {
  if (selection.length > 1) {
    return true;
  } else {
    return false;
  }
}
function getBasePathFromRepo(repository: IRepository): string {
  return (
    repository.getUrlString().split(':')[2].split('/')[1] +
    '/' +
    repository.getUrlString().split(':')[2].split('/')[2]
  );
}

export async function buildSession(repository: IRepository): Promise<Session> {
  // hacky solution to make ISession happy
  logger.trace('Building the session.');
  type PROTOCOL = 'http' | 'https';
  let protocol = 'https' as PROTOCOL;
  let hostname = '';
  let port = 443;
  const repoUrl = repository.getUrl();
  if (repoUrl) {
    protocol = repoUrl.split(':')[0] as PROTOCOL;
    hostname = repoUrl.split(':')[1].split('/')[2];
    port = Number(repoUrl.split(':')[2]);
  }
  const basePath = getBasePathFromRepo(repository);
  if (!repository.getPassword()) {
    logger.trace('Password not received. Prompting.');
    const creds = await CredentialsInputBox.askforCredentials(repository);
    if (!creds) {
      logger.trace('Password not provided. Cancelling.');
      throw { cancelled: true };
    }
  }
  const sessionDetails: ISession = {
    base64EncodedAuth: Buffer.from(
      repository.getUsername() + ':' + repository.getPassword()
    ).toString('base64'),
    basePath,
    hostname,
    port,
    protocol,
    rejectUnauthorized: false,
    type: 'basic',
  };
  const session = new Session(sessionDetails);
  logger.trace(`Session created. ${JSON.stringify(session)}`);
  return session;
}

export function endevorQualifierToElement(
  endevorQualifier: IEndevorQualifier,
  instance: string
): IElementBasicData {
  return {
    element: endevorQualifier.element ? endevorQualifier.element : '*',
    environment: endevorQualifier.env ? endevorQualifier.env : '*',
    instance,
    stageNumber: endevorQualifier.stage ? endevorQualifier.stage : '*',
    subsystem: endevorQualifier.subsystem ? endevorQualifier.subsystem : '*',
    system: endevorQualifier.system ? endevorQualifier.system : '*',
    type: endevorQualifier.type ? endevorQualifier.type : '*',
  };
}
