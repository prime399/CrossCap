/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built directory structure
		 *
		 * ```tree
		 * ├─┬─┬ dist
		 * │ │ └── index.html
		 * │ │
		 * │ ├─┬ dist-electron
		 * │ │ ├── main.js
		 * │ │ └── preload.js
		 * │
		 * ```
		 */
		APP_ROOT: string;
		/** /dist/ or /public/ */
		VITE_PUBLIC: string;
	}
}

interface ProcessedDesktopSource {
	id: string;
	name: string;
	display_id: string;
	thumbnail: string | null;
	appIcon: string | null;
}

interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
	electronAPI: {
		hudOverlayHide: () => void;
		hudOverlayClose: () => void;
		getAssetBasePath: () => Promise<string | null>;
		getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>;
		switchToEditor: () => Promise<void>;
		openSourceSelector: () => Promise<void>;
		selectSource: (source: ProcessedDesktopSource) => Promise<ProcessedDesktopSource>;
		getSelectedSource: () => Promise<ProcessedDesktopSource | null>;
		storeRecordedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{
			success: boolean;
			path?: string;
			message: string;
			error?: string;
		}>;
		getRecordedVideoPath: () => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			error?: string;
		}>;
		setRecordingState: (recording: boolean) => Promise<void>;
		getCursorTelemetry: (videoPath?: string) => Promise<{
			success: boolean;
			samples: CursorTelemetryPoint[];
			message?: string;
			error?: string;
		}>;
		onStopRecordingFromTray: (callback: () => void) => () => void;
		openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
		saveExportedVideo: (
			videoData: ArrayBuffer,
			fileName: string,
		) => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			cancelled?: boolean;
		}>;
		openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>;
		setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>;
		getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>;
		clearCurrentVideoPath: () => Promise<{ success: boolean }>;
		saveProjectFile: (
			projectData: unknown,
			suggestedName?: string,
			existingProjectPath?: string,
		) => Promise<{
			success: boolean;
			path?: string;
			message?: string;
			cancelled?: boolean;
			error?: string;
		}>;
		loadProjectFile: () => Promise<{
			success: boolean;
			path?: string;
			project?: unknown;
			message?: string;
			cancelled?: boolean;
			error?: string;
		}>;
		onMenuLoadProject: (callback: () => void) => () => void;
		onMenuSaveProject: (callback: () => void) => () => void;
		onMenuSaveProjectAs: (callback: () => void) => () => void;
		getPlatform: () => Promise<string>;
	};
}
