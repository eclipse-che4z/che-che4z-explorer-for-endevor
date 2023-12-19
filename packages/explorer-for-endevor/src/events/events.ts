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

import * as vscode from 'vscode';
import path = require('path');
import { Schemas } from '../uri/_doc/Uri';
import { fromElementChangeUri } from '@local/views/uri/elementHistoryUri';
import { isError } from '../utils';
import { logger } from '../globals';
import { findEditor } from '@local/vscode-wrapper/window';
import { decorate } from '@local/views/tree/providerChanges';
import { ElementHistoryData } from '@local/views/tree/_doc/ChangesTree';

export const subscribeToActiveEditorChangedEvent = (
  getElementHistoryFromUri: (uri: vscode.Uri) => ElementHistoryData | undefined,
  refreshElementHistoryTree: (uri?: vscode.Uri) => void
) => {
  return vscode.window.onDidChangeActiveTextEditor((editor) => {
    onActiveEditorChanged(
      getElementHistoryFromUri,
      refreshElementHistoryTree
    )(editor);
  });
};

const onActiveEditorChanged =
  (
    getElementHistoryFromUri: (
      uri: vscode.Uri
    ) => ElementHistoryData | undefined,
    refreshElementHistoryTree: (uri?: vscode.Uri) => void
  ) =>
  async (editor: vscode.TextEditor | undefined): Promise<void> => {
    let activeEditor = editor;
    if (!activeEditor) {
      // First this event is triggered when changing editors, `editor` is usually undefined.
      // Therefore we will wait a second and then get an active editor. This is to prevent
      // blinking of the message in the Element History
      await new Promise((f) => setTimeout(f, 1000));
      activeEditor = vscode.window.activeTextEditor;
    }
    const editorUri = activeEditor?.document.uri;
    refreshElementHistoryTree(editorUri);
    if (
      !activeEditor ||
      !editorUri ||
      editorUri.scheme !== Schemas.ELEMENT_CHANGE_LVL
    ) {
      return;
    }
    const editorElementQuery = fromElementChangeUri(editorUri)(
      editorUri.scheme
    );
    if (isError(editorElementQuery)) {
      const error = editorElementQuery;
      const elementName = path.basename(editorUri.fsPath);
      logger.error(
        `Unable to show history for element ${elementName}`,
        `Unable to show history for element ${elementName} because of ${error.message}.`
      );
      return;
    }
    decorate(
      getElementHistoryFromUri,
      activeEditor,
      editorUri,
      editorElementQuery.vvll
    );
    // The active editor for ELEMENT_CHANGE_LVL uri is a right side editor of the diff tab, so once we
    // decorate it, we still have to find the left editor of the diff tab. To do this, we have to
    // go through all tab groups to find a diff tab that has the uri we got from the active editor
    // as one of inputs.
    let otherUriInDiffTab: vscode.Uri | undefined;
    vscode.window.tabGroups.all.forEach((tabGroup) => {
      tabGroup.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputTextDiff) {
          otherUriInDiffTab =
            tab.input.modified?.toString() === editorUri?.toString()
              ? tab.input.original
              : tab.input.modified;
        }
      });
    });
    // Once we find the diff tab, we can use the other uri from it (other than the one from active editor)
    // to find its editor. That will be the left side editor which can be then decorated too.
    if (otherUriInDiffTab?.scheme === Schemas.ELEMENT_CHANGE_LVL) {
      const otherElementQuery = fromElementChangeUri(otherUriInDiffTab)(
        otherUriInDiffTab.scheme
      );
      if (isError(otherElementQuery)) {
        const error = otherElementQuery;
        const elementName = path.basename(otherUriInDiffTab.fsPath);
        logger.error(
          `Unable to show history for element ${elementName}`,
          `Unable to show history for element ${elementName} because of ${error.message}.`
        );
        return;
      }
      const otherEditor = findEditor(otherUriInDiffTab);
      if (otherEditor) {
        decorate(
          getElementHistoryFromUri,
          otherEditor,
          otherUriInDiffTab,
          otherElementQuery.vvll
        );
      }
    }
  };
