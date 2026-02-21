import {
	CaretDown,
	Check,
	Crop,
	Export,
	FilmSlate,
	FloppyDisk,
	FolderOpen,
	FrameCorners,
	Minus,
	Square,
	Timer,
	X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import {
	calculateOutputDimensions,
	type ExportContext,
	type ExportHandle,
	type ExportProgress,
	type ExportSettings,
	GIF_SIZE_PRESETS,
	runExport,
} from "@/lib/exporter";
import { parseProjectEditor, validateProjectData } from "@/schemas/project";
import { useEditorStore } from "@/stores/editorStore";
import { ASPECT_RATIOS, getAspectRatioLabel, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { ExportDialog } from "./ExportDialog";
import { ExportPage } from "./ExportPage";
import PlaybackControls from "./PlaybackControls";
import { SettingsPanel } from "./SettingsPanel";
import TimelineEditor from "./timeline/TimelineEditor";
import type { CropRegion } from "./types";
import VideoPlayback, { type VideoPlaybackRef } from "./VideoPlayback";

const PROJECT_VERSION = 1;

function toFileUrl(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	if (normalized.match(/^[a-zA-Z]:/)) {
		return `file:///${normalized}`;
	}
	return `file://${normalized}`;
}

function fromFileUrl(fileUrl: string): string {
	if (!fileUrl.startsWith("file://")) {
		return fileUrl;
	}
	try {
		const url = new URL(fileUrl);
		return decodeURIComponent(url.pathname);
	} catch {
		return fileUrl.replace(/^file:\/\//, "");
	}
}

export default function VideoEditor() {
	const store = useEditorStore();

	const videoPath = useEditorStore((s) => s.videoPath);
	const videoSourcePath = useEditorStore((s) => s.videoSourcePath);
	const currentProjectPath = useEditorStore((s) => s.currentProjectPath);
	const loading = useEditorStore((s) => s.loading);
	const error = useEditorStore((s) => s.error);
	const isPlaying = useEditorStore((s) => s.isPlaying);
	const currentTime = useEditorStore((s) => s.currentTime);
	const duration = useEditorStore((s) => s.duration);
	const cursorTelemetry = useEditorStore((s) => s.cursorTelemetry);
	const selectedZoomId = useEditorStore((s) => s.selectedZoomId);
	const selectedTrimId = useEditorStore((s) => s.selectedTrimId);
	const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
	const isExporting = useEditorStore((s) => s.isExporting);
	const exportProgress = useEditorStore((s) => s.exportProgress);
	const exportError = useEditorStore((s) => s.exportError);
	const showExportDialog = useEditorStore((s) => s.showExportDialog);
	const aspectRatio = useEditorStore((s) => s.aspectRatio);

	const [showCropModal, setShowCropModal] = useState(false);
	const [activeView, setActiveView] = useState<"editor" | "export">("editor");
	const [isWindowMaximized, setIsWindowMaximized] = useState(false);

	const wallpaper = useEditorStore((s) => s.background.value);
	const shadowIntensity = useEditorStore((s) => s.effects.shadowIntensity);
	const shadowSize = useEditorStore((s) => s.effects.shadowSize);
	const shadowOpacity = useEditorStore((s) => s.effects.shadowOpacity);
	const shadowBlur = useEditorStore((s) => s.effects.shadowBlur);
	const showBlur = useEditorStore((s) => s.effects.blurBgEnabled);
	const motionBlurEnabled = useEditorStore((s) => s.effects.motionBlurEnabled);
	const borderRadius = useEditorStore((s) => s.effects.borderRadius);
	const cornerStyle = useEditorStore((s) => s.effects.cornerStyle);
	const borderEnabled = useEditorStore((s) => s.effects.borderEnabled);
	const borderWidth = useEditorStore((s) => s.effects.borderWidth);
	const borderColor = useEditorStore((s) => s.effects.borderColor);
	const borderOpacity = useEditorStore((s) => s.effects.borderOpacity);
	const padding = useEditorStore((s) => s.effects.padding);
	const cropRegion = useEditorStore((s) => s.regions.cropRegion);
	const zoomRegions = useEditorStore((s) => s.regions.zoomRegions);
	const trimRegions = useEditorStore((s) => s.regions.trimRegions);
	const annotationRegions = useEditorStore((s) => s.regions.annotationRegions);
	const exportQuality = useEditorStore((s) => s.export.quality);
	const exportFormat = useEditorStore((s) => s.export.format);
	const bitrateMultiplier = useEditorStore((s) => s.export.bitrateMultiplier);
	const gifFrameRate = useEditorStore((s) => s.export.gifFrameRate);
	const gifLoop = useEditorStore((s) => s.export.gifLoop);
	const gifSizePreset = useEditorStore((s) => s.export.gifSizePreset);

	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const exportHandleRef = useRef<ExportHandle | null>(null);

	const setWallpaper = useCallback(
		(value: string) => store.setBackground({ value }),
		[store.setBackground],
	);
	const setShadowIntensity = useCallback(
		(value: number) => store.setEffects({ shadowIntensity: value }),
		[store.setEffects],
	);
	const setShadowSize = useCallback(
		(value: number) => store.setEffects({ shadowSize: value }),
		[store.setEffects],
	);
	const setShadowOpacity = useCallback(
		(value: number) => store.setEffects({ shadowOpacity: value }),
		[store.setEffects],
	);
	const setShadowBlur = useCallback(
		(value: number) => store.setEffects({ shadowBlur: value }),
		[store.setEffects],
	);
	const setShowBlur = useCallback(
		(value: boolean) => store.setEffects({ blurBgEnabled: value }),
		[store.setEffects],
	);
	const setMotionBlurEnabled = useCallback(
		(value: boolean) => store.setEffects({ motionBlurEnabled: value }),
		[store.setEffects],
	);
	const setBorderRadius = useCallback(
		(value: number) => store.setEffects({ borderRadius: value }),
		[store.setEffects],
	);
	const setCornerStyle = useCallback(
		(value: "rounded" | "squircle" | "sharp") => store.setEffects({ cornerStyle: value }),
		[store.setEffects],
	);
	const setBorderEnabled = useCallback(
		(value: boolean) => store.setEffects({ borderEnabled: value }),
		[store.setEffects],
	);
	const setBorderWidth = useCallback(
		(value: number) => store.setEffects({ borderWidth: value }),
		[store.setEffects],
	);
	const setBorderColor = useCallback(
		(value: string) => store.setEffects({ borderColor: value }),
		[store.setEffects],
	);
	const setBorderOpacity = useCallback(
		(value: number) => store.setEffects({ borderOpacity: value }),
		[store.setEffects],
	);
	const setPadding = useCallback(
		(value: number) => store.setEffects({ padding: value }),
		[store.setEffects],
	);
	const setCropRegion = useCallback(
		(value: CropRegion) => store.setRegions({ cropRegion: value }),
		[store.setRegions],
	);
	const setExportQuality = useCallback(
		(value: typeof exportQuality) => store.setExport({ quality: value }),
		[store.setExport],
	);
	const setExportFormat = useCallback(
		(value: typeof exportFormat) => store.setExport({ format: value }),
		[store.setExport],
	);
	const setGifFrameRate = useCallback(
		(value: typeof gifFrameRate) => store.setExport({ gifFrameRate: value }),
		[store.setExport],
	);
	const setGifLoop = useCallback(
		(value: boolean) => store.setExport({ gifLoop: value }),
		[store.setExport],
	);
	const setGifSizePreset = useCallback(
		(value: typeof gifSizePreset) => store.setExport({ gifSizePreset: value }),
		[store.setExport],
	);
	const setBitrateMultiplier = useCallback(
		(value: number) => store.setExport({ bitrateMultiplier: value }),
		[store.setExport],
	);
	const setActiveBackgroundTab = useCallback(
		(value: "image" | "color" | "gradient") => store.setUI({ activeBackgroundTab: value }),
		[store.setUI],
	);
	const setCursorEnabled = useCallback(
		(value: boolean) => store.setCursor({ enabled: value }),
		[store.setCursor],
	);
	const setCursorSize = useCallback(
		(value: number) => store.setCursor({ size: value }),
		[store.setCursor],
	);
	const setCursorSmoothing = useCallback(
		(value: number) => store.setCursor({ smoothing: value }),
		[store.setCursor],
	);
	const setClickHighlight = useCallback(
		(value: boolean) => store.setCursor({ clickHighlight: value }),
		[store.setCursor],
	);
	const setClickHighlightColor = useCallback(
		(value: string) => store.setCursor({ clickHighlightColor: value }),
		[store.setCursor],
	);

	useEffect(() => {
		async function loadVideo() {
			try {
				const result = await window.electronAPI.getCurrentVideoPath();
				if (result.success && result.path) {
					store.setVideoSourcePath(result.path);
					store.setVideoPath(toFileUrl(result.path));
				} else {
					store.setError("No video to load. Please record or select a video.");
				}
			} catch (err) {
				store.setError("Error loading video: " + String(err));
			} finally {
				store.setLoading(false);
			}
		}
		loadVideo();
	}, [store.setVideoSourcePath, store.setVideoPath, store.setError, store.setLoading]);

	useEffect(() => {
		let mounted = true;

		async function loadCursorTelemetry() {
			if (!videoSourcePath) {
				if (mounted) store.setCursorTelemetry([]);
				return;
			}
			try {
				const result = await window.electronAPI.getCursorTelemetry(videoSourcePath);
				if (mounted) {
					store.setCursorTelemetry(result.success ? result.samples : []);
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) store.setCursorTelemetry([]);
			}
		}

		loadCursorTelemetry();
		return () => {
			mounted = false;
		};
	}, [videoSourcePath, store.setCursorTelemetry]);

	const saveProject = useCallback(
		async (forceSaveAs: boolean) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const sourcePath = videoSourcePath ?? fromFileUrl(videoPath);
			if (!sourcePath) {
				toast.error("Unable to determine source video path");
				return;
			}

			const projectData = {
				version: PROJECT_VERSION,
				videoPath: sourcePath,
				editor: {
					wallpaper,
					shadowIntensity,
					shadowSize,
					shadowOpacity,
					shadowBlur,
					showBlur,
					motionBlurEnabled,
					borderRadius,
					cornerStyle,
					borderEnabled,
					borderWidth,
					borderColor,
					borderOpacity,
					padding,
					cropRegion,
					zoomRegions,
					trimRegions,
					annotationRegions,
					aspectRatio,
					exportQuality,
					exportFormat,
					bitrateMultiplier,
					gifFrameRate,
					gifLoop,
					gifSizePreset,
				},
			};

			const fileNameBase =
				sourcePath
					.split(/[\\/]/)
					.pop()
					?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
			const result = await window.electronAPI.saveProjectFile(
				projectData,
				fileNameBase,
				forceSaveAs ? undefined : (currentProjectPath ?? undefined),
			);

			if (result.cancelled) {
				toast.info("Project save cancelled");
				return;
			}

			if (!result.success) {
				toast.error(result.message || "Failed to save project");
				return;
			}

			if (result.path) {
				store.setCurrentProjectPath(result.path);
			}

			toast.success(`Project saved to ${result.path}`);
		},
		[
			videoPath,
			videoSourcePath,
			currentProjectPath,
			wallpaper,
			shadowIntensity,
			shadowSize,
			shadowOpacity,
			shadowBlur,
			showBlur,
			motionBlurEnabled,
			borderRadius,
			cornerStyle,
			borderEnabled,
			borderWidth,
			borderColor,
			borderOpacity,
			padding,
			cropRegion,
			zoomRegions,
			trimRegions,
			annotationRegions,
			aspectRatio,
			exportQuality,
			exportFormat,
			bitrateMultiplier,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			store.setCurrentProjectPath,
		],
	);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		await saveProject(true);
	}, [saveProject]);

	const handleLoadProject = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();

		if (result.cancelled) return;

		if (!result.success) {
			toast.error(result.message || "Failed to load project");
			return;
		}

		if (!validateProjectData(result.project)) {
			toast.error("Invalid project file format");
			return;
		}

		const project = result.project;
		const sourcePath = project.videoPath;
		const editor = parseProjectEditor(project.editor);

		try {
			videoPlaybackRef.current?.pause();
		} catch {
			// no-op
		}

		try {
			await window.electronAPI.setCurrentVideoPath(sourcePath);
		} catch (err) {
			console.warn("Unable to update current video path:", err);
		}

		store.loadProjectState({
			videoPath: toFileUrl(sourcePath),
			videoSourcePath: sourcePath,
			currentProjectPath: result.path ?? null,
			wallpaper: editor.wallpaper,
			shadowIntensity: editor.shadowIntensity,
			shadowSize: editor.shadowSize,
			shadowOpacity: editor.shadowOpacity,
			shadowBlur: editor.shadowBlur,
			showBlur: editor.showBlur,
			motionBlurEnabled: editor.motionBlurEnabled,
			borderRadius: editor.borderRadius,
			cornerStyle: editor.cornerStyle,
			borderEnabled: editor.borderEnabled,
			borderWidth: editor.borderWidth,
			borderColor: editor.borderColor,
			borderOpacity: editor.borderOpacity,
			padding: editor.padding,
			cropRegion: editor.cropRegion,
			zoomRegions: editor.zoomRegions,
			trimRegions: editor.trimRegions,
			annotationRegions: editor.annotationRegions,
			aspectRatio: editor.aspectRatio,
			exportQuality: editor.exportQuality,
			exportFormat: editor.exportFormat,
			bitrateMultiplier: editor.bitrateMultiplier,
			gifFrameRate: editor.gifFrameRate,
			gifLoop: editor.gifLoop,
			gifSizePreset: editor.gifSizePreset,
		});

		toast.success(`Project loaded from ${result.path}`);
	}, [store.loadProjectState]);

	useEffect(() => {
		const removeLoadListener = window.electronAPI.onMenuLoadProject(handleLoadProject);
		const removeSaveListener = window.electronAPI.onMenuSaveProject(handleSaveProject);
		const removeSaveAsListener = window.electronAPI.onMenuSaveProjectAs(handleSaveProjectAs);

		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleLoadProject, handleSaveProject, handleSaveProjectAs]);

	useEffect(() => {
		let mounted = true;
		window.electronAPI
			.isWindowMaximized()
			.then((res) => {
				if (mounted) setIsWindowMaximized(Boolean(res?.maximized));
			})
			.catch((_error) => {
				// no-op
			});
		return () => {
			mounted = false;
		};
	}, []);

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (isPlaying) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	function handleSeek(time: number) {
		const video = videoPlaybackRef.current?.video;
		if (!video) return;
		video.currentTime = time;
	}

	const handleSelectZoom = useCallback(
		(id: string | null) => {
			store.setSelectedZoomId(id);
			if (id) store.setSelectedTrimId(null);
		},
		[store.setSelectedZoomId, store.setSelectedTrimId],
	);

	const handleSelectTrim = useCallback(
		(id: string | null) => {
			store.setSelectedTrimId(id);
			if (id) {
				store.setSelectedZoomId(null);
				store.setSelectedAnnotationId(null);
			}
		},
		[store.setSelectedTrimId, store.setSelectedZoomId, store.setSelectedAnnotationId],
	);

	const handleSelectAnnotation = useCallback(
		(id: string | null) => {
			store.setSelectedAnnotationId(id);
			if (id) {
				store.setSelectedZoomId(null);
				store.setSelectedTrimId(null);
			}
		},
		[store.setSelectedAnnotationId, store.setSelectedZoomId, store.setSelectedTrimId],
	);

	// Global Tab prevention
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Tab") {
				if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
					return;
				}
				e.preventDefault();
			}

			if (e.key === " " || e.code === "Space") {
				if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, []);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((r) => r.id === selectedZoomId)) {
			store.setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions, store.setSelectedZoomId]);

	useEffect(() => {
		if (selectedTrimId && !trimRegions.some((r) => r.id === selectedTrimId)) {
			store.setSelectedTrimId(null);
		}
	}, [selectedTrimId, trimRegions, store.setSelectedTrimId]);

	useEffect(() => {
		if (selectedAnnotationId && !annotationRegions.some((r) => r.id === selectedAnnotationId)) {
			store.setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions, store.setSelectedAnnotationId]);

	const handleExport = useCallback(
		async (exportSettings: ExportSettings) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video not ready");
				return;
			}

			store.setIsExporting(true);
			store.setExportProgress({
				currentFrame: 0,
				totalFrames: 1,
				percentage: 0,
				estimatedTimeRemaining: 0,
				phase: "extracting",
				phaseDetail: "Preparing export",
			});
			store.setExportError(null);

			try {
				const wasPlaying = isPlaying;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				const containerEl = videoPlaybackRef.current?.containerRef?.current;
				const exportBorderRadius =
					cornerStyle === "sharp"
						? 0
						: cornerStyle === "squircle"
							? borderRadius * 1.45
							: borderRadius;

				const ctx: ExportContext = {
					videoPath,
					sourceWidth: video.videoWidth || 1920,
					sourceHeight: video.videoHeight || 1080,
					previewWidth: containerEl?.clientWidth || 1920,
					previewHeight: containerEl?.clientHeight || 1080,
					aspectRatio,
					exportQuality,
					wallpaper,
					zoomRegions,
					trimRegions,
					shadowIntensity,
					shadowSize,
					shadowOpacity,
					shadowBlur,
					showBlur,
					motionBlurEnabled,
					borderRadius: exportBorderRadius,
					borderEnabled,
					borderWidth,
					borderColor,
					borderOpacity,
					padding,
					cropRegion,
					annotationRegions,
					onProgress: (progress: ExportProgress) => {
						store.setExportProgress(progress);
					},
				};

				const { promise, handle } = runExport(exportSettings, ctx);
				exportHandleRef.current = handle;

				const result = await promise;

				if (result.success && result.blob) {
					const arrayBuffer = await result.blob.arrayBuffer();
					const ext = exportSettings.format === "gif" ? "gif" : "mp4";
					const fileName = `export-${Date.now()}.${ext}`;

					// End the exporting state before opening the save dialog so the
					// ExportDialog success animation can play while the native file
					// picker is open. Without this, the dialog shows a spinner behind
					// the OS save dialog.
					store.setIsExporting(false);
					store.setExportProgress({
						currentFrame: 1,
						totalFrames: 1,
						percentage: 100,
						estimatedTimeRemaining: 0,
					});

					const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

					if (saveResult.cancelled) {
						toast.info("Export cancelled");
						store.setShowExportDialog(false);
						store.setExportProgress(null);
					} else if (saveResult.success) {
						toast.success(`${ext.toUpperCase()} exported to ${saveResult.path}`);
					} else {
						store.setExportError(saveResult.message || "Failed to save");
						toast.error(saveResult.message || "Failed to save");
					}
				} else {
					store.setExportError(result.error || "Export failed");
					toast.error(result.error || "Export failed");
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : "Unknown error";
				store.setExportError(msg);
				toast.error(`Export failed: ${msg}`);
			} finally {
				store.setIsExporting(false);
				exportHandleRef.current = null;
				// Don't close dialog or clear progress here — let ExportDialog's
				// success effect show the "Export Complete" animation for 2s,
				// then auto-close. On error, the dialog stays open with the error.
			}
		},
		[
			videoPath,
			wallpaper,
			zoomRegions,
			trimRegions,
			shadowIntensity,
			shadowSize,
			shadowOpacity,
			shadowBlur,
			showBlur,
			motionBlurEnabled,
			borderRadius,
			cornerStyle,
			borderEnabled,
			borderWidth,
			borderColor,
			borderOpacity,
			padding,
			cropRegion,
			annotationRegions,
			isPlaying,
			aspectRatio,
			exportQuality,
			store,
		],
	);

	const handleOpenExportDialog = useCallback(() => {
		if (!videoPath) {
			toast.error("No video loaded");
			return;
		}

		const video = videoPlaybackRef.current?.video;
		if (!video) {
			toast.error("Video not ready");
			return;
		}

		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const gifDimensions = calculateOutputDimensions(
			sourceWidth,
			sourceHeight,
			gifSizePreset,
			GIF_SIZE_PRESETS,
		);

		const settings: ExportSettings = {
			format: exportFormat,
			quality: exportFormat === "mp4" ? exportQuality : undefined,
			bitrateMultiplier: exportFormat === "mp4" ? bitrateMultiplier : undefined,
			gifConfig:
				exportFormat === "gif"
					? {
							frameRate: gifFrameRate,
							loop: gifLoop,
							sizePreset: gifSizePreset,
							width: gifDimensions.width,
							height: gifDimensions.height,
						}
					: undefined,
		};

		store.setShowExportDialog(true);
		store.setExportError(null);

		handleExport(settings);
	}, [
		videoPath,
		exportFormat,
		exportQuality,
		bitrateMultiplier,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		handleExport,
		store,
	]);

	const handleCancelExport = useCallback(() => {
		if (exportHandleRef.current) {
			exportHandleRef.current.cancel();
			toast.info("Export cancelled");
			store.setShowExportDialog(false);
			store.setIsExporting(false);
			store.setExportProgress(null);
			store.setExportError(null);
		}
	}, [store]);

	const handleCloseExportDialog = useCallback(() => {
		store.setShowExportDialog(false);
		store.setExportProgress(null);
		store.setExportError(null);
	}, [store]);

	const handleWindowMinimize = useCallback(() => {
		window.electronAPI.minimizeWindow().catch((_error) => {
			// no-op
		});
	}, []);

	const handleWindowToggleMaximize = useCallback(async () => {
		try {
			const result = await window.electronAPI.toggleMaximizeWindow();
			setIsWindowMaximized(Boolean(result?.maximized));
		} catch {
			// no-op
		}
	}, []);

	const handleWindowClose = useCallback(() => {
		window.electronAPI.closeWindow().catch((_error) => {
			// no-op
		});
	}, []);

	const projectName = currentProjectPath
		? currentProjectPath.split(/[\\/]/).pop()
		: videoSourcePath?.split(/[\\/]/).pop() || "Untitled recording";

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen bg-background">
				<div className="text-foreground">Loading video...</div>
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex items-center justify-center h-screen bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="text-destructive">{error}</div>
					<button
						type="button"
						onClick={handleLoadProject}
						className="px-3 py-1.5 rounded-md bg-cc-accent text-white text-sm hover:bg-cc-accent/90"
					>
						Load Project File
					</button>
				</div>
			</div>
		);
	}

	const effectiveBorderRadius =
		cornerStyle === "sharp" ? 0 : cornerStyle === "squircle" ? borderRadius * 1.45 : borderRadius;
	const gifOutputDimensions = calculateOutputDimensions(
		videoPlaybackRef.current?.video?.videoWidth || 1920,
		videoPlaybackRef.current?.video?.videoHeight || 1080,
		gifSizePreset,
		GIF_SIZE_PRESETS,
	);

	if (activeView === "export") {
		return (
			<>
				<ExportPage
					onBack={() => setActiveView("editor")}
					onSaveProject={handleSaveProject}
					onExport={handleOpenExportDialog}
					onMinimizeWindow={handleWindowMinimize}
					onToggleMaximizeWindow={handleWindowToggleMaximize}
					onCloseWindow={handleWindowClose}
					isWindowMaximized={isWindowMaximized}
					videoPlaybackRef={videoPlaybackRef}
					videoPath={videoPath || ""}
					currentTime={currentTime}
					duration={duration}
					isPlaying={isPlaying}
					onTogglePlayPause={togglePlayPause}
					onSeek={handleSeek}
					onDurationChange={store.setDuration}
					onTimeUpdate={store.setCurrentTime}
					onPlayStateChange={store.setIsPlaying}
					onError={store.setError}
					aspectRatio={aspectRatio}
					wallpaper={wallpaper}
					zoomRegions={zoomRegions}
					trimRegions={trimRegions}
					annotationRegions={annotationRegions}
					showShadow={shadowIntensity > 0}
					shadowIntensity={shadowIntensity}
					shadowSize={shadowSize}
					shadowOpacity={shadowOpacity}
					shadowBlur={shadowBlur}
					showBlur={showBlur}
					motionBlurEnabled={motionBlurEnabled}
					borderRadius={effectiveBorderRadius}
					borderEnabled={borderEnabled}
					borderWidth={borderWidth}
					borderColor={borderColor}
					borderOpacity={borderOpacity}
					padding={padding}
					cropRegion={cropRegion}
					exportFormat={exportFormat}
					onExportFormatChange={setExportFormat}
					exportQuality={exportQuality}
					onExportQualityChange={setExportQuality}
					gifFrameRate={gifFrameRate}
					onGifFrameRateChange={setGifFrameRate}
					gifLoop={gifLoop}
					onGifLoopChange={setGifLoop}
					gifSizePreset={gifSizePreset}
					onGifSizePresetChange={setGifSizePreset}
					gifOutputDimensions={gifOutputDimensions}
					sourceWidth={videoPlaybackRef.current?.video?.videoWidth || 1920}
					sourceHeight={videoPlaybackRef.current?.video?.videoHeight || 1080}
					bitrateMultiplier={bitrateMultiplier}
					onBitrateMultiplierChange={setBitrateMultiplier}
				/>
				<Toaster theme="dark" className="pointer-events-auto" />
				<ExportDialog
					isOpen={showExportDialog}
					onClose={handleCloseExportDialog}
					progress={exportProgress}
					isExporting={isExporting}
					error={exportError}
					onCancel={handleCancelExport}
					exportFormat={exportFormat}
				/>
			</>
		);
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-cc-surface-0 text-[hsl(var(--cc-text-primary))] selection:bg-cc-accent/30">
			<div
				className="z-50 flex h-12 flex-shrink-0 items-center justify-between border-b border-white/5 bg-cc-surface-0/80 px-5 backdrop-blur-md"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div className="flex items-center gap-3">
					<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sky-300 ring-1 ring-white/10">
						<FilmSlate size={15} weight="duotone" />
					</div>
					<div className="leading-tight">
						<p className="text-[11px] font-semibold tracking-wide text-slate-100">
							CrossCap Studio
						</p>
						<p className="max-w-[320px] truncate text-[10px] text-slate-500">{projectName}</p>
					</div>
				</div>
				<div
					className="flex items-center gap-2 text-[10px] text-slate-400"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
						<Timer size={11} weight="duotone" />
						{Math.max(0, duration).toFixed(1)}s
					</span>
					<Button
						type="button"
						variant="ghost"
						onClick={handleLoadProject}
						className="h-8 gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					>
						<FolderOpen size={13} />
						Load
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={handleSaveProject}
						className="h-8 gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
					>
						<FloppyDisk size={13} />
						Save
					</Button>
					<Button
						type="button"
						onClick={() => setActiveView("export")}
						className="h-8 gap-1.5 rounded-full bg-cc-accent px-3 text-xs font-semibold text-white hover:bg-cc-accent/90"
					>
						<Export size={13} weight="bold" />
						Export
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleWindowMinimize}
						className="h-8 w-8 rounded-md border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white"
					>
						<Minus size={14} weight="bold" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleWindowToggleMaximize}
						className="h-8 w-8 rounded-md border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white"
					>
						<Square size={12} weight={isWindowMaximized ? "fill" : "regular"} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleWindowClose}
						className="h-8 w-8 rounded-md border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
					>
						<X size={13} weight="bold" />
					</Button>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col">
				<PanelGroup direction="vertical">
					{/* Top section: video preview with floating settings */}
					<Panel defaultSize={65} minSize={35}>
						<div className="h-full px-4 pb-2 pt-4">
							<div className="relative h-full w-full">
								{/* Video preview area */}
								<div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-[hsl(var(--cc-border-strong))]/75 bg-gradient-to-b from-[#10141d] via-[#0b0f17] to-[#080a0f] pr-[324px] shadow-[0_24px_80px_rgba(2,8,23,0.65)]">
									{/* Aspect ratio + Crop overlay */}
									<div className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-sm">
										<Button
											onClick={() => setShowCropModal(true)}
											variant="ghost"
											size="sm"
											className="h-8 gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-medium text-slate-300 transition-all duration-200 hover:border-white/15 hover:bg-white/10 hover:text-white active:scale-[0.98]"
											title="Crop Video"
										>
											<Crop size={14} weight="duotone" />
											<span>Crop</span>
										</Button>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-medium text-slate-300 transition-all duration-200 hover:border-white/15 hover:bg-white/10 hover:text-white active:scale-[0.98]"
												>
													<FrameCorners size={14} weight="duotone" />
													<span>{getAspectRatioLabel(aspectRatio)}</span>
													<CaretDown size={12} weight="bold" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="start"
												className="border-white/10 bg-cc-popover backdrop-blur-xl"
											>
												{ASPECT_RATIOS.map((ratio) => (
													<DropdownMenuItem
														key={ratio}
														onClick={() => store.setAspectRatio(ratio)}
														className="flex cursor-pointer items-center justify-between gap-3 text-slate-300 hover:bg-white/10 hover:text-white"
													>
														<span>{getAspectRatioLabel(ratio)}</span>
														{aspectRatio === ratio && (
															<Check size={12} weight="bold" className="text-cc-accent" />
														)}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
									{/* Video preview */}
									<div
										className="w-full flex justify-center items-center"
										style={{ flex: "1 1 auto", margin: "10px 0 0" }}
									>
										<div
											className="relative"
											style={{
												width: "auto",
												height: "100%",
												aspectRatio: getAspectRatioValue(aspectRatio),
												maxWidth: "100%",
												margin: "0 auto",
												boxSizing: "border-box",
												transform: "scale(1.05) translateX(-1.3%)",
												transformOrigin: "center center",
											}}
										>
											<VideoPlayback
												key={videoPath || "no-video"}
												aspectRatio={aspectRatio}
												ref={videoPlaybackRef}
												videoPath={videoPath || ""}
												onDurationChange={store.setDuration}
												onTimeUpdate={store.setCurrentTime}
												currentTime={currentTime}
												onPlayStateChange={store.setIsPlaying}
												onError={store.setError}
												wallpaper={wallpaper}
												zoomRegions={zoomRegions}
												selectedZoomId={selectedZoomId}
												onSelectZoom={handleSelectZoom}
												onZoomFocusChange={store.updateZoomFocus}
												isPlaying={isPlaying}
												showShadow={shadowIntensity > 0}
												shadowIntensity={shadowIntensity}
												shadowSize={shadowSize}
												shadowOpacity={shadowOpacity}
												shadowBlur={shadowBlur}
												showBlur={showBlur}
												motionBlurEnabled={motionBlurEnabled}
												borderRadius={effectiveBorderRadius}
												borderEnabled={borderEnabled}
												borderWidth={borderWidth}
												borderColor={borderColor}
												borderOpacity={borderOpacity}
												padding={padding}
												cropRegion={cropRegion}
												trimRegions={trimRegions}
												annotationRegions={annotationRegions}
												selectedAnnotationId={selectedAnnotationId}
												onSelectAnnotation={handleSelectAnnotation}
												onAnnotationPositionChange={store.updateAnnotationPosition}
												onAnnotationSizeChange={store.updateAnnotationSize}
											/>
										</div>
									</div>
									{/* Playback controls */}
									<div
										className="w-full flex justify-center items-center"
										style={{
											height: "54px",
											flexShrink: 0,
											padding: "8px 14px",
											margin: "8px 0",
										}}
									>
										<div style={{ width: "100%", maxWidth: "700px" }}>
											<PlaybackControls
												isPlaying={isPlaying}
												currentTime={currentTime}
												duration={duration}
												onTogglePlayPause={togglePlayPause}
												onSeek={handleSeek}
											/>
										</div>
									</div>
								</div>

								{/* Floating settings panel */}
								<div className="absolute right-3 top-3 z-30 h-[calc(100%-24px)] w-[328px]">
									<SettingsPanel
										selected={wallpaper}
										onWallpaperChange={setWallpaper}
										selectedZoomDepth={
											selectedZoomId
												? zoomRegions.find((z) => z.id === selectedZoomId)?.depth
												: null
										}
										onZoomDepthChange={(depth) => selectedZoomId && store.updateZoomDepth(depth)}
										selectedZoomId={selectedZoomId}
										onZoomDelete={store.deleteZoomRegion}
										selectedTrimId={selectedTrimId}
										onTrimDelete={store.deleteTrimRegion}
										shadowIntensity={shadowIntensity}
										onShadowChange={setShadowIntensity}
										shadowSize={shadowSize}
										onShadowSizeChange={setShadowSize}
										shadowOpacity={shadowOpacity}
										onShadowOpacityChange={setShadowOpacity}
										shadowBlur={shadowBlur}
										onShadowBlurChange={setShadowBlur}
										showBlur={showBlur}
										onBlurChange={setShowBlur}
										motionBlurEnabled={motionBlurEnabled}
										onMotionBlurChange={setMotionBlurEnabled}
										borderRadius={borderRadius}
										onBorderRadiusChange={setBorderRadius}
										cornerStyle={cornerStyle}
										onCornerStyleChange={setCornerStyle}
										borderEnabled={borderEnabled}
										onBorderEnabledChange={setBorderEnabled}
										borderWidth={borderWidth}
										onBorderWidthChange={setBorderWidth}
										borderColor={borderColor}
										onBorderColorChange={setBorderColor}
										borderOpacity={borderOpacity}
										onBorderOpacityChange={setBorderOpacity}
										padding={padding}
										onPaddingChange={setPadding}
										cropRegion={cropRegion}
										onCropChange={setCropRegion}
										aspectRatio={aspectRatio}
										videoElement={videoPlaybackRef.current?.video || null}
										selectedAnnotationId={selectedAnnotationId}
										annotationRegions={annotationRegions}
										onAnnotationContentChange={store.updateAnnotationContent}
										onAnnotationTypeChange={store.updateAnnotationType}
										onAnnotationStyleChange={store.updateAnnotationStyle}
										onAnnotationFigureDataChange={store.updateAnnotationFigureData}
										onAnnotationDelete={store.deleteAnnotationRegion}
										customImages={store.background.customImages}
										onCustomImageAdd={store.addCustomImage}
										onCustomImageRemove={store.removeCustomImage}
										activeBackgroundTab={store.ui.activeBackgroundTab}
										onActiveBackgroundTabChange={setActiveBackgroundTab}
										cursorEnabled={store.cursor.enabled}
										onCursorEnabledChange={setCursorEnabled}
										cursorSize={store.cursor.size}
										onCursorSizeChange={setCursorSize}
										cursorSmoothing={store.cursor.smoothing}
										onCursorSmoothingChange={setCursorSmoothing}
										clickHighlight={store.cursor.clickHighlight}
										onClickHighlightChange={setClickHighlight}
										clickHighlightColor={store.cursor.clickHighlightColor}
										onClickHighlightColorChange={setClickHighlightColor}
										showCropModal={showCropModal}
										onShowCropModal={setShowCropModal}
									/>
								</div>
							</div>
						</div>
					</Panel>

					<PanelResizeHandle className="h-2 flex items-center justify-center">
						<div className="h-1 w-12 rounded-full bg-white/10 transition-colors hover:bg-white/20"></div>
					</PanelResizeHandle>

					{/* Timeline section - full width */}
					<Panel defaultSize={35} minSize={20}>
						<div className="h-full px-4 pb-4">
							<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[hsl(var(--cc-border-strong))]/70 bg-gradient-to-b from-[#0e131c] to-[#080b11] shadow-xl">
								<TimelineEditor
									videoDuration={duration}
									currentTime={currentTime}
									onSeek={handleSeek}
									cursorTelemetry={cursorTelemetry}
									zoomRegions={zoomRegions}
									onZoomAdded={store.addZoomRegion}
									onZoomSuggested={store.addSuggestedZoomRegion}
									onZoomSpanChange={store.updateZoomSpan}
									onZoomDelete={store.deleteZoomRegion}
									selectedZoomId={selectedZoomId}
									onSelectZoom={handleSelectZoom}
									trimRegions={trimRegions}
									onTrimAdded={store.addTrimRegion}
									onTrimSpanChange={store.updateTrimSpan}
									onTrimDelete={store.deleteTrimRegion}
									selectedTrimId={selectedTrimId}
									onSelectTrim={handleSelectTrim}
									annotationRegions={annotationRegions}
									onAnnotationAdded={store.addAnnotationRegion}
									onAnnotationSpanChange={store.updateAnnotationSpan}
									onAnnotationDelete={store.deleteAnnotationRegion}
									selectedAnnotationId={selectedAnnotationId}
									onSelectAnnotation={handleSelectAnnotation}
								/>
							</div>
						</div>
					</Panel>
				</PanelGroup>
			</div>

			<Toaster theme="dark" className="pointer-events-auto" />

			<ExportDialog
				isOpen={showExportDialog}
				onClose={() => store.setShowExportDialog(false)}
				progress={exportProgress}
				isExporting={isExporting}
				error={exportError}
				onCancel={handleCancelExport}
				exportFormat={exportFormat}
			/>
		</div>
	);
}
