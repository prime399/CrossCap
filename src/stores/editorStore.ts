import type { Span } from "dnd-timeline";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	type AnnotationRegion,
	type CropRegion,
	type CursorTelemetryPoint,
	clampFocusToDepth,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_FIGURE_DATA,
	DEFAULT_VIDEO_EDITOR_BACKGROUND,
	DEFAULT_VIDEO_EDITOR_CURSOR,
	DEFAULT_VIDEO_EDITOR_EFFECTS,
	DEFAULT_VIDEO_EDITOR_EXPORT,
	DEFAULT_VIDEO_EDITOR_REGIONS,
	DEFAULT_VIDEO_EDITOR_UI,
	DEFAULT_ZOOM_DEPTH,
	type FigureData,
	SETTINGS_STORAGE_KEY,
	type TrimRegion,
	type VideoEditorBackground,
	type VideoEditorCursor,
	type VideoEditorEffects,
	type VideoEditorExport,
	type VideoEditorRegions,
	type VideoEditorUI,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomRegion,
} from "@/components/video-editor/types";
import type {
	ExportFormat,
	ExportProgress,
	ExportQuality,
	GifFrameRate,
	GifSizePreset,
} from "@/lib/exporter";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

// --- Persisted settings slice ---

interface SettingsSlice {
	effects: VideoEditorEffects;
	background: VideoEditorBackground;
	export: VideoEditorExport;
	regions: VideoEditorRegions;
	ui: VideoEditorUI;
	cursor: VideoEditorCursor;
}

// --- Transient state slice ---

interface TransientSlice {
	videoPath: string | null;
	videoSourcePath: string | null;
	currentProjectPath: string | null;
	loading: boolean;
	error: string | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	cursorTelemetry: CursorTelemetryPoint[];
	selectedZoomId: string | null;
	selectedTrimId: string | null;
	selectedAnnotationId: string | null;
	isExporting: boolean;
	exportProgress: ExportProgress | null;
	exportError: string | null;
	showExportDialog: boolean;
	aspectRatio: AspectRatio;
	nextZoomId: number;
	nextTrimId: number;
	nextAnnotationId: number;
	nextAnnotationZIndex: number;
}

// --- Actions ---

interface SettingsActions {
	setEffects: (patch: Partial<VideoEditorEffects>) => void;
	setBackground: (patch: Partial<VideoEditorBackground>) => void;
	setExport: (patch: Partial<VideoEditorExport>) => void;
	setRegions: (patch: Partial<VideoEditorRegions>) => void;
	setUI: (patch: Partial<VideoEditorUI>) => void;
	setCursor: (patch: Partial<VideoEditorCursor>) => void;
}

interface TransientActions {
	setVideoPath: (path: string | null) => void;
	setVideoSourcePath: (path: string | null) => void;
	setCurrentProjectPath: (path: string | null) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	setIsPlaying: (playing: boolean) => void;
	setCurrentTime: (time: number) => void;
	setDuration: (duration: number) => void;
	setCursorTelemetry: (points: CursorTelemetryPoint[]) => void;
	setSelectedZoomId: (id: string | null) => void;
	setSelectedTrimId: (id: string | null) => void;
	setSelectedAnnotationId: (id: string | null) => void;
	setIsExporting: (exporting: boolean) => void;
	setExportProgress: (progress: ExportProgress | null) => void;
	setExportError: (error: string | null) => void;
	setShowExportDialog: (show: boolean) => void;
	setAspectRatio: (ratio: AspectRatio) => void;
}

interface RegionActions {
	addZoomRegion: (span: Span) => string;
	addSuggestedZoomRegion: (span: Span, focus: ZoomFocus) => string;
	updateZoomSpan: (id: string, span: Span) => void;
	updateZoomFocus: (id: string, focus: ZoomFocus) => void;
	updateZoomDepth: (depth: ZoomDepth) => void;
	deleteZoomRegion: (id: string) => void;
	addTrimRegion: (span: Span) => string;
	updateTrimSpan: (id: string, span: Span) => void;
	deleteTrimRegion: (id: string) => void;
	addAnnotationRegion: (span: Span) => string;
	updateAnnotationSpan: (id: string, span: Span) => void;
	deleteAnnotationRegion: (id: string) => void;
	updateAnnotationContent: (id: string, content: string) => void;
	updateAnnotationType: (id: string, type: AnnotationRegion["type"]) => void;
	updateAnnotationStyle: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	updateAnnotationFigureData: (id: string, figureData: FigureData) => void;
	updateAnnotationPosition: (id: string, position: { x: number; y: number }) => void;
	updateAnnotationSize: (id: string, size: { width: number; height: number }) => void;
}

interface BackgroundActions {
	addCustomImage: (imageUrl: string) => void;
	removeCustomImage: (imageUrl: string) => void;
}

interface ProjectActions {
	loadProjectState: (state: {
		videoPath: string;
		videoSourcePath: string;
		currentProjectPath: string | null;
		wallpaper: string;
		shadowIntensity: number;
		showBlur: boolean;
		motionBlurEnabled: boolean;
		borderRadius: number;
		padding: number;
		cropRegion: CropRegion;
		zoomRegions: ZoomRegion[];
		trimRegions: TrimRegion[];
		annotationRegions: AnnotationRegion[];
		aspectRatio: AspectRatio;
		exportQuality: ExportQuality;
		exportFormat: ExportFormat;
		gifFrameRate: GifFrameRate;
		gifLoop: boolean;
		gifSizePreset: GifSizePreset;
	}) => void;
}

export type EditorStore = SettingsSlice &
	TransientSlice &
	SettingsActions &
	TransientActions &
	RegionActions &
	BackgroundActions &
	ProjectActions;

// --- Helpers ---

function deriveNextId(prefix: string, ids: string[]): number {
	let max = 0;
	const re = new RegExp(`^${prefix}-(\\d+)$`);
	for (const id of ids) {
		const match = id.match(re);
		if (match) {
			const value = Number(match[1]);
			if (Number.isFinite(value) && value > max) max = value;
		}
	}
	return max + 1;
}

// --- Store ---

export const useEditorStore = create<EditorStore>()(
	persist(
		(set, get) => ({
			// --- Persisted settings defaults ---
			effects: { ...DEFAULT_VIDEO_EDITOR_EFFECTS },
			background: { ...DEFAULT_VIDEO_EDITOR_BACKGROUND },
			export: { ...DEFAULT_VIDEO_EDITOR_EXPORT },
			regions: { ...DEFAULT_VIDEO_EDITOR_REGIONS },
			ui: { ...DEFAULT_VIDEO_EDITOR_UI },
			cursor: { ...DEFAULT_VIDEO_EDITOR_CURSOR },

			// --- Transient defaults ---
			videoPath: null,
			videoSourcePath: null,
			currentProjectPath: null,
			loading: true,
			error: null,
			isPlaying: false,
			currentTime: 0,
			duration: 0,
			cursorTelemetry: [],
			selectedZoomId: null,
			selectedTrimId: null,
			selectedAnnotationId: null,
			isExporting: false,
			exportProgress: null,
			exportError: null,
			showExportDialog: false,
			aspectRatio: "16:9" as AspectRatio,
			nextZoomId: 1,
			nextTrimId: 1,
			nextAnnotationId: 1,
			nextAnnotationZIndex: 1,

			// --- Settings actions ---
			setEffects: (patch) => set((s) => ({ effects: { ...s.effects, ...patch } })),
			setBackground: (patch) => set((s) => ({ background: { ...s.background, ...patch } })),
			setExport: (patch) => set((s) => ({ export: { ...s.export, ...patch } })),
			setRegions: (patch) => set((s) => ({ regions: { ...s.regions, ...patch } })),
			setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
			setCursor: (patch) => set((s) => ({ cursor: { ...s.cursor, ...patch } })),

			// --- Transient actions ---
			setVideoPath: (path) => set({ videoPath: path }),
			setVideoSourcePath: (path) => set({ videoSourcePath: path }),
			setCurrentProjectPath: (path) => set({ currentProjectPath: path }),
			setLoading: (loading) => set({ loading }),
			setError: (error) => set({ error }),
			setIsPlaying: (playing) => set({ isPlaying: playing }),
			setCurrentTime: (time) => set({ currentTime: time }),
			setDuration: (duration) => set({ duration }),
			setCursorTelemetry: (points) => set({ cursorTelemetry: points }),
			setSelectedZoomId: (id) => set({ selectedZoomId: id }),
			setSelectedTrimId: (id) => set({ selectedTrimId: id }),
			setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
			setIsExporting: (exporting) => set({ isExporting: exporting }),
			setExportProgress: (progress) => set({ exportProgress: progress }),
			setExportError: (error) => set({ exportError: error }),
			setShowExportDialog: (show) => set({ showExportDialog: show }),
			setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

			// --- Region actions ---
			addZoomRegion: (span) => {
				const state = get();
				const id = `zoom-${state.nextZoomId}`;
				const newRegion: ZoomRegion = {
					id,
					startMs: Math.round(span.start),
					endMs: Math.round(span.end),
					depth: DEFAULT_ZOOM_DEPTH,
					focus: { cx: 0.5, cy: 0.5 },
				};
				const zoomRegions = [...state.regions.zoomRegions, newRegion];
				set({
					regions: { ...state.regions, zoomRegions },
					nextZoomId: state.nextZoomId + 1,
					selectedZoomId: id,
					selectedTrimId: null,
					selectedAnnotationId: null,
				});
				return id;
			},

			addSuggestedZoomRegion: (span, focus) => {
				const state = get();
				const id = `zoom-${state.nextZoomId}`;
				const newRegion: ZoomRegion = {
					id,
					startMs: Math.round(span.start),
					endMs: Math.round(span.end),
					depth: DEFAULT_ZOOM_DEPTH,
					focus: clampFocusToDepth(focus, DEFAULT_ZOOM_DEPTH),
				};
				const zoomRegions = [...state.regions.zoomRegions, newRegion];
				set({
					regions: { ...state.regions, zoomRegions },
					nextZoomId: state.nextZoomId + 1,
					selectedZoomId: id,
					selectedTrimId: null,
					selectedAnnotationId: null,
				});
				return id;
			},

			updateZoomSpan: (id, span) =>
				set((s) => ({
					regions: {
						...s.regions,
						zoomRegions: s.regions.zoomRegions.map((r) =>
							r.id === id
								? { ...r, startMs: Math.round(span.start), endMs: Math.round(span.end) }
								: r,
						),
					},
				})),

			updateZoomFocus: (id, focus) =>
				set((s) => ({
					regions: {
						...s.regions,
						zoomRegions: s.regions.zoomRegions.map((r) =>
							r.id === id ? { ...r, focus: clampFocusToDepth(focus, r.depth) } : r,
						),
					},
				})),

			updateZoomDepth: (depth) => {
				const { selectedZoomId } = get();
				if (!selectedZoomId) return;
				set((s) => ({
					regions: {
						...s.regions,
						zoomRegions: s.regions.zoomRegions.map((r) =>
							r.id === selectedZoomId
								? { ...r, depth, focus: clampFocusToDepth(r.focus, depth) }
								: r,
						),
					},
				}));
			},

			deleteZoomRegion: (id) =>
				set((s) => ({
					regions: {
						...s.regions,
						zoomRegions: s.regions.zoomRegions.filter((r) => r.id !== id),
					},
					selectedZoomId: s.selectedZoomId === id ? null : s.selectedZoomId,
				})),

			addTrimRegion: (span) => {
				const state = get();
				const id = `trim-${state.nextTrimId}`;
				const newRegion: TrimRegion = {
					id,
					startMs: Math.round(span.start),
					endMs: Math.round(span.end),
				};
				const trimRegions = [...state.regions.trimRegions, newRegion];
				set({
					regions: { ...state.regions, trimRegions },
					nextTrimId: state.nextTrimId + 1,
					selectedTrimId: id,
					selectedZoomId: null,
					selectedAnnotationId: null,
				});
				return id;
			},

			updateTrimSpan: (id, span) =>
				set((s) => ({
					regions: {
						...s.regions,
						trimRegions: s.regions.trimRegions.map((r) =>
							r.id === id
								? { ...r, startMs: Math.round(span.start), endMs: Math.round(span.end) }
								: r,
						),
					},
				})),

			deleteTrimRegion: (id) =>
				set((s) => ({
					regions: {
						...s.regions,
						trimRegions: s.regions.trimRegions.filter((r) => r.id !== id),
					},
					selectedTrimId: s.selectedTrimId === id ? null : s.selectedTrimId,
				})),

			addAnnotationRegion: (span) => {
				const state = get();
				const id = `annotation-${state.nextAnnotationId}`;
				const zIndex = state.nextAnnotationZIndex;
				const newRegion: AnnotationRegion = {
					id,
					startMs: Math.round(span.start),
					endMs: Math.round(span.end),
					type: "text",
					content: "Enter text...",
					position: { ...DEFAULT_ANNOTATION_POSITION },
					size: { ...DEFAULT_ANNOTATION_SIZE },
					style: { ...DEFAULT_ANNOTATION_STYLE },
					zIndex,
				};
				set({
					regions: {
						...state.regions,
						annotationRegions: [...state.regions.annotationRegions, newRegion],
					},
					nextAnnotationId: state.nextAnnotationId + 1,
					nextAnnotationZIndex: state.nextAnnotationZIndex + 1,
					selectedAnnotationId: id,
					selectedZoomId: null,
					selectedTrimId: null,
				});
				return id;
			},

			updateAnnotationSpan: (id, span) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) =>
							r.id === id
								? { ...r, startMs: Math.round(span.start), endMs: Math.round(span.end) }
								: r,
						),
					},
				})),

			deleteAnnotationRegion: (id) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.filter((r) => r.id !== id),
					},
					selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
				})),

			updateAnnotationContent: (id, content) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) => {
							if (r.id !== id) return r;
							if (r.type === "text") return { ...r, content, textContent: content };
							if (r.type === "image") return { ...r, content, imageContent: content };
							return { ...r, content };
						}),
					},
				})),

			updateAnnotationType: (id, type) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) => {
							if (r.id !== id) return r;
							const updated = { ...r, type };
							if (type === "text") {
								updated.content = r.textContent || "Enter text...";
							} else if (type === "image") {
								updated.content = r.imageContent || "";
							} else if (type === "figure") {
								updated.content = "";
								if (!r.figureData) {
									updated.figureData = { ...DEFAULT_FIGURE_DATA };
								}
							}
							return updated;
						}),
					},
				})),

			updateAnnotationStyle: (id, style) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) =>
							r.id === id ? { ...r, style: { ...r.style, ...style } } : r,
						),
					},
				})),

			updateAnnotationFigureData: (id, figureData) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) =>
							r.id === id ? { ...r, figureData } : r,
						),
					},
				})),

			updateAnnotationPosition: (id, position) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) =>
							r.id === id ? { ...r, position } : r,
						),
					},
				})),

			updateAnnotationSize: (id, size) =>
				set((s) => ({
					regions: {
						...s.regions,
						annotationRegions: s.regions.annotationRegions.map((r) =>
							r.id === id ? { ...r, size } : r,
						),
					},
				})),

			// --- Background actions ---
			addCustomImage: (imageUrl) =>
				set((s) => ({
					background: {
						...s.background,
						customImages: [...s.background.customImages, imageUrl],
					},
				})),

			removeCustomImage: (imageUrl) =>
				set((s) => {
					const customImages = s.background.customImages.filter((img) => img !== imageUrl);
					const value =
						s.background.value === imageUrl ? "wallpapers/wallpaper1.jpg" : s.background.value;
					return { background: { ...s.background, customImages, value } };
				}),

			// --- Project actions ---
			loadProjectState: (project) => {
				const zoomIds = project.zoomRegions.map((r) => r.id);
				const trimIds = project.trimRegions.map((r) => r.id);
				const annotationIds = project.annotationRegions.map((r) => r.id);
				const maxZIndex = project.annotationRegions.reduce((max, r) => Math.max(max, r.zIndex), 0);

				set({
					videoPath: project.videoPath,
					videoSourcePath: project.videoSourcePath,
					currentProjectPath: project.currentProjectPath,
					error: null,
					isPlaying: false,
					currentTime: 0,
					duration: 0,
					selectedZoomId: null,
					selectedTrimId: null,
					selectedAnnotationId: null,
					aspectRatio: project.aspectRatio,
					nextZoomId: deriveNextId("zoom", zoomIds),
					nextTrimId: deriveNextId("trim", trimIds),
					nextAnnotationId: deriveNextId("annotation", annotationIds),
					nextAnnotationZIndex: maxZIndex + 1,
					effects: {
						shadowIntensity: project.shadowIntensity,
						blurBgEnabled: project.showBlur,
						motionBlurEnabled: project.motionBlurEnabled,
						borderRadius: project.borderRadius,
						padding: project.padding,
					},
					background: {
						...DEFAULT_VIDEO_EDITOR_BACKGROUND,
						value: project.wallpaper,
					},
					regions: {
						cropRegion: project.cropRegion,
						zoomRegions: project.zoomRegions,
						trimRegions: project.trimRegions,
						annotationRegions: project.annotationRegions,
					},
					export: {
						quality: project.exportQuality,
						format: project.exportFormat,
						gifFrameRate: project.gifFrameRate,
						gifLoop: project.gifLoop,
						gifSizePreset: project.gifSizePreset,
					},
				});
			},
		}),
		{
			name: SETTINGS_STORAGE_KEY,
			version: 1,
			partialize: (state) => ({
				effects: state.effects,
				background: state.background,
				export: state.export,
				regions: state.regions,
				ui: state.ui,
				cursor: state.cursor,
			}),
			migrate: (persisted, version) => {
				if (version === 0 || !persisted || typeof persisted !== "object") {
					return {
						effects: { ...DEFAULT_VIDEO_EDITOR_EFFECTS },
						background: { ...DEFAULT_VIDEO_EDITOR_BACKGROUND },
						export: { ...DEFAULT_VIDEO_EDITOR_EXPORT },
						regions: { ...DEFAULT_VIDEO_EDITOR_REGIONS },
						ui: { ...DEFAULT_VIDEO_EDITOR_UI },
						cursor: { ...DEFAULT_VIDEO_EDITOR_CURSOR },
					};
				}
				const stored = persisted as Record<string, unknown>;
				return {
					effects: { ...DEFAULT_VIDEO_EDITOR_EFFECTS, ...(stored.effects as object) },
					background: { ...DEFAULT_VIDEO_EDITOR_BACKGROUND, ...(stored.background as object) },
					export: { ...DEFAULT_VIDEO_EDITOR_EXPORT, ...(stored.export as object) },
					regions: { ...DEFAULT_VIDEO_EDITOR_REGIONS, ...(stored.regions as object) },
					ui: { ...DEFAULT_VIDEO_EDITOR_UI, ...(stored.ui as object) },
					cursor: { ...DEFAULT_VIDEO_EDITOR_CURSOR, ...(stored.cursor as object) },
				};
			},
		},
	),
);
