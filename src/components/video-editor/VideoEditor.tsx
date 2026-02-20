import { useCallback, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
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
import { getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { ExportDialog } from "./ExportDialog";
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

	const wallpaper = useEditorStore((s) => s.background.value);
	const shadowIntensity = useEditorStore((s) => s.effects.shadowIntensity);
	const showBlur = useEditorStore((s) => s.effects.blurBgEnabled);
	const motionBlurEnabled = useEditorStore((s) => s.effects.motionBlurEnabled);
	const borderRadius = useEditorStore((s) => s.effects.borderRadius);
	const padding = useEditorStore((s) => s.effects.padding);
	const cropRegion = useEditorStore((s) => s.regions.cropRegion);
	const zoomRegions = useEditorStore((s) => s.regions.zoomRegions);
	const trimRegions = useEditorStore((s) => s.regions.trimRegions);
	const annotationRegions = useEditorStore((s) => s.regions.annotationRegions);
	const exportQuality = useEditorStore((s) => s.export.quality);
	const exportFormat = useEditorStore((s) => s.export.format);
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
					showBlur,
					motionBlurEnabled,
					borderRadius,
					padding,
					cropRegion,
					zoomRegions,
					trimRegions,
					annotationRegions,
					aspectRatio,
					exportQuality,
					exportFormat,
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
			showBlur,
			motionBlurEnabled,
			borderRadius,
			padding,
			cropRegion,
			zoomRegions,
			trimRegions,
			annotationRegions,
			aspectRatio,
			exportQuality,
			exportFormat,
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
			showBlur: editor.showBlur,
			motionBlurEnabled: editor.motionBlurEnabled,
			borderRadius: editor.borderRadius,
			padding: editor.padding,
			cropRegion: editor.cropRegion,
			zoomRegions: editor.zoomRegions,
			trimRegions: editor.trimRegions,
			annotationRegions: editor.annotationRegions,
			aspectRatio: editor.aspectRatio,
			exportQuality: editor.exportQuality,
			exportFormat: editor.exportFormat,
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
			store.setExportProgress(null);
			store.setExportError(null);

			try {
				const wasPlaying = isPlaying;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				const containerEl = videoPlaybackRef.current?.containerRef?.current;

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
					showBlur,
					motionBlurEnabled,
					borderRadius,
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
					const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

					if (saveResult.cancelled) {
						toast.info("Export cancelled");
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
				store.setShowExportDialog(false);
				store.setExportProgress(null);
			}
		},
		[
			videoPath,
			wallpaper,
			zoomRegions,
			trimRegions,
			shadowIntensity,
			showBlur,
			motionBlurEnabled,
			borderRadius,
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
						className="px-3 py-1.5 rounded-md bg-[#34B27B] text-white text-sm hover:bg-[#34B27B]/90"
					>
						Load Project File
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-[#09090b] text-slate-200 overflow-hidden selection:bg-[#34B27B]/30">
			<div
				className="h-10 flex-shrink-0 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-50"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div className="flex-1" />
			</div>

			<div className="flex-1 flex flex-col min-h-0">
				<PanelGroup direction="vertical">
					{/* Top section: video preview with floating settings */}
					<Panel defaultSize={65} minSize={35}>
						<div className="h-full px-5 pt-5 pb-2">
							<div className="relative w-full h-full">
								{/* Video preview area */}
								<div className="w-full h-full flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/5 shadow-2xl overflow-hidden pr-[300px]">
									{/* Video preview */}
									<div
										className="w-full flex justify-center items-center"
										style={{ flex: "1 1 auto", margin: "6px 0 0" }}
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
												transform: "scale(1.08) translateX(-2%)",
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
												showBlur={showBlur}
												motionBlurEnabled={motionBlurEnabled}
												borderRadius={borderRadius}
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
											height: "48px",
											flexShrink: 0,
											padding: "6px 12px",
											margin: "6px 0 6px 0",
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
								<div className="absolute top-3 right-3 z-30 w-[310px] max-h-[calc(100%-24px)]">
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
										showBlur={showBlur}
										onBlurChange={setShowBlur}
										motionBlurEnabled={motionBlurEnabled}
										onMotionBlurChange={setMotionBlurEnabled}
										borderRadius={borderRadius}
										onBorderRadiusChange={setBorderRadius}
										padding={padding}
										onPaddingChange={setPadding}
										cropRegion={cropRegion}
										onCropChange={setCropRegion}
										aspectRatio={aspectRatio}
										videoElement={videoPlaybackRef.current?.video || null}
										exportQuality={exportQuality}
										onExportQualityChange={setExportQuality}
										exportFormat={exportFormat}
										onExportFormatChange={setExportFormat}
										gifFrameRate={gifFrameRate}
										onGifFrameRateChange={setGifFrameRate}
										gifLoop={gifLoop}
										onGifLoopChange={setGifLoop}
										gifSizePreset={gifSizePreset}
										onGifSizePresetChange={setGifSizePreset}
										gifOutputDimensions={calculateOutputDimensions(
											videoPlaybackRef.current?.video?.videoWidth || 1920,
											videoPlaybackRef.current?.video?.videoHeight || 1080,
											gifSizePreset,
											GIF_SIZE_PRESETS,
										)}
										onExport={handleOpenExportDialog}
										selectedAnnotationId={selectedAnnotationId}
										annotationRegions={annotationRegions}
										onAnnotationContentChange={store.updateAnnotationContent}
										onAnnotationTypeChange={store.updateAnnotationType}
										onAnnotationStyleChange={store.updateAnnotationStyle}
										onAnnotationFigureDataChange={store.updateAnnotationFigureData}
										onAnnotationDelete={store.deleteAnnotationRegion}
										onSaveProject={handleSaveProject}
										onLoadProject={handleLoadProject}
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
									/>
								</div>
							</div>
						</div>
					</Panel>

					<PanelResizeHandle className="h-2 flex items-center justify-center">
						<div className="w-10 h-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors"></div>
					</PanelResizeHandle>

					{/* Timeline section - full width */}
					<Panel defaultSize={35} minSize={20}>
						<div className="h-full px-5 pb-4">
							<div className="h-full bg-[#09090b] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
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
									aspectRatio={aspectRatio}
									onAspectRatioChange={store.setAspectRatio}
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
