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

import { CliProfileManager, IProfileLoaded, Logger } from "@zowe/imperative";
import { logger } from "../../../globals";
import { Profiles } from "../../../service/Profiles";

let log: Logger;

describe("Test profile manager functions", () => {
    log = Logger.getAppLogger();

    let profilesInstance;
    let cliProfileManager;
    const mockEndevorProfile: IProfileLoaded = {
        failNotFound: false,
        message: "",
        name: "sestest",
        profile: {
            host: "test",
            name: "testName",
            password: "test",
            port: 1443,
            rejectUnauthorized: false,
            type: "endevor",
            user: "test",
        },
        type: "endevor",
    };
    const mockZosmfProfile: IProfileLoaded = {
        failNotFound: false,
        message: "",
        name: "sestest",
        profile: {
            host: "test",
            name: "testName",
            password: "test",
            port: 1443,
            rejectUnauthorized: false,
            type: "zosmf",
            user: "test",
        },
        type: "zosmf",
    };

    // All spies are listed here
    const loggerErrorSpy = jest.spyOn(logger, "error");
    const initializeSpy = jest.spyOn(CliProfileManager, "initialize");
    let loadAllSpy;
    let loadSpy;

    beforeEach(async () => {
        // Create an instance of Profiles, to use in the tests
        profilesInstance = await Profiles.createInstance(log);
        cliProfileManager = await profilesInstance.getEndevorCliProfileManager();
        profilesInstance.endevorProfileManager = cliProfileManager;

        // Redefine mocks, because we clear them after each run
        loadAllSpy = jest.spyOn(cliProfileManager, "loadAll");
        loadSpy = jest.spyOn(cliProfileManager, "load");
        loadAllSpy.mockResolvedValue([mockEndevorProfile, mockZosmfProfile]);
        loadSpy.mockResolvedValue(mockEndevorProfile);
    });

    afterEach(() => {
        // This is here to clear the spies
        jest.clearAllMocks();
    });

    test("Should properly refresh() a Profiles instance", async () => {
        // In this test, getEndevorCliProfileManager is mocked, so that I can control allProfiles.
        // getEndevorCliProfileManager is tested separately below
        await profilesInstance.refresh();

        expect(profilesInstance.allProfiles).toEqual([mockEndevorProfile]);
        expect(profilesInstance.defaultProfile).toEqual(mockEndevorProfile);
    });

    test("Should throw an error during refresh() if default profile cannot be loaded", async () => {
        // In this test, getEndevorCliProfileManager is mocked, so that I can control allProfiles.
        // getEndevorCliProfileManager is tested separately below
        loadSpy.mockRejectedValueOnce({ message: "Test error!" });

        await profilesInstance.refresh();

        expect(loggerErrorSpy).toBeCalledWith("Test error!");
    });

    test("Should fetch & assign Endevor CLI Profile Manager when getEndevorCliProfileManager is called", async () => {
        // Unassign the manager so that the function runs afresh
        profilesInstance.endevorProfileManager = null;

        const endevorCliProfileManager = await profilesInstance.getEndevorCliProfileManager();

        expect(endevorCliProfileManager instanceof CliProfileManager).toBeTruthy();
    });

    test("Should throw an error when getEndevorCliProfileManager fails to initialize() the manager", async () => {
        // Unassign the manager so that the function runs afresh
        profilesInstance.endevorProfileManager = null;
        initializeSpy.mockRejectedValueOnce({ message: "Test error!" });

        const endevorCliProfileManager = await profilesInstance.getEndevorCliProfileManager();

        expect(endevorCliProfileManager).toEqual(null);
        expect(loggerErrorSpy).toBeCalledWith("Failed to load Imperative Profile Manager.", "Test error!");
    });
});
