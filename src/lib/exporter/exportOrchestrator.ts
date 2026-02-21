import type {
	AnnotationRegion,
	CropRegion,
	TrimRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { GifExporter } from "./gifExporter";
import {
	calculateExportDimensions,
	type ExportProgress,
	type ExportQuality,
	type ExportResult,
	type ExportSettings,
} from "./types";
import { VideoExporter } from "./videoExporter";

export interface ExportContext {
	videoPath: string;
	sourceWidth: number;
	sourceHeight: number;
	previewWidth: number;
	previewHeight: number;
	aspectRatio: AspectRatio;
	exportQuality: ExportQuality;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	shadowIntensity: number;
	shadowSize: number;
	shadowOpacity: number;
	shadowBlur: number;
	showBlur: boolean;
	motionBlurEnabled: boolean;
	borderRadius: number;
	borderEnabled: boolean;
	borderWidth: number;
	borderColor: string;
	borderOpacity: number;
	padding: number;
	cropRegion: CropRegion;
	annotationRegions: AnnotationRegion[];
	onProgress: (progress: ExportProgress) => void;
}

export type ExportHandle = { cancel: () => void };

/**
 * Run a full export (GIF or MP4). Returns the result blob
 * and a handle to cancel mid-flight.
 */
export function runExport(
	settings: ExportSettings,
	ctx: ExportContext,
): { promise: Promise<ExportResult>; handle: ExportHandle } {
	if (settings.format === "gif" && settings.gifConfig) {
		return runGifExport(settings, ctx);
	}
	return runMp4Export(settings, ctx);
}

function runGifExport(
	settings: ExportSettings,
	ctx: ExportContext,
): { promise: Promise<ExportResult>; handle: ExportHandle } {
	const gif = settings.gifConfig!;
	const exporter = new GifExporter({
		videoUrl: ctx.videoPath,
		width: gif.width,
		height: gif.height,
		frameRate: gif.frameRate,
		loop: gif.loop,
		sizePreset: gif.sizePreset,
		wallpaper: ctx.wallpaper,
		zoomRegions: ctx.zoomRegions,
		trimRegions: ctx.trimRegions,
		showShadow: ctx.shadowIntensity > 0,
		shadowIntensity: ctx.shadowIntensity,
		shadowSize: ctx.shadowSize,
		shadowOpacity: ctx.shadowOpacity,
		shadowBlur: ctx.shadowBlur,
		showBlur: ctx.showBlur,
		motionBlurEnabled: ctx.motionBlurEnabled,
		borderRadius: ctx.borderRadius,
		borderEnabled: ctx.borderEnabled,
		borderWidth: ctx.borderWidth,
		borderColor: ctx.borderColor,
		borderOpacity: ctx.borderOpacity,
		padding: ctx.padding,
		videoPadding: ctx.padding,
		cropRegion: ctx.cropRegion,
		annotationRegions: ctx.annotationRegions,
		previewWidth: ctx.previewWidth,
		previewHeight: ctx.previewHeight,
		onProgress: ctx.onProgress,
	});

	return {
		promise: exporter.export(),
		handle: { cancel: () => exporter.cancel() },
	};
}

function runMp4Export(
	settings: ExportSettings,
	ctx: ExportContext,
): { promise: Promise<ExportResult>; handle: ExportHandle } {
	const quality = settings.quality || ctx.exportQuality;
	const dims = calculateExportDimensions(
		ctx.sourceWidth,
		ctx.sourceHeight,
		quality,
		ctx.aspectRatio,
	);

	const exporter = new VideoExporter({
		videoUrl: ctx.videoPath,
		width: dims.width,
		height: dims.height,
		frameRate: 60,
		bitrate: dims.bitrate,
		codec: "avc1.640033",
		wallpaper: ctx.wallpaper,
		zoomRegions: ctx.zoomRegions,
		trimRegions: ctx.trimRegions,
		showShadow: ctx.shadowIntensity > 0,
		shadowIntensity: ctx.shadowIntensity,
		shadowSize: ctx.shadowSize,
		shadowOpacity: ctx.shadowOpacity,
		shadowBlur: ctx.shadowBlur,
		showBlur: ctx.showBlur,
		motionBlurEnabled: ctx.motionBlurEnabled,
		borderRadius: ctx.borderRadius,
		borderEnabled: ctx.borderEnabled,
		borderWidth: ctx.borderWidth,
		borderColor: ctx.borderColor,
		borderOpacity: ctx.borderOpacity,
		padding: ctx.padding,
		cropRegion: ctx.cropRegion,
		annotationRegions: ctx.annotationRegions,
		previewWidth: ctx.previewWidth,
		previewHeight: ctx.previewHeight,
		onProgress: ctx.onProgress,
	});

	return {
		promise: exporter.export(),
		handle: { cancel: () => exporter.cancel() },
	};
}
