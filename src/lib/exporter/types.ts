import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { getAspectRatioValue } from "@/utils/aspectRatioUtils";

export interface ExportConfig {
	width: number;
	height: number;
	frameRate: number;
	bitrate: number;
	codec?: string;
}

export interface ExportProgress {
	currentFrame: number;
	totalFrames: number;
	percentage: number;
	estimatedTimeRemaining: number; // in seconds
	phase?: "extracting" | "finalizing"; // Phase of export
	renderProgress?: number; // 0-100, progress of GIF rendering phase
}

export interface ExportResult {
	success: boolean;
	blob?: Blob;
	error?: string;
}

export interface VideoFrameData {
	frame: VideoFrame;
	timestamp: number; // in microseconds
	duration: number; // in microseconds
}

export type ExportQuality = "medium" | "good" | "source";

// GIF Export Types
export type ExportFormat = "mp4" | "gif";

export type GifFrameRate = 15 | 20 | 25 | 30;

export type GifSizePreset = "medium" | "large" | "original";

export interface GifExportConfig {
	frameRate: GifFrameRate;
	loop: boolean;
	sizePreset: GifSizePreset;
	width: number;
	height: number;
}

export interface ExportSettings {
	format: ExportFormat;
	// MP4 settings
	quality?: ExportQuality;
	// GIF settings
	gifConfig?: GifExportConfig;
}

export const GIF_SIZE_PRESETS: Record<GifSizePreset, { maxHeight: number; label: string }> = {
	medium: { maxHeight: 720, label: "Medium (720p)" },
	large: { maxHeight: 1080, label: "Large (1080p)" },
	original: { maxHeight: Infinity, label: "Original" },
};

export const GIF_FRAME_RATES: { value: GifFrameRate; label: string }[] = [
	{ value: 15, label: "15 FPS - Balanced" },
	{ value: 20, label: "20 FPS - Smooth" },
	{ value: 25, label: "25 FPS - Very smooth" },
	{ value: 30, label: "30 FPS - Maximum" },
];

// Valid frame rates for validation
export const VALID_GIF_FRAME_RATES: readonly GifFrameRate[] = [15, 20, 25, 30] as const;

export function isValidGifFrameRate(rate: number): rate is GifFrameRate {
	return VALID_GIF_FRAME_RATES.includes(rate as GifFrameRate);
}

/**
 * Calculate output dimensions for a given size preset, preserving aspect ratio.
 */
export function calculateOutputDimensions(
	sourceWidth: number,
	sourceHeight: number,
	sizePreset: GifSizePreset,
	sizePresets: typeof GIF_SIZE_PRESETS,
): { width: number; height: number } {
	const preset = sizePresets[sizePreset];
	const maxHeight = preset.maxHeight;

	if (sourceHeight <= maxHeight || sizePreset === "original") {
		return { width: sourceWidth, height: sourceHeight };
	}

	const aspectRatio = sourceWidth / sourceHeight;
	const newHeight = maxHeight;
	const newWidth = Math.round(newHeight * aspectRatio);

	return {
		width: newWidth % 2 === 0 ? newWidth : newWidth + 1,
		height: newHeight % 2 === 0 ? newHeight : newHeight + 1,
	};
}

export interface ExportDimensions {
	width: number;
	height: number;
	bitrate: number;
}

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
