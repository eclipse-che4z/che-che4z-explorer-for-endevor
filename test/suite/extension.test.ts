/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import * as assert from 'assert';

import * as vscode from 'vscode';
import { getExtension, timeout, ICommand, extensionShortName } from '../doc';

suite('Basic Extension Test Suite (integration)', () => {
    let extension: vscode.Extension<any>;

    suiteSetup(() => {
        extension = getExtension() as vscode.Extension<any>;
        extension.activate();
    });

    test('Extension loads in VSCode and is active', async () => {
        await timeout(3000);
        assert.strictEqual(extension.isActive, true);
    });

    test('package.json commands registered in extension', (done) => {
        const commandStrings: string[] = extension.packageJSON.contributes.commands.map(
            (c: ICommand) => c.command
        );

        vscode.commands.getCommands(true).then((allCommands: string[]) => {
            const commands = allCommands.filter((c) =>
                c.startsWith(`${extensionShortName}.`)
            );
            commands.forEach((command) => {
                const result = commandStrings.some((c) => c === command);
                assert.ok(result);
            });
            done();
        });
    });
});
