/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

import * as vscode from 'vscode';
import { logger } from '../globals';
import { Element } from '../model/Element';
import { IEndevorQualifier } from '../interface/IEndevorQualifier';
import { Repository } from '../model/Repository';
import { RetrieveElementService } from '../service/RetrieveElementService';
import { IElement } from '../interface/IElement';

const RETRIEVE_ELEMENTS_LIMIT = 20;

export async function retrieveWithDependencies(
  arg: any,
  retrieveElementService: RetrieveElementService
) {
  await vscode.window.withProgress(
    {
      cancellable: true,
      location: vscode.ProgressLocation.Notification,
      title: 'Retrieving',
    },
    async (progress, token) => {
      if (token) {
        token.onCancellationRequested(() => {
          logger.info('Retrieve Cancelled.');
        });
      }
      if (
        !(
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0
        )
      ) {
        logger.error('Specify workspace before retrieving elements');
        return;
      }
      const workspace: vscode.WorkspaceFolder =
        vscode.workspace.workspaceFolders[0];
      const repo: Repository = arg.getRepository();
      const eq: IEndevorQualifier = arg.getQualifier();

      progress.report({ increment: 0, message: 'Dependencies List' });
      const elementsToRetrieve: Element[] = await retrieveElementService.retrieveDependenciesList(
        repo,
        eq
      );
      if (await hitLimit(elementsToRetrieve, eq)) {
        return;
      }
      if (elementsToRetrieve.length === 0) {
        elementsToRetrieve.push(createElementFromQualifier(repo, eq));
      }
      const incrementNumber = 100 / (elementsToRetrieve.length + 1);
      // retrieve dependencies
      let firstOpened = false;
      for (let i = 0; i < elementsToRetrieve.length; i++) {
        if (token && token.isCancellationRequested) {
          return;
        }
        const elName: string = elementsToRetrieve[i].elmName;
        try {
          progress.report({
            message:
              '(' + (i + 1) + '/' + elementsToRetrieve.length + ') ' + elName,
          });
          const eQualifier = createElementQualifier(elementsToRetrieve[i]);
          const filePath: string = await retrieveElementService.retrieveElement(
            workspace,
            repo,
            elName,
            eQualifier
          );
          if (!firstOpened) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            vscode.window.showTextDocument(doc, { preview: false });
          }
        } catch (error) {
          retrieveElementService.processRetrieveElementError(error);
        } finally {
          // If first with error, don't open anything
          firstOpened = true;
          progress.report({
            increment: incrementNumber,
            message:
              '(' + (i + 1) + '/' + elementsToRetrieve.length + ') ' + elName,
          });
        }
      }
    }
  );
}

/**
 * Only to be used in the scope of this module.
 * Creates the Element Qualifier for the dependencies.
 * @param element
 */
function createElementQualifier(element: Element): IEndevorQualifier {
  const eQualifier: IEndevorQualifier = {
    element: element.elmName,
    env: element.envName,
    stage: element.stgNum,
    subsystem: element.sbsName,
    system: element.sysName,
    type: element.typeName,
  };
  return eQualifier;
}

/**
 * Only to be used in the scope of this module.
 * Creates an element based on repository and element qualifier.
 * @param repo
 * @param eq
 */
function createElementFromQualifier(
  repo: Repository,
  eq: IEndevorQualifier
): Element {
  const iElement: IElement = {
    elmName: eq.element!,
    envName: eq.env!,
    sysName: eq.system!,
    sbsName: eq.subsystem!,
    stgNum: eq.stage!,
    typeName: eq.type!,
    fullElmName: eq.element!,
    elmVVLL: '',
  };
  return new Element(repo, iElement);
}

async function hitLimit(
  elementsToRetrieve: Element[],
  eq: IEndevorQualifier
): Promise<boolean> {
  if (elementsToRetrieve.length <= RETRIEVE_ELEMENTS_LIMIT) {
    return false;
  }
  const msg = `Element ${eq.element} has ${elementsToRetrieve.length} dependencies.`;
  return (
    (await vscode.window.showWarningMessage(msg, 'Download all', 'Cancel')) ===
    'Cancel'
  );
}
