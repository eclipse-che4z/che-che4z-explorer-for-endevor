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

import { getAllOpenedTextEditors } from '@local/vscode-wrapper/window';
import { SectionChange } from '@local/vscode-wrapper/_doc/workspace';
import * as vscode from 'vscode';
import { reporter } from '../../globals';
import { toCachedElementUri } from '../../uri/cachedElementUri';
import { TelemetryEvents } from '../../_doc/telemetry/v2/Telemetry';

export const revertSectionChangeCommand = async (
  elementUri: vscode.Uri,
  changesList: SectionChange[],
  changeIndex: number
) => {
  reporter.sendTelemetryEvent({
    type: TelemetryEvents.COMMAND_REVERT_SECTION_CHANGE_CALLED,
  });
  const [changedElementEditor] = getAllOpenedTextEditors().filter(
    (editor) => editor.document.uri.fsPath === elementUri.fsPath
  );
  if (!changedElementEditor) {
    return;
  }
  const allChangesPrecedingTarget = changesList.slice(0, changeIndex);
  const allChangesFollowingTarget = changesList.slice(changeIndex + 1);
  await revertChangesList(
    changedElementEditor,
    [...allChangesPrecedingTarget, ...allChangesFollowingTarget],
    toCachedElementUri(elementUri)
  );
};

const revertChangesList = async (
  textEditor: vscode.TextEditor,
  changesList: SectionChange[],
  originalElementUri: vscode.Uri
): Promise<void> => {
  const modifiedElement = textEditor.document;
  let originalElement;
  try {
    originalElement = await vscode.workspace.openTextDocument(
      originalElementUri
    );
  } catch (e) {
    return;
  }
  const result = applyChangesList(
    originalElement,
    modifiedElement,
    changesList
  );
  const finalLineOfDocumentPostChange = modifiedElement.lineAt(
    modifiedElement.lineCount - 1
  ).range.end;
  textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
    return editBuilder.replace(
      new vscode.Range(
        new vscode.Position(0, 0),
        finalLineOfDocumentPostChange
      ),
      result
    );
  });
};

const applyChangesList = (
  originalElement: vscode.TextDocument,
  modifiedElement: vscode.TextDocument,
  differencesList: SectionChange[]
): string => {
  const result: string[] = [];
  let currentLine = 0;
  const originalElementLines = originalElement.lineCount;

  for (const difference of differencesList) {
    const insertion = difference.originalEndLineNumber === 0;
    const deletion = difference.modifiedEndLineNumber === 0;

    let endLine = insertion
      ? difference.originalStartLineNumber
      : difference.originalStartLineNumber - 1;
    let endCharacter = 0;

    if (deletion && difference.originalEndLineNumber === originalElementLines) {
      endLine -= 1;
      endCharacter = originalElement.lineAt(endLine).range.end.character;
    }

    result.push(
      originalElement.getText(
        new vscode.Range(currentLine, 0, endLine, endCharacter)
      )
    );

    if (!deletion) {
      let fromLine = difference.modifiedStartLineNumber - 1;
      let fromCharacter = 0;

      if (
        insertion &&
        difference.originalStartLineNumber === originalElementLines
      ) {
        fromLine -= 1;
        fromCharacter = modifiedElement.lineAt(fromLine).range.end.character;
      }

      result.push(
        modifiedElement.getText(
          new vscode.Range(
            fromLine,
            fromCharacter,
            difference.modifiedEndLineNumber,
            0
          )
        )
      );
    }

    currentLine = insertion
      ? difference.originalStartLineNumber
      : difference.originalEndLineNumber;
  }

  result.push(
    originalElement.getText(
      new vscode.Range(currentLine, 0, originalElement.lineCount, 0)
    )
  );

  return result.join('');
};
