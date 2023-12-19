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
import { Logger } from '@local/extension/_doc/Logger';
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
  commands,
  window,
} from 'vscode';
import { CURRENT_CHANGE_LEVEL } from '../constants';
import { updateHistoryData } from '../view/changeLvlContentProvider';
import {
  ChangeLevelNode,
  HistoryViewModes,
  ElementHistoryData,
} from './_doc/ChangesTree';
import {
  Element,
  EndevorResponse,
  ErrorResponseType,
  Service,
} from '@local/endevor/_doc/Endevor';
import { getHistoryContent } from '../endevor';
import {
  fromElementChangeUri,
  toElementChangeUri,
} from '../uri/elementHistoryUri';
import { getPreviousVersionLevel, isError } from '../utils';
import { UriFunctions } from '../_doc/Uri';

export const BlameDecoration = window.createTextEditorDecorationType({
  after: {
    margin: '0 0 0 3em',
    textDecoration: 'none',
  },
});

export type HistoryViewDataProvider = TreeDataProvider<ChangeLevelNode> &
  Partial<{
    elementUri: Uri;
    treeView: TreeView<ChangeLevelNode>;
    mode: HistoryViewModes;
  }>;

export const make =
  (treeChangeEmitter: EventEmitter<ChangeLevelNode | null>) =>
  (logger: Logger) =>
  (
    { getConfigurations, getHistoryData, logActivity }: UriFunctions,
    refreshHistory: (
      elementHistory: ElementHistoryData,
      elementUri: Uri
    ) => Promise<void>
  ) =>
  (
    commandId: string,
    uriScheme: string,
    treeViewId: string
  ): HistoryViewDataProvider => {
    return {
      onDidChangeTreeData: treeChangeEmitter.event,
      getTreeItem(node: ChangeLevelNode) {
        return new ChangeLevelItem(node, commandId);
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
            'There are no element tabs/editors activated to provide element history information.',
            treeViewId
          );
        }
        const configurations = await getConfigurations(this.elementUri);
        if (!configurations) {
          return noHistory(
            this.treeView,
            'History information cannot be provided for the active editor.',
            treeViewId
          );
        }
        const { element, service, configuration: instance } = configurations;
        this.treeView.description = `${element.name} • ${element.type} type`;
        const logActivityFromUri = logActivity
          ? logActivity(this.elementUri)
          : undefined;
        let historyData: ElementHistoryData | undefined;
        if (this.mode === HistoryViewModes.ONLY_SHOW_CHANGES) {
          historyData = await refreshHistoryData(
            refreshHistory,
            this.treeView,
            service,
            element,
            instance,
            logger,
            this.elementUri,
            logActivityFromUri
          );
        } else {
          historyData = getHistoryData(this.elementUri);
          if (!historyData || !historyData.changeLevels) {
            if (!this.mode || this.mode === HistoryViewModes.DEFAULT) {
              return noHistory(
                this.treeView,
                'Press ↻ to retrieve.',
                treeViewId,
                true
              );
            }
            historyData = await refreshHistoryData(
              refreshHistory,
              this.treeView,
              service,
              element,
              instance,
              logger,
              this.elementUri,
              logActivityFromUri
            );
          }
        }
        if (this.mode === HistoryViewModes.SHOW_IN_EDITOR) {
          const changedElementQuery = fromElementChangeUri(this.elementUri)(
            uriScheme
          );
          if (isError(changedElementQuery)) {
            return noHistory(
              this.treeView,
              'There are no element tabs/editors activated to provide element history information.',
              treeViewId
            );
          }
          try {
            this.treeView.message = undefined;
            const previousVvll = getPreviousVersionLevel(
              historyData,
              changedElementQuery.vvll
            );
            if (previousVvll) {
              const changeLvlUri = toElementChangeUri({
                ...changedElementQuery,
                vvll: previousVvll,
              })(uriScheme)(Date.now().toString());
              if (isError(changeLvlUri)) {
                const error = changeLvlUri;
                logger.error(
                  `Unable to show change level ${previousVvll}.`,
                  `Unable to show change level ${previousVvll} because parsing of the element's URI failed with error ${error.message}.`
                );
                return;
              }
              await commands.executeCommand(
                'vscode.diff',
                changeLvlUri,
                this.elementUri
              );
            } else {
              await window.showTextDocument(this.elementUri, { preview: true });
            }
          } catch (error) {
            logger.trace('Unable to show element history document');
          }
        }
        if (!historyData || !historyData.changeLevels) {
          return noHistory(
            this.treeView,
            'Error occurred during the attempt to retrieve History information, press ↻ to try again.',
            treeViewId,
            true
          );
        }
        setContextVariable(`${treeViewId}.showRefresh`, true);
        this.treeView.message = undefined;
        return [...historyData.changeLevels].reverse();
      },
    };
  };

const refreshHistoryData = async (
  refreshHistoryData: (
    elementHistory: ElementHistoryData,
    elementUri: Uri
  ) => Promise<void>,
  treeView: TreeView<ChangeLevelNode>,
  service: Service,
  element: Element,
  configuration: string,
  logger: Logger,
  uri: Uri,
  logActivity?: (
    actionName: string
  ) => <E extends ErrorResponseType | undefined, R>(
    response: EndevorResponse<E, R>
  ) => void
): Promise<ElementHistoryData | undefined> => {
  const historyContent = await getHistoryContent(
    logger,
    service,
    configuration,
    element,
    logActivity
  );
  if (!historyContent) {
    return;
  }
  treeView.message = 'Retrieving History data ...';
  return await updateHistoryData(
    refreshHistoryData,
    element,
    logger,
    uri,
    historyContent
  );
};

const noHistory = (
  treeView: TreeView<ChangeLevelNode>,
  message: string,
  treeViewId: string,
  canRefresh?: boolean
): ProviderResult<[]> => {
  setContextVariable(`${treeViewId}.showRefresh`, !!canRefresh);
  if (!canRefresh) {
    treeView.description = undefined;
  }
  treeView.message = message;
  return [];
};

export const decorate = (
  getHistoryData: (elementUri: Uri) => ElementHistoryData | undefined,
  editor: TextEditor,
  elementUri: Uri,
  vvll: string
) => {
  const blameDecorations: DecorationOptions[] = [];
  const historyData = getHistoryData(elementUri);
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

  if (!changeLines) {
    return;
  }
  let lineIndex = 0;
  changeLines.forEach((changeLine) => {
    const range = new Range(
      new Position(lineIndex, 0),
      new Position(lineIndex, changeLine.lineLength || 0)
    );
    const blameChangeLevel = historyData.changeLevels?.find(
      (changeLevel) => changeLevel.vvll === changeLine.addedVersion
    );
    blameDecorations.push({
      range,
      renderOptions: createBlameDecoration(
        changeLine.addedVersion,
        blameChangeLevel
      ),
    });

    lineIndex++;
  });
  editor.setDecorations(BlameDecoration, blameDecorations);
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
  constructor(node: ChangeLevelNode, commandId: string) {
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
      command: commandId,
      tooltip: 'Show Changes',
      arguments: [node],
    };
  }
}
