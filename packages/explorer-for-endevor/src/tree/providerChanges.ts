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

import { setContextVariable } from '@local/vscode-wrapper/window';
import {
  DecorationInstanceRenderOptions,
  DecorationOptions,
  EventEmitter,
  Position,
  ProviderResult,
  Range,
  TextEditor,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  window,
} from 'vscode';
import { CommandId } from '../commands/id';
import { CURRENT_CHANGE_LEVEL, ELM_HISTORY_VIEW_ID } from '../constants';
import { logger } from '../globals';
import { getElement } from '../store/store';
import { Action } from '../store/_doc/Actions';
import { ElementHistoryData, State } from '../store/_doc/v2/Store';
import { fromElementChangeUri } from '../uri/elementHistoryUri';
import { getElementParmsFromUri } from '../uri/utils';
import { isError } from '../utils';
import {
  getHistoryContent,
  updateHistoryData,
} from '../view/changeLvlContentProvider';
import { BasicElementUriQuery } from '../_doc/Uri';
import { ChangeLevelNode } from './_doc/ChangesTree';

export const Decorations = {
  typeAdded: window.createTextEditorDecorationType({
    backgroundColor: 'rgba(72, 126, 2, 0.4)',
    after: {
      margin: '0 0 0 3em',
      textDecoration: 'none',
    },
    overviewRulerColor: 'rgba(72, 126, 2, 0.4)',
  }),
  typeRemoved: window.createTextEditorDecorationType({
    backgroundColor: 'rgba(241, 76, 76, 0.4)',
    after: {
      margin: '0 0 0 3em',
      textDecoration: 'none',
    },
    overviewRulerColor: 'rgba(241, 76, 76, 0.4)',
  }),
  blame: window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 3em',
      textDecoration: 'none',
    },
  }),
};

export const enum HistoryViewModes {
  SHOW_IN_EDITOR = 'SHOW_IN_EDITOR',
  ONLY_SHOW_CHANGES = 'ONLY_SHOW_CHANGES',
  CLEAR_AND_SHOW = 'CLEAR_NODES/SHOW_IN_EDITOR',
  DEFAULT = 'DEFAULT',
}

export type HistoryViewDataProvider = TreeDataProvider<ChangeLevelNode> &
  Partial<{
    elementUri: Uri;
    treeView: TreeView<ChangeLevelNode>;
    mode: HistoryViewModes;
  }>;

export const make =
  (getState: () => State) =>
  (dispatch: (action: Action) => Promise<void>) =>
  (
    treeChangeEmitter: EventEmitter<ChangeLevelNode | null>
  ): HistoryViewDataProvider => {
    return {
      onDidChangeTreeData: treeChangeEmitter.event,
      getTreeItem(node: ChangeLevelNode) {
        return new ChangeLevelItem(node);
      },
      async getChildren(node?: ChangeLevelNode) {
        if (node || !this.treeView) {
          return [];
        }
        if (this.mode === HistoryViewModes.CLEAR_AND_SHOW) {
          this.mode = HistoryViewModes.SHOW_IN_EDITOR;
          treeChangeEmitter.fire(null);
          return [];
        }
        if (!this.elementUri) {
          return noHistory(
            this.treeView,
            'There are no element tabs/editors activated to provide element history information.'
          );
        }
        const uriParams = getElementParmsFromUri(this.elementUri);
        if (isError(uriParams)) {
          // do not show anything since this basically just means
          // the active editor does not contain any element text
          return noHistory(
            this.treeView,
            'History information cannot be provided for the active editor.'
          );
        }
        const { serviceId, searchLocationId, element } = uriParams;
        this.treeView.description = `${element.name} • ${element.type} type`;
        if (this.mode === HistoryViewModes.SHOW_IN_EDITOR) {
          try {
            this.treeView.message = undefined;
            const historyEditor = await window.showTextDocument(
              this.elementUri,
              { preview: true }
            );
            decorate(getState, historyEditor, this.elementUri);
          } catch (error) {
            return error;
          }
        }
        let historyData;
        if (this.mode === HistoryViewModes.ONLY_SHOW_CHANGES) {
          historyData = await refreshHistoryData(
            dispatch,
            this.treeView,
            uriParams,
            this.elementUri
          );
        } else {
          historyData =
            getElement(getState)(serviceId)(searchLocationId)(
              element
            )?.historyData;
          if (!historyData || !historyData.changeLevels) {
            if (!this.mode || this.mode === HistoryViewModes.DEFAULT) {
              return noHistory(this.treeView, 'Press ↻ to retrieve.', true);
            }
            historyData = await refreshHistoryData(
              dispatch,
              this.treeView,
              uriParams,
              this.elementUri
            );
          }
        }
        if (!historyData || !historyData.changeLevels) {
          return noHistory(
            this.treeView,
            'Error occurred during the attempt to retrieve History information, press ↻ to try again.',
            true
          );
        }
        setContextVariable(`${ELM_HISTORY_VIEW_ID}.showRefresh`, true);
        this.treeView.message = undefined;
        return [...historyData.changeLevels].reverse();
      },
    };
  };

const refreshHistoryData = async (
  dispatch: (action: Action) => Promise<void>,
  treeView: TreeView<ChangeLevelNode>,
  uriParams: BasicElementUriQuery,
  uri: Uri
): Promise<ElementHistoryData | undefined> => {
  const historyContent = await getHistoryContent(uri);
  if (isError(historyContent)) {
    return;
  }
  treeView.message = 'Retrieving History data ...';
  return await updateHistoryData(
    dispatch,
    uriParams.serviceId,
    uriParams.element,
    uriParams.searchLocationId,
    uri,
    historyContent
  );
};

const noHistory = (
  treeView: TreeView<ChangeLevelNode>,
  message: string,
  canRefresh?: boolean
): ProviderResult<[]> => {
  setContextVariable(`${ELM_HISTORY_VIEW_ID}.showRefresh`, !!canRefresh);
  if (!canRefresh) {
    treeView.description = undefined;
  }
  treeView.message = message;
  return [];
};

export const decorate = (
  getState: () => State,
  editor: TextEditor,
  uri: Uri
) => {
  const decorationsArrayAdded: DecorationOptions[] = [];
  const decorationsArrayRemoved: DecorationOptions[] = [];
  const otherDecorations: DecorationOptions[] = [];
  const uriParams = fromElementChangeUri(uri);
  if (isError(uriParams)) {
    const error = uriParams;
    logger.error(
      `Unable to decorate.`,
      `Unable to decorate because parsing of the element's URI failed with error ${error.message}.`
    );
    return;
  }
  const { serviceId, searchLocationId, element, vvll } = uriParams;
  const historyData =
    getElement(getState)(serviceId)(searchLocationId)(element)?.historyData;
  if (!historyData || !historyData.changeLevels || !historyData.historyLines) {
    return;
  }
  const changeToDecorate =
    !vvll || vvll === CURRENT_CHANGE_LEVEL
      ? historyData.changeLevels[historyData.changeLevels.length - 1]
      : historyData.changeLevels.find(
          (changeLevel) => changeLevel.vvll === vvll
        );
  const changeLines = changeToDecorate?.lineNums;
  const vvllToDecorate = changeToDecorate?.vvll;

  if (!changeLines || !vvllToDecorate) {
    return;
  }
  const getBaseLevel = (): ChangeLevelNode | undefined => {
    return historyData.changeLevels ? historyData.changeLevels[0] : undefined;
  };
  let lineIndex = 0;
  changeLines.forEach((changeLine) => {
    const range = new Range(
      new Position(lineIndex, 0),
      new Position(lineIndex, changeLine.lineLength || 0)
    );

    if (changeLine.removedVersion === vvllToDecorate) {
      const blameChangeLevel = historyData.changeLevels?.find(
        (changeLevel) => changeLevel.vvll === vvllToDecorate
      );
      decorationsArrayRemoved.push({
        range,
        renderOptions: createBlameDecoration(vvllToDecorate, blameChangeLevel),
      });
    } else if (
      getBaseLevel()?.vvll !== vvllToDecorate &&
      changeLine.addedVersion === vvllToDecorate
    ) {
      const blameChangeLevel = historyData.changeLevels?.find(
        (changeLevel) => changeLevel.vvll === vvllToDecorate
      );
      decorationsArrayAdded.push({
        range,
        renderOptions: createBlameDecoration(vvllToDecorate, blameChangeLevel),
      });
    } else {
      const blameChangeLevel = historyData.changeLevels?.find(
        (changeLevel) => changeLevel.vvll === changeLine.addedVersion
      );
      otherDecorations.push({
        range,
        renderOptions: createBlameDecoration(
          changeLine.addedVersion,
          blameChangeLevel
        ),
      });
    }
    lineIndex++;
  });
  editor.setDecorations(Decorations.typeAdded, decorationsArrayAdded);
  editor.setDecorations(Decorations.typeRemoved, decorationsArrayRemoved);
  editor.setDecorations(Decorations.blame, otherDecorations);
};

const createBlameDecoration = (
  vvll: string,
  blameChangeLevel?: ChangeLevelNode
): DecorationInstanceRenderOptions => {
  const blame = {
    after: {
      color: '#99999959',
      contentText: '',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
  };
  blame.after.contentText =
    vvll +
    ' | ' +
    blameChangeLevel?.user?.trim() +
    ', ' +
    blameChangeLevel?.date +
    '-' +
    blameChangeLevel?.time +
    (blameChangeLevel?.ccid && blameChangeLevel.ccid.trim() !== ''
      ? ' → ' +
        blameChangeLevel.ccid.trim() +
        ' | ' +
        blameChangeLevel.comment?.trim()
      : '');
  return blame;
};

class ChangeLevelItem extends TreeItem {
  constructor(node: ChangeLevelNode) {
    super(node.vvll, TreeItemCollapsibleState.None);
    this.description =
      node.user?.trim() +
      ', ' +
      node.date +
      '-' +
      node.time +
      (node.ccid && node.ccid.trim() !== ''
        ? ' → ' + node.ccid.trim() + ' | ' + node.comment?.trim()
        : '');
    this.command = {
      title: 'Show Changes',
      command: CommandId.CHANGE_HISTORY_LEVEL,
      tooltip: 'Show Changes',
      arguments: [node],
    };
  }
}
