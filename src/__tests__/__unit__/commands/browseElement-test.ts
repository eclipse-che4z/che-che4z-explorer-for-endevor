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

import * as vscode from "vscode";

import { PrintElementComponents } from "@broadcom/endevor-for-zowe-cli";
import { browseElement } from "../../../commands/BrowseElement";
import { logger } from "../../../globals";
import { Element } from "../../../model/Element";
import { EndevorQualifier } from "../../../model/IEndevorQualifier";
import { Repository } from "../../../model/Repository";
import { EndevorElementNode } from "../../../ui/tree/EndevorNodes";

jest.mock("vscode");

describe("Test function browseElement", () => {
    // Mock vscode's progress function
    const mockWithProgress = jest.fn();
    Object.defineProperty(vscode, "ProgressLocation", { value: { Notification: 15 } });
    Object.defineProperty(vscode.window, "withProgress", { value: mockWithProgress });

    // Mock the elements, nodes, and repo
    const mockSetupPrintRequest = jest.fn();
    const mockPrintElementComponents = jest.fn();
    Object.defineProperty(PrintElementComponents, "setupPrintRequest", { value: mockSetupPrintRequest });
    Object.defineProperty(PrintElementComponents, "printElementComponents", { value: mockPrintElementComponents });
    const testRepo = new Repository("testRepo", "https://example.com:1234", "testUser", "testPass", "testRepo", "testConnLabel");
    const testIElement = {
        elmName: "elmTest1", fullElmName: "elmTest1", elmVVLL: "1100", envName: "envTest",
        sysName: "sysTest", sbsName: "sbsTest", stgNum: "1", typeName: "COBOL"};
    const testElement = new Element(testRepo, testIElement);
    const testQualifier: EndevorQualifier = {
        element: testElement.elmName,
        env: "envTest",
        stage: "1",
        subsystem: "sbsTest",
        system: "sysTest",
        type: "COBOL",
    };
    const testEndevorElementNode = new EndevorElementNode(testElement, testQualifier);

    // All spies are listed here
    const openDocumentSpy = jest.spyOn(vscode.workspace, "openTextDocument");
    const loggerErrorSpy = jest.spyOn(logger, "error");

    beforeEach(() => {
        // Redefine mocks, because we clear them after each run
        mockWithProgress.mockImplementation(async (progLocation, callback) => {
            const ProgressLocation = {
                Notification: 15,
                report: jest.fn(),
            };
            return await callback(ProgressLocation);
        });
    });

    afterEach(() => {
        // This is here to clear the spies
        jest.clearAllMocks();
    });

    test("Should show an element's components in the text editor", async () => {
        mockPrintElementComponents.mockReturnValueOnce({ data: "test file data" });

        await browseElement(testEndevorElementNode);

        expect(openDocumentSpy).toBeCalledWith({ content: "test file data" });
    });

    test("Should throw an error, if element's components cannot be retrieved from Endevor", async () => {
        mockPrintElementComponents.mockRejectedValueOnce({
            cancelled: false,
            error: "Test error!",
        });

        await browseElement(testEndevorElementNode);

        expect(loggerErrorSpy).toBeCalledWith("Test error!");
    });
});
