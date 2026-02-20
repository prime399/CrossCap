import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../electron/main", () => ({
	RECORDINGS_DIR: "/recordings",
}));

vi.mock("electron", () => ({
	ipcMain: {
		handle: vi.fn(),
		on: vi.fn(),
	},
	desktopCapturer: {
		getSources: vi.fn().mockResolvedValue([]),
	},
	shell: {
		openExternal: vi.fn().mockResolvedValue(undefined),
	},
	app: {
		isPackaged: false,
		getPath: vi.fn().mockReturnValue("/downloads"),
		getAppPath: vi.fn().mockReturnValue("/app"),
	},
	dialog: {
		showSaveDialog: vi.fn(),
		showOpenDialog: vi.fn(),
	},
	BrowserWindow: class {},
}));

vi.mock("node:fs/promises", () => ({
	default: {
		writeFile: vi.fn(),
		readFile: vi.fn(),
		readdir: vi.fn().mockResolvedValue([]),
	},
}));

import fs from "node:fs/promises";
import { dialog, ipcMain } from "electron";
import { registerIpcHandlers } from "../electron/ipc/handlers";

describe("project save/load handlers", () => {
	const setupHandlers = () => {
		registerIpcHandlers(
			() => {
				/* noop for test */
			},
			() => ({ close: vi.fn(), focus: vi.fn() }) as unknown as BrowserWindow,
			() => null,
			() => null,
		);
	};

	const getRegisteredHandler = (channel: string) => {
		const calls = (ipcMain.handle as unknown as Mock).mock.calls;
		const match = calls.find(([name]: [string]) => name === channel);
		if (!match) {
			throw new Error(`Handler not found for channel: ${channel}`);
		}
		return match[1] as (...args: unknown[]) => Promise<unknown>;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		setupHandlers();
	});

	it("overwrites existing project path without showing save dialog", async () => {
		const saveHandler = getRegisteredHandler("save-project-file");
		const projectData = { version: 1, videoPath: "/tmp/video.webm", editor: { zoomRegions: [] } };

		(fs.writeFile as unknown as Mock).mockResolvedValue(undefined);

		const result = await saveHandler(
			{},
			projectData,
			"project-name",
			"/recordings/current.crosscap",
		);

		expect(dialog.showSaveDialog).not.toHaveBeenCalled();
		expect(fs.writeFile).toHaveBeenCalledWith(
			"/recordings/current.crosscap",
			JSON.stringify(projectData, null, 2),
			"utf-8",
		);
		expect(result).toMatchObject({ success: true, path: "/recordings/current.crosscap" });
	});

	it("uses save dialog when no existing project path is provided", async () => {
		const saveHandler = getRegisteredHandler("save-project-file");
		const projectData = { version: 1, videoPath: "/tmp/video.webm", editor: { zoomRegions: [] } };

		(dialog.showSaveDialog as unknown as Mock).mockResolvedValue({
			canceled: false,
			filePath: "/tmp/new.crosscap",
		});
		(fs.writeFile as unknown as Mock).mockResolvedValue(undefined);

		const result = await saveHandler({}, projectData, "new-project");

		expect(dialog.showSaveDialog).toHaveBeenCalled();
		expect(fs.writeFile).toHaveBeenCalledWith(
			"/tmp/new.crosscap",
			JSON.stringify(projectData, null, 2),
			"utf-8",
		);
		expect(result).toMatchObject({ success: true, path: "/tmp/new.crosscap" });
	});

	it("loads project JSON payload from selected file", async () => {
		const loadHandler = getRegisteredHandler("load-project-file");
		const serialized = JSON.stringify({ version: 1, videoPath: "/tmp/video.webm", editor: {} });

		(dialog.showOpenDialog as unknown as Mock).mockResolvedValue({
			canceled: false,
			filePaths: ["/tmp/example.crosscap"],
		});
		(fs.readFile as unknown as Mock).mockResolvedValue(serialized);

		const result = await loadHandler({});

		expect(dialog.showOpenDialog).toHaveBeenCalled();
		expect(fs.readFile).toHaveBeenCalledWith("/tmp/example.crosscap", "utf-8");
		expect(result).toMatchObject({
			success: true,
			path: "/tmp/example.crosscap",
			project: { version: 1, videoPath: "/tmp/video.webm" },
		});
	});
});
