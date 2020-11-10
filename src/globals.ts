import * as vscode from 'vscode';
import { OUTPUT_CHANNEL_NAME } from './constants';
import { make as makeLogger } from './logger';

/*
This is the only module that is allowed to execute code directly
in the module scope! All other modules should define and export functions.
*/
const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
export const logger = makeLogger(outputChannel);
