import {
	Bug,
	Cursor,
	DotsThree,
	Export,
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GRADIENTS } from "@/constants/gradients";
import { WALLPAPER_RELATIVE } from "@/constants/wallpapers";
import { getAssetPath } from "@/lib/assetPath";
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
	shadowSize?: number;
	onShadowSizeChange?: (value: number) => void;
	shadowOpacity?: number;
	onShadowOpacityChange?: (value: number) => void;
	shadowBlur?: number;
	onShadowBlurChange?: (value: number) => void;
	showBlur?: boolean;
	onBlurChange?: (showBlur: boolean) => void;
	motionBlurEnabled?: boolean;
	onMotionBlurChange?: (enabled: boolean) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	cornerStyle?: "rounded" | "squircle" | "sharp";
	onCornerStyleChange?: (style: "rounded" | "squircle" | "sharp") => void;
	borderEnabled?: boolean;
	onBorderEnabledChange?: (enabled: boolean) => void;
	borderWidth?: number;
	onBorderWidthChange?: (width: number) => void;
	borderColor?: string;
	onBorderColorChange?: (color: string) => void;
	borderOpacity?: number;
	onBorderOpacityChange?: (opacity: number) => void;
	padding?: number;
	onPaddingChange?: (padding: number) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	videoElement?: HTMLVideoElement | null;
	onSaveProject?: () => void;
	onLoadProject?: () => void;
	onOpenExportPage?: () => void;
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
	{ depth: 1, label: "1.25x" },
	{ depth: 2, label: "1.5x" },
	{ depth: 3, label: "1.8x" },
	{ depth: 4, label: "2.2x" },
	{ depth: 5, label: "3.5x" },
	{ depth: 6, label: "5x" },
];

const SETTINGS_TAB_LABELS: Record<string, string> = {
	effects: "Effects",
	background: "Background",
	zoom: "Zoom",
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
	shadowSize = 0.4,
	onShadowSizeChange,
	shadowOpacity = 0.6,
	onShadowOpacityChange,
	shadowBlur = 0.45,
	onShadowBlurChange,
	showBlur = false,
	onBlurChange,
	motionBlurEnabled = false,
	onMotionBlurChange,
	borderRadius = 0,
	onBorderRadiusChange,
	cornerStyle = "squircle",
	onCornerStyleChange,
	borderEnabled = false,
	onBorderEnabledChange,
	borderWidth = 2,
	onBorderWidthChange,
	borderColor = "#000000",
	onBorderColorChange,
	borderOpacity = 0.85,
	onBorderOpacityChange,
	padding = 50,
	onPaddingChange,
	cropRegion,
	onCropChange,
	aspectRatio,
	videoElement,
	onSaveProject,
	onLoadProject,
	onOpenExportPage,
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
	const [activeSettingsTab, setActiveSettingsTab] = useState<string>("effects");
	const [selectedColor, setSelectedColor] = useState("#ADADAD");
	const [gradient, setGradient] = useState<string>(GRADIENTS[0]);
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

	const activeTabLabel = SETTINGS_TAB_LABELS[activeSettingsTab] ?? "Settings";
	const zoomEnabled = Boolean(selectedZoomDepth);
	const trimEnabled = Boolean(selectedTrimId);

	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

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

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!["image/jpeg", "image/jpg"].includes(file.type)) {
			toast.error("Invalid file type", {
				description: "Please upload a JPG or JPEG image file.",
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (!dataUrl) return;
			onCustomImageAdd?.(dataUrl);
			onWallpaperChange(dataUrl);
			toast.success("Custom image uploaded successfully");
		};
		reader.onerror = () => {
			toast.error("Failed to upload image", {
				description: "There was an error reading the file.",
			});
		};
		reader.readAsDataURL(file);
		event.target.value = "";
	};

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[hsl(var(--cc-border-strong))]/75 bg-gradient-to-b from-[#0f141d] via-[#0c1119] to-[#090d13] shadow-[0_20px_48px_rgba(2,8,23,0.55)] backdrop-blur-xl">
			<div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5 pb-3">
				<Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab} className="w-full">
					<div className="custom-scrollbar mb-3.5 overflow-x-auto">
						<TabsList className="inline-flex h-11 min-w-full rounded-xl border border-white/10 bg-black/35 p-1">
							<TabsTrigger
								value="effects"
								className="min-w-14 rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
								title="Effects"
							>
								<Sparkle size={16} weight="duotone" />
								<span>Effects</span>
							</TabsTrigger>
							<TabsTrigger
								value="background"
								className="min-w-14 rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
								title="Background"
							>
								<Image size={16} weight="duotone" />
								<span>Background</span>
							</TabsTrigger>
							<TabsTrigger
								value="zoom"
								className="min-w-14 rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
								title="Zoom"
							>
								<MagnifyingGlass size={16} weight="duotone" />
								<span>Zoom</span>
							</TabsTrigger>
							<TabsTrigger
								value="cursor"
								className="min-w-14 rounded-lg text-slate-300 transition-all duration-200 hover:text-white active:scale-[0.98] [&>span]:sr-only"
								title="Cursor"
							>
								<Cursor size={16} weight="duotone" />
								<span>Cursor</span>
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
						<p className="text-sm font-semibold text-slate-100">{activeTabLabel}</p>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-md border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white"
								>
									<DotsThree size={16} weight="bold" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-48 border-white/10 bg-cc-popover text-slate-200"
							>
								<DropdownMenuItem onClick={onLoadProject} className="cursor-pointer text-xs">
									<FolderOpen size={14} />
									Load Project
								</DropdownMenuItem>
								<DropdownMenuItem onClick={onSaveProject} className="cursor-pointer text-xs">
									<FloppyDisk size={14} />
									Save Project
								</DropdownMenuItem>
								<DropdownMenuItem onClick={onOpenExportPage} className="cursor-pointer text-xs">
									<Export size={14} />
									Open Export Page
								</DropdownMenuItem>
								<DropdownMenuSeparator className="bg-white/10" />
								<DropdownMenuItem
									onClick={() =>
										window.electronAPI?.openExternalUrl(
											"https://github.com/prime399/CrossCap/issues/new/choose",
										)
									}
									className="cursor-pointer text-xs"
								>
									<Bug size={14} />
									Report Bug
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										window.electronAPI?.openExternalUrl("https://github.com/prime399/CrossCap")
									}
									className="cursor-pointer text-xs"
								>
									<Star size={14} weight="fill" className="text-yellow-400" />
									Star on GitHub
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<TabsContent
						value="effects"
						className="mt-0 space-y-2.5 animate-in fade-in-50 slide-in-from-bottom-1 duration-200"
					>
						<div className="space-y-2">
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="mb-1.5 flex items-center justify-between">
									<div className="text-[11px] font-semibold text-slate-200">Padding</div>
									<span className="font-mono text-[10px] text-slate-500">{padding}%</span>
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
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="mb-1.5 flex items-center justify-between">
									<div className="text-[11px] font-semibold text-slate-200">Rounded Corners</div>
									<span className="font-mono text-[10px] text-slate-500">{borderRadius}px</span>
								</div>
								<Slider
									value={[borderRadius]}
									onValueChange={(values) => onBorderRadiusChange?.(values[0])}
									min={0}
									max={28}
									step={1}
									className="w-full"
								/>
								<div className="mt-2">
									<label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
										Corner Style
									</label>
									<select
										value={cornerStyle}
										onChange={(e) =>
											onCornerStyleChange?.(e.target.value as "rounded" | "squircle" | "sharp")
										}
										className="h-8 w-full rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm text-slate-100"
									>
										<option value="squircle">Squircle</option>
										<option value="rounded">Rounded</option>
										<option value="sharp">Sharp</option>
									</select>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="mb-1.5 flex items-center justify-between">
									<div className="text-[11px] font-semibold text-slate-200">Motion Blur</div>
									<Switch
										checked={motionBlurEnabled}
										onCheckedChange={onMotionBlurChange}
										className="scale-90 data-[state=checked]:bg-cc-accent"
									/>
								</div>
							</div>
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="mb-1.5 flex items-center justify-between">
									<div className="text-[11px] font-semibold text-slate-200">Border</div>
									<Switch
										checked={borderEnabled}
										onCheckedChange={onBorderEnabledChange}
										className="scale-90 data-[state=checked]:bg-cc-accent"
									/>
								</div>
								{borderEnabled && (
									<div className="space-y-2">
										<div>
											<div className="mb-1.5 flex items-center justify-between">
												<div className="text-[11px] font-medium text-slate-300">Border Width</div>
												<span className="font-mono text-[10px] text-slate-500">
													{borderWidth}px
												</span>
											</div>
											<Slider
												value={[borderWidth]}
												onValueChange={(values) => onBorderWidthChange?.(values[0])}
												min={0}
												max={20}
												step={1}
												className="w-full"
											/>
										</div>
										<div>
											<div className="mb-1.5 text-[11px] font-medium text-slate-300">
												Border Color
											</div>
											<div className="flex items-center gap-2">
												<input
													type="color"
													value={borderColor}
													onChange={(e) => onBorderColorChange?.(e.target.value)}
													className="h-9 w-9 rounded-md border border-white/10 bg-transparent p-0"
												/>
												<input
													type="text"
													value={borderColor}
													onChange={(e) => onBorderColorChange?.(e.target.value)}
													className="h-9 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-sm text-slate-100"
												/>
											</div>
										</div>
										<div>
											<div className="mb-1.5 flex items-center justify-between">
												<div className="text-[11px] font-medium text-slate-300">Border Opacity</div>
												<span className="font-mono text-[10px] text-slate-500">
													{Math.round(borderOpacity * 100)}%
												</span>
											</div>
											<Slider
												value={[borderOpacity]}
												onValueChange={(values) => onBorderOpacityChange?.(values[0])}
												min={0}
												max={1}
												step={0.01}
												className="w-full"
											/>
										</div>
									</div>
								)}
							</div>
							<div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
								<div className="mb-1.5 flex items-center justify-between">
									<div className="text-[11px] font-semibold text-slate-200">Shadow</div>
									<span className="font-mono text-[10px] text-slate-500">
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
								<div className="mb-2 text-[11px] font-semibold text-slate-100">
									Advanced shadow settings
								</div>
								<div className="space-y-2">
									<div>
										<div className="mb-1.5 flex items-center justify-between">
											<div className="text-[11px] font-medium text-slate-300">Size</div>
											<span className="font-mono text-[10px] text-slate-500">
												{Math.round(shadowSize * 100)}%
											</span>
										</div>
										<Slider
											value={[shadowSize]}
											onValueChange={(values) => onShadowSizeChange?.(values[0])}
											min={0}
											max={1}
											step={0.01}
											className="w-full"
										/>
									</div>
									<div>
										<div className="mb-1.5 flex items-center justify-between">
											<div className="text-[11px] font-medium text-slate-300">Opacity</div>
											<span className="font-mono text-[10px] text-slate-500">
												{Math.round(shadowOpacity * 100)}%
											</span>
										</div>
										<Slider
											value={[shadowOpacity]}
											onValueChange={(values) => onShadowOpacityChange?.(values[0])}
											min={0}
											max={1}
											step={0.01}
											className="w-full"
										/>
									</div>
									<div>
										<div className="mb-1.5 flex items-center justify-between">
											<div className="text-[11px] font-medium text-slate-300">Blur</div>
											<span className="font-mono text-[10px] text-slate-500">
												{Math.round(shadowBlur * 100)}%
											</span>
										</div>
										<Slider
											value={[shadowBlur]}
											onValueChange={(values) => onShadowBlurChange?.(values[0])}
											min={0}
											max={1}
											step={0.01}
											className="w-full"
										/>
									</div>
									<div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
										<div className="text-[11px] font-medium text-slate-300">Blur Background</div>
										<Switch
											checked={showBlur}
											onCheckedChange={onBlurChange}
											className="scale-90 data-[state=checked]:bg-cc-accent"
										/>
									</div>
								</div>
							</div>
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
							<div className="custom-scrollbar mb-3 overflow-x-auto">
								<TabsList className="inline-flex h-9 min-w-full rounded-xl border border-white/10 bg-black/30 p-1">
									<TabsTrigger
										value="image"
										className="min-w-[90px] gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
									>
										<Image size={14} />
										Image
									</TabsTrigger>
									<TabsTrigger
										value="color"
										className="min-w-[90px] gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
									>
										<Palette size={14} weight="duotone" />
										Color
									</TabsTrigger>
									<TabsTrigger
										value="gradient"
										className="min-w-[90px] gap-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-[0.98]"
									>
										<Sparkle size={14} weight="duotone" />
										Gradient
									</TabsTrigger>
								</TabsList>
							</div>

							<div className="custom-scrollbar max-h-[min(280px,35vh)] overflow-y-auto">
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
															: "border-white/10 bg-white/5 opacity-80 hover:border-cc-accent/40 hover:opacity-100",
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
														onClick={(e) => {
															e.stopPropagation();
															onCustomImageRemove?.(imageUrl);
															if (selected === imageUrl)
																onWallpaperChange(wallpaperPaths[0] || WALLPAPER_RELATIVE[0]);
														}}
														className="absolute right-0.5 top-0.5 z-10 flex h-3 w-3 items-center justify-center rounded-full bg-red-500/90 opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
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
											const isSelected =
												selected === path ||
												selected.replace(/^file:\/\//, "").endsWith(path.replace(/^\//, ""));
											return (
												<div
													key={path}
													className={cn(
														"h-10 w-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:scale-[1.03] active:scale-95",
														isSelected
															? "border-cc-accent ring-1 ring-cc-accent/30"
															: "border-white/10 bg-white/5 opacity-80 hover:border-cc-accent/40 hover:opacity-100",
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
											style={{ width: "100%", borderRadius: "8px" }}
										/>
									</div>
								</TabsContent>

								<TabsContent value="gradient" className="mt-0">
									<div className="grid grid-cols-5 gap-2">
										{GRADIENTS.map((g, idx) => (
											<div
												key={g}
												className={cn(
													"h-10 w-full cursor-pointer overflow-hidden rounded-md border shadow-sm transition-all duration-200 hover:scale-[1.03] active:scale-95",
													gradient === g
														? "border-cc-accent ring-1 ring-cc-accent/30"
														: "border-white/10 bg-white/5 opacity-80 hover:border-cc-accent/40 hover:opacity-100",
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
									<span className="rounded-full bg-cc-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cc-accent">
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
											"h-auto w-full rounded-lg border px-1 py-2 text-center shadow-sm transition-all duration-200 active:scale-[0.98]",
											zoomEnabled ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-40",
											isActive
												? "border-cc-accent bg-cc-accent text-white shadow-cc-accent/20"
												: "border-white/5 bg-white/5 text-slate-400 hover:border-white/10 hover:bg-white/10 hover:text-slate-200",
										)}
									>
										<span className="text-xs font-semibold">{option.label}</span>
									</Button>
								);
							})}
						</div>
						{!zoomEnabled && (
							<p className="text-center text-[10px] text-slate-500">
								Select a zoom region to adjust
							</p>
						)}
						{zoomEnabled && (
							<Button
								onClick={() => selectedZoomId && onZoomDelete?.(selectedZoomId)}
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
								onClick={() => selectedTrimId && onTrimDelete?.(selectedTrimId)}
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
							className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
							onClick={() => onShowCropModal?.(false)}
						/>
						<div className="fixed left-1/2 top-1/2 z-[60] max-h-[92vh] w-[92vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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
		</div>
	);
}
