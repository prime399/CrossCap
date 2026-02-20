import type {
	AnnotationRegion,
	CropRegion,
	TrimRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { GifExporter } from "./gifExporter";
import type { ExportProgress, ExportQuality, ExportResult, ExportSettings } from "./types";
import { VideoExporter } from "./videoExporter";

export interface ExportDimensions {
	width: number;
	height: number;
	bitrate: number;
}

/**
 * Calculate MP4 export dimensions and bitrate from quality preset,
 * source dimensions, and aspect ratio.
 */
export function calculateExportDimensions(
	sourceWidth: number,
	sourceHeight: number,
	quality: ExportQuality,
	aspectRatio: AspectRatio,
): ExportDimensions {
	const aspectRatioValue = getAspectRatioValue(aspectRatio);

	if (quality === "source") {
		return calculateSourceDimensions(sourceWidth, sourceHeight, aspectRatioValue);
	}

	const targetHeight = quality === "medium" ? 720 : 1080;
	const exportHeight = Math.floor(targetHeight / 2) * 2;
	const exportWidth = Math.floor((exportHeight * aspectRatioValue) / 2) * 2;

	const totalPixels = exportWidth * exportHeight;
	let bitrate = 30_000_000;
	if (totalPixels <= 1280 * 720) {
		bitrate = 10_000_000;
	} else if (totalPixels <= 1920 * 1080) {
		bitrate = 20_000_000;
	}

	return { width: exportWidth, height: exportHeight, bitrate };
}

function calculateSourceDimensions(
	sourceWidth: number,
	sourceHeight: number,
	aspectRatioValue: number,
): ExportDimensions {
	let exportWidth = sourceWidth;
	let exportHeight = sourceHeight;

	if (aspectRatioValue === 1) {
		const base = Math.floor(Math.min(sourceWidth, sourceHeight) / 2) * 2;
		exportWidth = base;
		exportHeight = base;
	} else if (aspectRatioValue > 1) {
		const result = findEvenDimensionsByWidth(sourceWidth, aspectRatioValue);
		exportWidth = result.width;
		exportHeight = result.height;
	} else {
		const result = findEvenDimensionsByHeight(sourceHeight, aspectRatioValue);
		exportWidth = result.width;
		exportHeight = result.height;
	}

	const totalPixels = exportWidth * exportHeight;
	let bitrate = 30_000_000;
	if (totalPixels > 1920 * 1080 && totalPixels <= 2560 * 1440) {
		bitrate = 50_000_000;
	} else if (totalPixels > 2560 * 1440) {
		bitrate = 80_000_000;
	}

	return { width: exportWidth, height: exportHeight, bitrate };
}

function findEvenDimensionsByWidth(
	sourceWidth: number,
	aspectRatioValue: number,
): { width: number; height: number } {
	const baseWidth = Math.floor(sourceWidth / 2) * 2;
	for (let w = baseWidth; w >= 100; w -= 2) {
		const h = Math.round(w / aspectRatioValue);
		if (h % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
			return { width: w, height: h };
		}
	}
	return {
		width: baseWidth,
		height: Math.floor(baseWidth / aspectRatioValue / 2) * 2,
	};
}

function findEvenDimensionsByHeight(
	sourceHeight: number,
	aspectRatioValue: number,
): { width: number; height: number } {
	const baseHeight = Math.floor(sourceHeight / 2) * 2;
	for (let h = baseHeight; h >= 100; h -= 2) {
		const w = Math.round(h * aspectRatioValue);
		if (w % 2 === 0 && Math.abs(w / h - aspectRatioValue) < 0.0001) {
			return { width: w, height: h };
		}
	}
	return {
		width: Math.floor((baseHeight * aspectRatioValue) / 2) * 2,
		height: baseHeight,
	};
}

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
	showBlur: boolean;
	motionBlurEnabled: boolean;
	borderRadius: number;
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
		showBlur: ctx.showBlur,
		motionBlurEnabled: ctx.motionBlurEnabled,
		borderRadius: ctx.borderRadius,
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
		showBlur: ctx.showBlur,
		motionBlurEnabled: ctx.motionBlurEnabled,
		borderRadius: ctx.borderRadius,
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
