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

import { Logger } from "@zowe/imperative";
import { Profiles } from "../../../service/Profiles";

let log: Logger;

describe("Test profile manager functions", () => {
    log = Logger.getAppLogger();

    // All spies are listed here
    const openDocumentSpy = jest.spyOn(vscode.workspace, "openTextDocument");

    beforeEach(() => {
        // Redefine mocks, because we clear them after each run
    });

    afterEach(() => {
        // This is here to clear the spies
        jest.clearAllMocks();
    });

    test("Should successfully initialize a Profiles instance", async () => {
        await Profiles.createInstance(log);

        expect(openDocumentSpy).toBeCalledWith({ content: "test file data" });
    });
});
