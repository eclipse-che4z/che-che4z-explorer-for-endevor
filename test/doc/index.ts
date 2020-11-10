import * as vscode from 'vscode';
import { extensionId } from './constants';
import { IExtension } from './interfaces';

export * from './constants';
export * from './interfaces';

export function getExtension(): vscode.Extension<IExtension> {
    const ext = vscode.extensions.getExtension<IExtension>(extensionId);
    if (!ext) {
        throw new Error('Extension was not found.');
    }
    return ext;
}
