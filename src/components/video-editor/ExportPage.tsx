import { ArrowLeft, Copy, Export, FilmStrip, FloppyDisk, LinkSimple } from "@phosphor-icons/react";
import type React from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	type ExportFormat,
	type ExportQuality,
	GIF_FRAME_RATES,
	GIF_SIZE_PRESETS,
} from "@/lib/exporter";
import { cn } from "@/lib/utils";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import PlaybackControls from "./PlaybackControls";
import type { AnnotationRegion, CropRegion, TrimRegion, ZoomRegion } from "./types";
import VideoPlayback, { type VideoPlaybackRef } from "./VideoPlayback";

interface ExportPageProps {
	onBack: () => void;
	onSaveProject?: () => void;
	onExport: () => void;
	videoPlaybackRef: React.RefObject<VideoPlaybackRef>;
	videoPath: string;
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	onTogglePlayPause: () => void;
	onSeek: (time: number) => void;
	onDurationChange: (duration: number) => void;
	onTimeUpdate: (time: number) => void;
	onPlayStateChange: (playing: boolean) => void;
	onError: (error: string) => void;
	aspectRatio: AspectRatio;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	annotationRegions: AnnotationRegion[];
	showShadow?: boolean;
	shadowIntensity?: number;
	shadowSize?: number;
	shadowOpacity?: number;
	shadowBlur?: number;
	showBlur?: boolean;
	motionBlurEnabled?: boolean;
	borderRadius?: number;
	borderEnabled?: boolean;
	borderWidth?: number;
	borderColor?: string;
	borderOpacity?: number;
	padding?: number;
	cropRegion?: CropRegion;
	exportFormat: ExportFormat;
	onExportFormatChange: (format: ExportFormat) => void;
	exportQuality: ExportQuality;
	onExportQualityChange: (quality: ExportQuality) => void;
	gifFrameRate: 15 | 20 | 25 | 30;
	onGifFrameRateChange: (rate: 15 | 20 | 25 | 30) => void;
	gifLoop: boolean;
	onGifLoopChange: (loop: boolean) => void;
	gifSizePreset: "medium" | "large" | "original";
	onGifSizePresetChange: (preset: "medium" | "large" | "original") => void;
	gifOutputDimensions: { width: number; height: number };
}

export function ExportPage({
	onBack,
	onSaveProject,
	onExport,
	videoPlaybackRef,
	videoPath,
	currentTime,
	duration,
	isPlaying,
	onTogglePlayPause,
	onSeek,
	onDurationChange,
	onTimeUpdate,
	onPlayStateChange,
	onError,
	aspectRatio,
	wallpaper,
	zoomRegions,
	trimRegions,
	annotationRegions,
	showShadow,
	shadowIntensity,
	shadowSize,
	shadowOpacity,
	shadowBlur,
	showBlur,
	motionBlurEnabled,
	borderRadius,
	borderEnabled,
	borderWidth,
	borderColor,
	borderOpacity,
	padding,
	cropRegion,
	exportFormat,
	onExportFormatChange,
	exportQuality,
	onExportQualityChange,
	gifFrameRate,
	onGifFrameRateChange,
	gifLoop,
	onGifLoopChange,
	gifSizePreset,
	onGifSizePresetChange,
	gifOutputDimensions,
}: ExportPageProps) {
	const ignoreZoomSelection = () => undefined;
	const ignoreZoomFocus = () => undefined;

	const resolutionValue = useMemo(() => {
		if (exportQuality === "medium") return "720p";
		if (exportQuality === "good") return "1080p";
		return "4k";
	}, [exportQuality]);

	const estimatedSizeLabel = useMemo(() => {
		if (exportFormat === "gif") return "larger";
		if (exportQuality === "source") return "larger";
		if (exportQuality === "medium") return "smaller";
		return "balanced";
	}, [exportFormat, exportQuality]);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-[#0a0d12] text-slate-100">
			<div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-white/5 px-4">
				<Button
					type="button"
					onClick={onBack}
					variant="ghost"
					className="h-8 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 hover:bg-white/10"
				>
					<ArrowLeft size={14} weight="bold" />
					Back to Editor
				</Button>
				<span className="text-sm font-semibold">Export</span>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						onClick={onSaveProject}
						variant="ghost"
						className="h-8 rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-300 hover:bg-white/10"
					>
						<FloppyDisk size={14} />
						Save
					</Button>
					<Button
						type="button"
						onClick={onExport}
						className="h-8 rounded-full bg-[#2f6feb] px-4 text-xs font-semibold text-white hover:bg-[#3b82f6]"
					>
						<Export size={14} weight="bold" />
						Export
					</Button>
				</div>
			</div>

			<div className="flex min-h-0 flex-1">
				<div className="min-h-0 flex-1 p-4">
					<div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0e131c] p-3">
						<div className="mb-2 flex items-center justify-between px-1 text-xs text-slate-400">
							<span>Preview</span>
							<span>
								{Math.round(gifOutputDimensions.width)}x{Math.round(gifOutputDimensions.height)}
							</span>
						</div>
						<div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
							<div
								className="relative h-full max-h-full"
								style={{
									aspectRatio: getAspectRatioValue(aspectRatio),
									maxWidth: "100%",
								}}
							>
								<VideoPlayback
									key={videoPath || "export-preview"}
									ref={videoPlaybackRef}
									aspectRatio={aspectRatio}
									videoPath={videoPath}
									onDurationChange={onDurationChange}
									onTimeUpdate={onTimeUpdate}
									currentTime={currentTime}
									onPlayStateChange={onPlayStateChange}
									onError={onError}
									wallpaper={wallpaper}
									zoomRegions={zoomRegions}
									selectedZoomId={null}
									onSelectZoom={ignoreZoomSelection}
									onZoomFocusChange={ignoreZoomFocus}
									isPlaying={isPlaying}
									showShadow={showShadow}
									shadowIntensity={shadowIntensity}
									shadowSize={shadowSize}
									shadowOpacity={shadowOpacity}
									shadowBlur={shadowBlur}
									showBlur={showBlur}
									motionBlurEnabled={motionBlurEnabled}
									borderRadius={borderRadius}
									borderEnabled={borderEnabled}
									borderWidth={borderWidth}
									borderColor={borderColor}
									borderOpacity={borderOpacity}
									padding={padding}
									cropRegion={cropRegion}
									trimRegions={trimRegions}
									annotationRegions={annotationRegions}
									selectedAnnotationId={null}
								/>
							</div>
						</div>
						<div className="mt-3 flex justify-center">
							<div className="w-full max-w-[560px]">
								<PlaybackControls
									isPlaying={isPlaying}
									currentTime={currentTime}
									duration={duration}
									onTogglePlayPause={onTogglePlayPause}
									onSeek={onSeek}
								/>
							</div>
						</div>
						<div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-400">
							<span>{Math.max(duration, 0).toFixed(0)}s</span>
							<span>{resolutionValue}</span>
							<span>{estimatedSizeLabel} file</span>
						</div>
					</div>
				</div>

				<div className="w-[320px] flex-shrink-0 border-l border-white/10 bg-[#12161e]">
					<div className="custom-scrollbar h-full overflow-y-auto p-4">
						<div className="space-y-5">
							<section>
								<div className="mb-2 text-xs font-semibold text-slate-200">Destination</div>
								<div className="grid grid-cols-3 gap-2">
									<button
										type="button"
										className="rounded-lg border border-white/10 bg-white/10 px-2 py-2 text-[11px] font-semibold text-white"
									>
										<FilmStrip size={14} className="mx-auto mb-1" />
										File
									</button>
									<button
										type="button"
										disabled
										className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-2 text-[11px] font-medium text-slate-500"
									>
										<Copy size={14} className="mx-auto mb-1" />
										Clipboard
									</button>
									<button
										type="button"
										disabled
										className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-2 text-[11px] font-medium text-slate-500"
									>
										<LinkSimple size={14} className="mx-auto mb-1" />
										Link
									</button>
								</div>
							</section>

							<section>
								<div className="mb-2 text-xs font-semibold text-slate-200">Format</div>
								<div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
									<button
										type="button"
										onClick={() => onExportFormatChange("mp4")}
										className={cn(
											"rounded-md py-1.5 text-xs font-semibold transition",
											exportFormat === "mp4"
												? "bg-white text-black"
												: "text-slate-400 hover:text-slate-100",
										)}
									>
										MP4
									</button>
									<button
										type="button"
										onClick={() => onExportFormatChange("gif")}
										className={cn(
											"rounded-md py-1.5 text-xs font-semibold transition",
											exportFormat === "gif"
												? "bg-white text-black"
												: "text-slate-400 hover:text-slate-100",
										)}
									>
										GIF
									</button>
								</div>
							</section>

							{exportFormat === "mp4" && (
								<>
									<section>
										<div className="mb-2 text-xs font-semibold text-slate-200">Resolution</div>
										<div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
											<button
												type="button"
												onClick={() => onExportQualityChange("medium")}
												className={cn(
													"rounded-md py-1.5 text-xs font-semibold transition",
													exportQuality === "medium"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												720p
											</button>
											<button
												type="button"
												onClick={() => onExportQualityChange("good")}
												className={cn(
													"rounded-md py-1.5 text-xs font-semibold transition",
													exportQuality === "good"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												1080p
											</button>
											<button
												type="button"
												onClick={() => onExportQualityChange("source")}
												className={cn(
													"rounded-md py-1.5 text-xs font-semibold transition",
													exportQuality === "source"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												4K
											</button>
										</div>
									</section>

									<section>
										<div className="mb-2 text-xs font-semibold text-slate-200">Quality</div>
										<div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
											<button
												type="button"
												onClick={() => onExportQualityChange("medium")}
												className={cn(
													"rounded-md py-1.5 text-[11px] font-medium transition",
													exportQuality === "medium"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												Potato
											</button>
											<button
												type="button"
												onClick={() => onExportQualityChange("good")}
												className={cn(
													"rounded-md py-1.5 text-[11px] font-medium transition",
													exportQuality === "good"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												Web
											</button>
											<button
												type="button"
												onClick={() => onExportQualityChange("source")}
												className={cn(
													"rounded-md py-1.5 text-[11px] font-medium transition",
													exportQuality === "source"
														? "bg-white text-black"
														: "text-slate-400 hover:text-slate-100",
												)}
											>
												Maximum
											</button>
										</div>
									</section>
								</>
							)}

							{exportFormat === "gif" && (
								<>
									<section>
										<div className="mb-2 text-xs font-semibold text-slate-200">Frame Rate</div>
										<div className="grid grid-cols-4 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
											{GIF_FRAME_RATES.map((rate) => (
												<button
													key={rate.value}
													type="button"
													onClick={() => onGifFrameRateChange(rate.value)}
													className={cn(
														"rounded-md py-1.5 text-xs font-semibold transition",
														gifFrameRate === rate.value
															? "bg-white text-black"
															: "text-slate-400 hover:text-slate-100",
													)}
												>
													{rate.value}
												</button>
											))}
										</div>
									</section>
									<section>
										<div className="mb-2 text-xs font-semibold text-slate-200">Size</div>
										<div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-black/25 p-1">
											{Object.entries(GIF_SIZE_PRESETS).map(([key]) => (
												<button
													key={key}
													type="button"
													onClick={() =>
														onGifSizePresetChange(key as "medium" | "large" | "original")
													}
													className={cn(
														"rounded-md py-1.5 text-xs font-semibold transition",
														gifSizePreset === key
															? "bg-white text-black"
															: "text-slate-400 hover:text-slate-100",
													)}
												>
													{key === "original" ? "Orig" : key}
												</button>
											))}
										</div>
										<p className="mt-2 text-[11px] text-slate-400">
											Output: {gifOutputDimensions.width}x{gifOutputDimensions.height}
										</p>
									</section>
									<section className="rounded-lg border border-white/10 bg-black/25 p-2.5">
										<div className="flex items-center justify-between">
											<span className="text-xs font-semibold text-slate-200">Loop GIF</span>
											<Switch
												checked={gifLoop}
												onCheckedChange={onGifLoopChange}
												className="data-[state=checked]:bg-cc-accent"
											/>
										</div>
									</section>
								</>
							)}

							<section>
								<div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-200">
									<span>Advanced</span>
									<span className="text-[11px] font-mono text-slate-400">
										{exportFormat === "mp4" ? "0.50" : "GIF"}
									</span>
								</div>
								<Slider
									value={[exportFormat === "mp4" ? 0.5 : 1]}
									min={0.1}
									max={1}
									step={0.01}
									disabled
									className="w-full"
								/>
							</section>
						</div>
					</div>
					<div className="border-t border-white/10 p-3">
						<Button
							type="button"
							onClick={onExport}
							className="h-11 w-full rounded-xl bg-[#2f6feb] text-sm font-semibold text-white transition hover:bg-[#3b82f6] active:scale-[0.99]"
						>
							<Export size={15} weight="bold" />
							Export to File
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
