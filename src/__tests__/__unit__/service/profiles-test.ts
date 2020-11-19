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

import { CliProfileManager, IProfileLoaded, Logger } from "@zowe/imperative";
import { logger } from "../../../globals";
import { Profiles } from "../../../service/Profiles";

const log: Logger = Logger.getAppLogger();

jest.mock("@zowe/imperative/lib/console/src/Console"); // disable imperative logging
jest.mock("vscode");

const mockZosmfProfile: IProfileLoaded = {
    failNotFound: false,
    message: "",
    name: "zosmftest",
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
const mockEndevorProfile: IProfileLoaded = {
    failNotFound: false,
    message: "",
    name: "endevortest",
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

describe("Test profile instance functions", () => {
    let profilesInstance;
    let cliProfileManager;

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

describe("Profiles Unit Tests - Creating a new connection", () => {
    let profilesInstance;
    let cliProfileManager;

    // Mock VSCode's showInputBox & showQuickPick functions
    const mockInputBox: vscode.InputBox = {
        value: "Test",
        title: undefined,
        enabled: true,
        busy: false,
        show: jest.fn(),
        hide: jest.fn(),
        step: undefined,
        dispose: jest.fn(),
        ignoreFocusOut: false,
        totalSteps: undefined,
        placeholder: undefined,
        password: false,
        onDidChangeValue: jest.fn(),
        onDidAccept: jest.fn(),
        onDidHide: jest.fn(),
        buttons: [],
        onDidTriggerButton: jest.fn(),
        prompt: undefined,
        validationMessage: undefined,
    };
    const mockShowInputBox = jest.fn();
    const mockShowQuickPick = jest.fn();
    Object.defineProperty(vscode.window, "createInputBox", {
        value: jest.fn().mockReturnValue(mockInputBox),
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: mockShowInputBox });
    Object.defineProperty(vscode.window, "showQuickPick", { value: mockShowQuickPick });

    // All spies are listed here
    const loggerErrorSpy = jest.spyOn(logger, "error");
    const loggerInfoSpy = jest.spyOn(logger, "info");
    let saveSpy;
    let getUrlSpy;

    beforeEach(async () => {
        // Create an instance of Profiles, to use in the tests
        profilesInstance = await Profiles.createInstance(log);
        cliProfileManager = await profilesInstance.getEndevorCliProfileManager();
        profilesInstance.allProfiles = [mockEndevorProfile];

        // Redefine mocks, because we clear them after each run
        getUrlSpy = jest.spyOn(profilesInstance, "getUrl");
        saveSpy = jest.spyOn(cliProfileManager, "save");

        saveSpy.mockImplementation(() => {
            return {
                name: mockZosmfProfile.name,
                profile: mockZosmfProfile.profile,
                type: mockZosmfProfile.type,
            };
        });
    });

    afterEach(() => {
        // This is here to clear the spies
        jest.clearAllMocks();
    });

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        await profilesInstance.createNewConnection("");

        expect(loggerInfoSpy).toBeCalledWith("No valid value for new profile name. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        getUrlSpy.mockResolvedValueOnce(undefined);

        await profilesInstance.createNewConnection(mockZosmfProfile.name);

        expect(loggerInfoSpy).toBeCalledWith("No valid value for Endevor URL. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if username is missing", async () => {
        getUrlSpy.mockResolvedValueOnce("https://fake:143");
        mockShowInputBox.mockResolvedValueOnce(undefined);

        await profilesInstance.createNewConnection(mockZosmfProfile.name);

        expect(loggerInfoSpy).toBeCalledWith("No valid value for username. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if password is missing", async () => {
        getUrlSpy.mockResolvedValueOnce("https://fake:143");
        mockShowInputBox.mockResolvedValueOnce("fake");
        mockShowInputBox.mockResolvedValueOnce(undefined);

        await profilesInstance.createNewConnection(mockZosmfProfile.name);

        expect(loggerInfoSpy).toBeCalledWith("No valid value for password. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if rejectUnauthorized is missing", async () => {
        getUrlSpy.mockResolvedValueOnce("https://fake:143");
        mockShowInputBox.mockResolvedValueOnce("fake");
        mockShowInputBox.mockResolvedValueOnce("fake");
        mockShowQuickPick.mockResolvedValueOnce(undefined);

        await profilesInstance.createNewConnection(mockZosmfProfile.name);

        expect(loggerInfoSpy).toBeCalledWith("No valid value for Reject Unauthorized. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        await profilesInstance.createNewConnection(mockEndevorProfile.name);

        expect(loggerErrorSpy).toBeCalledWith("Profile name already exists. Please create a profile using a different name");
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        getUrlSpy.mockResolvedValueOnce("https://newHost:143");
        mockShowInputBox.mockResolvedValueOnce("newUser");
        mockShowInputBox.mockResolvedValueOnce("newPass");
        mockShowQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");

        const newProfileName = await profilesInstance.createNewConnection("testName");

        expect(loggerInfoSpy).toBeCalledWith("Profile testName was created.");
        expect(newProfileName).toEqual("testName");
    });

    it("Tests that createNewConnection fails if saveProfile fails", async () => {
        getUrlSpy.mockResolvedValueOnce("https://fake:143");
        mockShowInputBox.mockResolvedValueOnce("fake");
        mockShowInputBox.mockResolvedValueOnce("fake");
        mockShowQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");
        saveSpy.mockRejectedValueOnce({ message: "Test error!" });

        await profilesInstance.createNewConnection(mockZosmfProfile.name);

        expect(loggerErrorSpy).toBeCalledWith("Error saving profile: ", "Test error!");
    });
});
