import {
	Bug,
	Cursor,
	DownloadSimple,
	FilmStrip,
	FloppyDisk,
	FolderOpen,
	Image,
	MagnifyingGlass,
	Palette,
	Sparkle,
	Star,
	Trash,
	UploadSimple,
	X,
} from "@phosphor-icons/react";
import Block from "@uiw/react-color-block";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRADIENTS } from "@/constants/gradients";
import { WALLPAPER_RELATIVE } from "@/constants/wallpapers";
import { getAssetPath } from "@/lib/assetPath";
import type { ExportFormat, ExportQuality, GifFrameRate, GifSizePreset } from "@/lib/exporter";
import { GIF_FRAME_RATES, GIF_SIZE_PRESETS } from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import { CropControl } from "./CropControl";
import { CursorSettingsPanel } from "./CursorSettingsPanel";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import {
	type AnnotationRegion,
	type AnnotationType,
	type CropRegion,
	DEFAULT_CROP_REGION,
	type FigureData,
	type ZoomDepth,
} from "./types";

interface SettingsPanelProps {
	selected: string;
	onWallpaperChange: (path: string) => void;
	selectedZoomDepth?: ZoomDepth | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	selectedZoomId?: string | null;
	onZoomDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onTrimDelete?: (id: string) => void;
	shadowIntensity?: number;
	onShadowChange?: (intensity: number) => void;
	showBlur?: boolean;
	onBlurChange?: (showBlur: boolean) => void;
	motionBlurEnabled?: boolean;
	onMotionBlurChange?: (enabled: boolean) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	padding?: number;
	onPaddingChange?: (padding: number) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	videoElement?: HTMLVideoElement | null;
	exportQuality?: ExportQuality;
	onExportQualityChange?: (quality: ExportQuality) => void;
	// Export format settings
	exportFormat?: ExportFormat;
	onExportFormatChange?: (format: ExportFormat) => void;
	gifFrameRate?: GifFrameRate;
	onGifFrameRateChange?: (rate: GifFrameRate) => void;
	gifLoop?: boolean;
	onGifLoopChange?: (loop: boolean) => void;
	gifSizePreset?: GifSizePreset;
	onGifSizePresetChange?: (preset: GifSizePreset) => void;
	gifOutputDimensions?: { width: number; height: number };
	onSaveProject?: () => void;
	onLoadProject?: () => void;
	onExport?: () => void;
	selectedAnnotationId?: string | null;
	annotationRegions?: AnnotationRegion[];
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationDelete?: (id: string) => void;
	customImages?: string[];
	onCustomImageAdd?: (imageUrl: string) => void;
	onCustomImageRemove?: (imageUrl: string) => void;
	activeBackgroundTab?: "image" | "color" | "gradient";
	onActiveBackgroundTabChange?: (tab: "image" | "color" | "gradient") => void;
	cursorEnabled?: boolean;
	onCursorEnabledChange?: (v: boolean) => void;
	cursorSize?: number;
	onCursorSizeChange?: (v: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (v: number) => void;
	clickHighlight?: boolean;
	onClickHighlightChange?: (v: boolean) => void;
	clickHighlightColor?: string;
	onClickHighlightColorChange?: (v: string) => void;
	showCropModal?: boolean;
	onShowCropModal?: (show: boolean) => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

const SETTINGS_TAB_LABELS: Record<string, string> = {
	effects: "Effects",
	background: "Background Image",
	zoom: "Zoom Controls",
	cursor: "Cursor",
};

export function SettingsPanel({
	selected,
	onWallpaperChange,
	selectedZoomDepth,
	onZoomDepthChange,
	selectedZoomId,
	onZoomDelete,
	selectedTrimId,
	onTrimDelete,
	shadowIntensity = 0,
	onShadowChange,
	showBlur,
	onBlurChange,
	motionBlurEnabled = false,
	onMotionBlurChange,
	borderRadius = 0,
	onBorderRadiusChange,
	padding = 50,
	onPaddingChange,
	cropRegion,
	onCropChange,
	aspectRatio,
	videoElement,
	exportQuality = "good",
	onExportQualityChange,
	exportFormat = "mp4",
	onExportFormatChange,
	gifFrameRate = 15,
	onGifFrameRateChange,
	gifLoop = true,
	onGifLoopChange,
	gifSizePreset = "medium",
	onGifSizePresetChange,
	gifOutputDimensions = { width: 1280, height: 720 },
	onSaveProject,
	onLoadProject,
	onExport,
	selectedAnnotationId,
	annotationRegions = [],
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationDelete,
	customImages = [],
	onCustomImageAdd,
	onCustomImageRemove,
	activeBackgroundTab = "image",
	onActiveBackgroundTabChange,
	cursorEnabled,
	onCursorEnabledChange,
	cursorSize,
	onCursorSizeChange,
	cursorSmoothing,
	onCursorSmoothingChange,
	clickHighlight,
	onClickHighlightChange,
	clickHighlightColor,
	onClickHighlightColorChange,
	showCropModal,
	onShowCropModal,
}: SettingsPanelProps) {
	const [wallpaperPaths, setWallpaperPaths] = useState<string[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const resolved = await Promise.all(WALLPAPER_RELATIVE.map((p) => getAssetPath(p)));
				if (mounted) setWallpaperPaths(resolved);
			} catch {
				if (mounted) setWallpaperPaths(WALLPAPER_RELATIVE.map((p) => `/${p}`));
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);
	const colorPalette = [
		"#FF0000",
		"#FFD700",
		"#00FF00",
		"#FFFFFF",
		"#0000FF",
		"#FF6B00",
		"#9B59B6",
		"#E91E63",
		"#00BCD4",
		"#FF5722",
		"#8BC34A",
		"#FFC107",
		"#f97316",
		"#000000",
		"#607D8B",
		"#795548",
	];

	const [selectedColor, setSelectedColor] = useState("#ADADAD");
	const [gradient, setGradient] = useState<string>(GRADIENTS[0]);

	const [activeSettingsTab, setActiveSettingsTab] = useState<string>("effects");
	const activeTabLabel = SETTINGS_TAB_LABELS[activeSettingsTab] ?? "Settings";

	const zoomEnabled = Boolean(selectedZoomDepth);
	const trimEnabled = Boolean(selectedTrimId);

	const handleDeleteClick = () => {
		if (selectedZoomId && onZoomDelete) {
			onZoomDelete(selectedZoomId);
		}
	};

	const handleTrimDeleteClick = () => {
		if (selectedTrimId && onTrimDelete) {
			onTrimDelete(selectedTrimId);
		}
	};

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type - only allow JPG/JPEG
		const validTypes = ["image/jpeg", "image/jpg"];
		if (!validTypes.includes(file.type)) {
			toast.error("Invalid file type", {
				description: "Please upload a JPG or JPEG image file.",
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				onCustomImageAdd?.(dataUrl);
				onWallpaperChange(dataUrl);
				toast.success("Custom image uploaded successfully!");
			}
		};

		reader.onerror = () => {
			toast.error("Failed to upload image", {
				description: "There was an error reading the file.",
			});
		};

		reader.readAsDataURL(file);
		// Reset input so the same file can be selected again
		event.target.value = "";
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		onCustomImageRemove?.(imageUrl);
		// If the removed image was selected, clear selection
		if (selected === imageUrl) {
			onWallpaperChange(wallpaperPaths[0] || WALLPAPER_RELATIVE[0]);
		}
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

	// If an annotation is selected, show annotation settings instead
	if (
		selectedAnnotation &&
		onAnnotationContentChange &&
		onAnnotationTypeChange &&
		onAnnotationStyleChange &&
		onAnnotationDelete
	) {
		return (
			<AnnotationSettingsPanel
				annotation={selectedAnnotation}
				onContentChange={(content) => onAnnotationContentChange(selectedAnnotation.id, content)}
				onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
				onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
				onFigureDataChange={
					onAnnotationFigureDataChange
						? (figureData) => onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
						: undefined
				}
				onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
			/>
		);
	}

	return (
		<div className="flex h-full min-w-0 flex-[2] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--cc-border-strong))]/75 bg-gradient-to-b from-[#0f141d] via-[#0c1119] to-[#090d13] shadow-[0_20px_48px_rgba(2,8,23,0.55)] backdrop-blur-xl">
			<div className="custom-scrollbar flex-1 overflow-y-auto p-3.5 pb-0">
				<Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
					<TabsList className="mb-3.5 grid h-11 w-full grid-cols-4 rounded-xl border border-white/10 bg-black/35 p-1">
						<TabsTrigger
							value="effects"
							className="rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
							title="Effects"
						>
							<Sparkle size={16} weight="duotone" />
							<span>Effects</span>
						</TabsTrigger>
						<TabsTrigger
							value="background"
							className="rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
							title="Background"
						>
							<Image size={16} weight="duotone" />
							<span>Background</span>
						</TabsTrigger>
						<TabsTrigger
							value="zoom"
							className="rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
							title="Zoom"
						>
							<MagnifyingGlass size={16} weight="duotone" />
							<span>Zoom</span>
						</TabsTrigger>
						<TabsTrigger
							value="cursor"
							className="rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
							title="Cursor"
						>
							<Cursor size={16} weight="duotone" />
							<span>Cursor</span>
						</TabsTrigger>
					</TabsList>
					<div className="mb-3 border-b border-white/10 pb-2">
						<p className="text-sm font-semibold text-slate-100">{activeTabLabel}</p>
					</div>

					<TabsContent
						value="effects"
						className="mt-0 space-y-2.5 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
					>
						<div className="space-y-2">
							<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
								<div className="text-[11px] font-medium text-slate-300">Motion Blur</div>
								<Switch
									checked={motionBlurEnabled}
									onCheckedChange={onMotionBlurChange}
									className="data-[state=checked]:bg-cc-accent scale-90"
								/>
							</div>
							<div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
								<div className="text-[11px] font-medium text-slate-300">Blur BG</div>
								<Switch
									checked={showBlur}
									onCheckedChange={onBlurChange}
									className="data-[state=checked]:bg-cc-accent scale-90"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="flex items-center justify-between mb-1.5">
									<div className="text-[11px] font-medium text-slate-300">Shadow</div>
									<span className="text-[10px] text-slate-500 font-mono">
										{Math.round(shadowIntensity * 100)}%
									</span>
								</div>
								<Slider
									value={[shadowIntensity]}
									onValueChange={(values) => onShadowChange?.(values[0])}
									min={0}
									max={1}
									step={0.01}
									className="w-full"
								/>
							</div>
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="flex items-center justify-between mb-1.5">
									<div className="text-[11px] font-medium text-slate-300">Roundness</div>
									<span className="text-[10px] text-slate-500 font-mono">{borderRadius}px</span>
								</div>
								<Slider
									value={[borderRadius]}
									onValueChange={(values) => onBorderRadiusChange?.(values[0])}
									min={0}
									max={16}
									step={0.5}
									className="w-full"
								/>
							</div>
						</div>

						<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
							<div className="flex items-center justify-between mb-1.5">
								<div className="text-[11px] font-medium text-slate-300">Padding</div>
								<span className="text-[10px] text-slate-500 font-mono">{padding}%</span>
							</div>
							<Slider
								value={[padding]}
								onValueChange={(values) => onPaddingChange?.(values[0])}
								min={0}
								max={100}
								step={1}
								className="w-full"
							/>
						</div>
					</TabsContent>

					<TabsContent
						value="background"
						className="mt-0 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
					>
						<Tabs
							value={activeBackgroundTab}
							onValueChange={(value) =>
								onActiveBackgroundTabChange?.(value as "image" | "color" | "gradient")
							}
							className="w-full"
						>
							<TabsList className="mb-3 grid h-9 w-full grid-cols-3 rounded-xl border border-white/10 bg-black/30 p-1">
								<TabsTrigger
									value="image"
									className="gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
								>
									<Image size={14} />
									Image
								</TabsTrigger>
								<TabsTrigger
									value="color"
									className="gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
								>
									<Palette size={14} weight="duotone" />
									Color
								</TabsTrigger>
								<TabsTrigger
									value="gradient"
									className="gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
								>
									<Sparkle size={14} weight="duotone" />
									Gradient
								</TabsTrigger>
							</TabsList>

							<div className="max-h-[min(280px,35vh)] overflow-y-auto custom-scrollbar">
								<TabsContent value="image" className="mt-0 space-y-2">
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImageUpload}
										accept=".jpg,.jpeg,image/jpeg"
										className="hidden"
									/>
									<Button
										onClick={() => fileInputRef.current?.click()}
										variant="outline"
										className="h-8 w-full gap-2 border-white/10 bg-white/[0.04] text-[11px] text-slate-200 transition-all duration-200 hover:border-cc-accent/60 hover:bg-cc-accent hover:text-white active:scale-[0.98]"
									>
										<UploadSimple size={14} />
										Upload Custom
									</Button>

									<div className="grid grid-cols-5 gap-2">
										{customImages.map((imageUrl, idx) => {
											const isSelected = selected === imageUrl;
											return (
												<div
													key={`custom-${idx}`}
													className={cn(
														"group relative h-10 w-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:scale-[1.03] active:scale-95",
														isSelected
															? "border-cc-accent ring-1 ring-cc-accent/30"
															: "border-white/10 hover:border-cc-accent/40 opacity-80 hover:opacity-100 bg-white/5",
													)}
													style={{
														backgroundImage: `url(${imageUrl})`,
														backgroundSize: "cover",
														backgroundPosition: "center",
													}}
													onClick={() => onWallpaperChange(imageUrl)}
													role="button"
												>
													<button
														onClick={(e) => handleRemoveCustomImage(imageUrl, e)}
														className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
													>
														<X size={8} weight="bold" className="text-white" />
													</button>
												</div>
											);
										})}

										{(wallpaperPaths.length > 0
											? wallpaperPaths
											: WALLPAPER_RELATIVE.map((p) => `/${p}`)
										).map((path) => {
											const isSelected = (() => {
												if (!selected) return false;
												if (selected === path) return true;
												try {
													const clean = (s: string) =>
														s.replace(/^file:\/\//, "").replace(/^\//, "");
													if (clean(selected).endsWith(clean(path))) return true;
													if (clean(path).endsWith(clean(selected))) return true;
												} catch {
													// path comparison failed, treat as non-match
												}
												return false;
											})();
											return (
												<div
													key={path}
													className={cn(
														"aspect-square h-10 w-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:scale-[1.03] active:scale-95",
														isSelected
															? "border-cc-accent ring-1 ring-cc-accent/30"
															: "border-white/10 hover:border-cc-accent/40 opacity-80 hover:opacity-100 bg-white/5",
													)}
													style={{
														backgroundImage: `url(${path})`,
														backgroundSize: "cover",
														backgroundPosition: "center",
													}}
													onClick={() => onWallpaperChange(path)}
													role="button"
												/>
											);
										})}
									</div>
								</TabsContent>

								<TabsContent value="color" className="mt-0">
									<div className="p-1">
										<Block
											color={selectedColor}
											colors={colorPalette}
											onChange={(color) => {
												setSelectedColor(color.hex);
												onWallpaperChange(color.hex);
											}}
											style={{
												width: "100%",
												borderRadius: "8px",
											}}
										/>
									</div>
								</TabsContent>

								<TabsContent value="gradient" className="mt-0">
									<div className="grid grid-cols-5 gap-2">
										{GRADIENTS.map((g, idx) => (
											<div
												key={g}
												className={cn(
													"aspect-square h-10 w-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:scale-[1.03] active:scale-95",
													gradient === g
														? "border-cc-accent ring-1 ring-cc-accent/30"
														: "border-white/10 hover:border-cc-accent/40 opacity-80 hover:opacity-100 bg-white/5",
												)}
												style={{ background: g }}
												aria-label={`Gradient ${idx + 1}`}
												onClick={() => {
													setGradient(g);
													onWallpaperChange(g);
												}}
												role="button"
											/>
										))}
									</div>
								</TabsContent>
							</div>
						</Tabs>
					</TabsContent>

					<TabsContent
						value="zoom"
						className="mt-0 space-y-3 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
					>
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-medium text-slate-200">Zoom Level</span>
							<div className="flex items-center gap-2">
								{zoomEnabled && selectedZoomDepth && (
									<span className="text-[10px] uppercase tracking-wider font-medium text-cc-accent bg-cc-accent/10 px-2 py-0.5 rounded-full">
										{ZOOM_DEPTH_OPTIONS.find((o) => o.depth === selectedZoomDepth)?.label}
									</span>
								)}
								<KeyboardShortcutsHelp />
							</div>
						</div>
						<div className="grid grid-cols-6 gap-1.5">
							{ZOOM_DEPTH_OPTIONS.map((option) => {
								const isActive = selectedZoomDepth === option.depth;
								return (
									<Button
										key={option.depth}
										type="button"
										disabled={!zoomEnabled}
										onClick={() => onZoomDepthChange?.(option.depth)}
										className={cn(
											"h-auto w-full rounded-lg border px-1 py-2 text-center shadow-sm transition-all active:scale-[0.98]",
											"duration-200 ease-out",
											zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
											isActive
												? "border-cc-accent bg-cc-accent text-white shadow-cc-accent/20"
												: "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200",
										)}
									>
										<span className="text-xs font-semibold">{option.label}</span>
									</Button>
								);
							})}
						</div>
						{!zoomEnabled && (
							<p className="text-[10px] text-slate-500 text-center">
								Select a zoom region to adjust
							</p>
						)}
						{zoomEnabled && (
							<Button
								onClick={handleDeleteClick}
								variant="destructive"
								size="sm"
								className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20 active:scale-[0.98]"
							>
								<Trash size={12} />
								Delete Zoom
							</Button>
						)}
						{trimEnabled && (
							<Button
								onClick={handleTrimDeleteClick}
								variant="destructive"
								size="sm"
								className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/20 active:scale-[0.98]"
							>
								<Trash size={12} />
								Delete Trim Region
							</Button>
						)}
					</TabsContent>

					<TabsContent
						value="cursor"
						className="mt-0 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
					>
						<CursorSettingsPanel
							cursorEnabled={cursorEnabled}
							onCursorEnabledChange={onCursorEnabledChange}
							cursorSize={cursorSize}
							onCursorSizeChange={onCursorSizeChange}
							cursorSmoothing={cursorSmoothing}
							onCursorSmoothingChange={onCursorSmoothingChange}
							clickHighlight={clickHighlight}
							onClickHighlightChange={onClickHighlightChange}
							clickHighlightColor={clickHighlightColor}
							onClickHighlightColorChange={onClickHighlightColorChange}
						/>
					</TabsContent>
				</Tabs>
			</div>

			{showCropModal &&
				cropRegion &&
				onCropChange &&
				typeof document !== "undefined" &&
				createPortal(
					<>
						<div
							className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
							onClick={() => onShowCropModal?.(false)}
						/>
						<div className="fixed top-1/2 left-1/2 z-[60] w-[92vw] max-w-6xl max-h-[92vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
							<div className="mb-3 flex items-center justify-between">
								<div>
									<span className="text-xl font-bold text-slate-200">Crop Video</span>
									<p className="mt-1 text-sm text-slate-400">
										Drag edges, corners, or the center box to reframe your shot
									</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => onShowCropModal?.(false)}
									className="text-slate-400 hover:bg-white/10 hover:text-white"
								>
									<X size={20} weight="bold" />
								</Button>
							</div>
							<CropControl
								videoElement={videoElement || null}
								cropRegion={cropRegion}
								onCropChange={onCropChange}
								aspectRatio={aspectRatio}
								onReset={() => onCropChange(DEFAULT_CROP_REGION)}
							/>
							<div className="mt-5 flex justify-center">
								<Button
									onClick={() => onShowCropModal?.(false)}
									size="sm"
									className="rounded-full bg-white px-6 text-black hover:bg-slate-200"
								>
									Save
								</Button>
							</div>
						</div>
					</>,
					document.body,
				)}

			<div className="flex-shrink-0 border-t border-white/10 bg-black/20 p-4 pt-3">
				<div className="mb-3 flex items-center gap-2">
					<button
						onClick={() => onExportFormatChange?.("mp4")}
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
							exportFormat === "mp4"
								? "bg-cc-accent/10 border-cc-accent/50 text-white"
								: "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200",
						)}
					>
						<FilmStrip size={14} />
						MP4
					</button>
					<button
						onClick={() => onExportFormatChange?.("gif")}
						className={cn(
							"flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
							exportFormat === "gif"
								? "bg-cc-accent/10 border-cc-accent/50 text-white"
								: "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200",
						)}
					>
						<Image size={14} />
						GIF
					</button>
				</div>

				{exportFormat === "mp4" && (
					<div className="mb-3 bg-white/5 border border-white/5 p-0.5 w-full grid grid-cols-3 h-7 rounded-lg">
						<button
							onClick={() => onExportQualityChange?.("medium")}
							className={cn(
								"rounded-md text-[10px] font-medium transition-all duration-200 active:scale-[0.98]",
								exportQuality === "medium"
									? "bg-white text-black"
									: "text-slate-400 hover:text-slate-200",
							)}
						>
							Low
						</button>
						<button
							onClick={() => onExportQualityChange?.("good")}
							className={cn(
								"rounded-md text-[10px] font-medium transition-all duration-200 active:scale-[0.98]",
								exportQuality === "good"
									? "bg-white text-black"
									: "text-slate-400 hover:text-slate-200",
							)}
						>
							Medium
						</button>
						<button
							onClick={() => onExportQualityChange?.("source")}
							className={cn(
								"rounded-md text-[10px] font-medium transition-all duration-200 active:scale-[0.98]",
								exportQuality === "source"
									? "bg-white text-black"
									: "text-slate-400 hover:text-slate-200",
							)}
						>
							High
						</button>
					</div>
				)}

				{exportFormat === "gif" && (
					<div className="mb-3 space-y-2">
						<div className="flex items-center gap-2">
							<div className="flex-1 bg-white/5 border border-white/5 p-0.5 grid grid-cols-4 h-7 rounded-lg">
								{GIF_FRAME_RATES.map((rate) => (
									<button
										key={rate.value}
										onClick={() => onGifFrameRateChange?.(rate.value)}
										className={cn(
											"rounded-md text-[10px] font-medium transition-all duration-200 active:scale-[0.98]",
											gifFrameRate === rate.value
												? "bg-white text-black"
												: "text-slate-400 hover:text-slate-200",
										)}
									>
										{rate.value}
									</button>
								))}
							</div>
							<div className="flex-1 bg-white/5 border border-white/5 p-0.5 grid grid-cols-3 h-7 rounded-lg">
								{Object.entries(GIF_SIZE_PRESETS).map(([key, _preset]) => (
									<button
										key={key}
										onClick={() => onGifSizePresetChange?.(key as GifSizePreset)}
										className={cn(
											"rounded-md text-[10px] font-medium transition-all duration-200 active:scale-[0.98]",
											gifSizePreset === key
												? "bg-white text-black"
												: "text-slate-400 hover:text-slate-200",
										)}
									>
										{key === "original" ? "Orig" : key.charAt(0).toUpperCase() + key.slice(1, 3)}
									</button>
								))}
							</div>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-[10px] text-slate-500">
								{gifOutputDimensions.width} × {gifOutputDimensions.height}px
							</span>
							<div className="flex items-center gap-2">
								<span className="text-[10px] text-slate-400">Loop</span>
								<Switch
									checked={gifLoop}
									onCheckedChange={onGifLoopChange}
									className="data-[state=checked]:bg-cc-accent scale-75"
								/>
							</div>
						</div>
					</div>
				)}

				<div className="grid grid-cols-2 gap-2 mb-2">
					<Button
						type="button"
						variant="outline"
						onClick={onLoadProject}
						className="h-8 gap-1.5 border-white/10 bg-white/5 text-[10px] font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
					>
						<FolderOpen size={14} />
						Load Project
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={onSaveProject}
						className="h-8 gap-1.5 border-white/10 bg-white/5 text-[10px] font-medium text-slate-300 transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
					>
						<FloppyDisk size={14} />
						Save Project
					</Button>
				</div>

				<Button
					type="button"
					size="lg"
					onClick={onExport}
					className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 py-5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all duration-200 hover:brightness-110 hover:scale-[1.01] active:scale-[0.98]"
				>
					<DownloadSimple size={16} weight="bold" />
					Export {exportFormat === "gif" ? "GIF" : "Video"}
				</Button>

				<div className="mt-3 flex gap-2">
					<button
						type="button"
						onClick={() => {
							window.electronAPI?.openExternalUrl(
								"https://github.com/prime399/CrossCap/issues/new/choose",
							);
						}}
						className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[10px] text-slate-500 transition-all duration-200 hover:text-slate-300 active:scale-[0.98]"
					>
						<Bug size={12} className="text-cc-accent" />
						Report Bug
					</button>
					<button
						type="button"
						onClick={() => {
							window.electronAPI?.openExternalUrl("https://github.com/prime399/CrossCap");
						}}
						className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[10px] text-slate-500 transition-all duration-200 hover:text-slate-300 active:scale-[0.98]"
					>
						<Star size={12} weight="fill" className="text-yellow-400" />
						Star on GitHub
					</button>
				</div>
			</div>
		</div>
	);
}
