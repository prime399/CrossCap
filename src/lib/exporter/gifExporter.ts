import GIF from "gif.js";
import type {
	AnnotationRegion,
	CropRegion,
	TrimRegion,
	ZoomRegion,
} from "@/components/video-editor/types";
import { FrameRenderer } from "./frameRenderer";
import { StreamingVideoDecoder } from "./streamingDecoder";
import type { ExportProgress, ExportResult, GifFrameRate, GifSizePreset } from "./types";

const GIF_WORKER_URL = new URL("gif.js/dist/gif.worker.js", import.meta.url).toString();

interface GifExporterConfig {
	videoUrl: string;
	width: number;
	height: number;
	frameRate: GifFrameRate;
	loop: boolean;
	sizePreset: GifSizePreset;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions?: TrimRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	shadowSize?: number;
	shadowOpacity?: number;
	shadowBlur?: number;
	showBlur: boolean;
	motionBlurEnabled?: boolean;
	borderRadius?: number;
	borderEnabled?: boolean;
	borderWidth?: number;
	borderColor?: string;
	borderOpacity?: number;
	padding?: number;
	videoPadding?: number;
	cropRegion: CropRegion;
	annotationRegions?: AnnotationRegion[];
	previewWidth?: number;
	previewHeight?: number;
	onProgress?: (progress: ExportProgress) => void;
}

export class GifExporter {
	private config: GifExporterConfig;
	private streamingDecoder: StreamingVideoDecoder | null = null;
	private renderer: FrameRenderer | null = null;
	private gif: GIF | null = null;
	private cancelled = false;

	constructor(config: GifExporterConfig) {
		this.config = config;
	}

	async export(): Promise<ExportResult> {
		try {
			this.cleanup();
			this.cancelled = false;

			// Initialize streaming decoder and load video metadata
			this.streamingDecoder = new StreamingVideoDecoder();
			const videoInfo = await this.streamingDecoder.loadMetadata(this.config.videoUrl);

			// Initialize frame renderer
			this.renderer = new FrameRenderer({
				width: this.config.width,
				height: this.config.height,
				wallpaper: this.config.wallpaper,
				zoomRegions: this.config.zoomRegions,
				showShadow: this.config.showShadow,
				shadowIntensity: this.config.shadowIntensity,
				shadowSize: this.config.shadowSize,
				shadowOpacity: this.config.shadowOpacity,
				shadowBlur: this.config.shadowBlur,
				showBlur: this.config.showBlur,
				motionBlurEnabled: this.config.motionBlurEnabled,
				borderRadius: this.config.borderRadius,
				borderEnabled: this.config.borderEnabled,
				borderWidth: this.config.borderWidth,
				borderColor: this.config.borderColor,
				borderOpacity: this.config.borderOpacity,
				padding: this.config.padding,
				cropRegion: this.config.cropRegion,
				videoWidth: videoInfo.width,
				videoHeight: videoInfo.height,
				annotationRegions: this.config.annotationRegions,
				previewWidth: this.config.previewWidth,
				previewHeight: this.config.previewHeight,
			});
			await this.renderer.initialize();

			// Initialize GIF encoder
			// Loop: 0 = infinite loop, 1 = play once (no loop)
			const repeat = this.config.loop ? 0 : 1;

			this.gif = new GIF({
				workers: 4,
				quality: 10,
				width: this.config.width,
				height: this.config.height,
				workerScript: GIF_WORKER_URL,
				repeat,
				background: "#000000",
				transparent: null,
				dither: "FloydSteinberg",
			});

			// Calculate effective duration and frame count (excluding trim regions)
			const effectiveDuration = this.streamingDecoder.getEffectiveDuration(this.config.trimRegions);
			const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);

			// Calculate frame delay in milliseconds (gif.js uses ms)
			const frameDelay = Math.round(1000 / this.config.frameRate);

			console.log("[GifExporter] Original duration:", videoInfo.duration, "s");
			console.log("[GifExporter] Effective duration:", effectiveDuration, "s");
			console.log("[GifExporter] Total frames to export:", totalFrames);
			console.log("[GifExporter] Frame rate:", this.config.frameRate, "FPS");
			console.log("[GifExporter] Frame delay:", frameDelay, "ms");
			console.log("[GifExporter] Loop:", this.config.loop ? "infinite" : "once");
			console.log("[GifExporter] Using streaming decode (web-demuxer + VideoDecoder)");

			let frameIndex = 0;
			const renderStartMs = performance.now();
			let smoothedEtaSeconds = 0;

			// Stream decode and process frames — no seeking!
			await this.streamingDecoder.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					// Render the frame with all effects using source timestamp
					const sourceTimestampUs = sourceTimestampMs * 1000; // Convert to microseconds
					await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					videoFrame.close();

					// Get the rendered canvas and add to GIF
					const canvas = this.renderer!.getCanvas();

					// Add frame to GIF encoder with delay
					this.gif!.addFrame(canvas, { delay: frameDelay, copy: true });

					frameIndex++;
					const elapsedSeconds = Math.max((performance.now() - renderStartMs) / 1000, 0.001);
					const framesPerSecond = frameIndex / elapsedSeconds;
					const remainingFrames = Math.max(totalFrames - frameIndex, 0);
					const rawEtaSeconds =
						framesPerSecond > 0 ? remainingFrames / framesPerSecond : smoothedEtaSeconds;
					smoothedEtaSeconds =
						frameIndex <= 1 || smoothedEtaSeconds <= 0
							? rawEtaSeconds
							: smoothedEtaSeconds * 0.8 + rawEtaSeconds * 0.2;

					// Update progress
					if (this.config.onProgress) {
						this.config.onProgress({
							currentFrame: frameIndex,
							totalFrames,
							percentage: (frameIndex / totalFrames) * 100,
							estimatedTimeRemaining: Math.max(0, smoothedEtaSeconds),
						});
					}
				},
			);

			if (this.cancelled) {
				return { success: false, error: "Export cancelled" };
			}

			// Update progress to show we're now in the finalizing phase
			if (this.config.onProgress) {
				this.config.onProgress({
					currentFrame: totalFrames,
					totalFrames,
					percentage: 100,
					estimatedTimeRemaining: Math.max(3, smoothedEtaSeconds * 0.25),
					phase: "finalizing",
					renderProgress: 0,
					phaseDetail: "Preparing GIF encoder",
				});
			}

			// Render the GIF — with reject path and stall detection
			const blob = await new Promise<Blob>((resolve, reject) => {
				const compileStartMs = performance.now();
				let compileEtaSeconds = Math.max(3, smoothedEtaSeconds * 0.25);
				let lastProgressTime = performance.now();
				let settled = false;

				const STALL_TIMEOUT_MS = 30_000;
				const stallTimer = setInterval(() => {
					if (settled) return;
					if (this.cancelled) {
						settled = true;
						clearInterval(stallTimer);
						reject(new Error("GIF export cancelled"));
						return;
					}
					if (performance.now() - lastProgressTime > STALL_TIMEOUT_MS) {
						settled = true;
						clearInterval(stallTimer);
						reject(new Error("GIF encoding stalled — no progress for 30s"));
					}
				}, 2_000);

				this.gif!.on("finished", (blob: Blob) => {
					if (settled) return;
					settled = true;
					clearInterval(stallTimer);
					resolve(blob);
				});

				// Track rendering progress
				this.gif!.on("progress", (progress: number) => {
					lastProgressTime = performance.now();
					const elapsedSeconds = Math.max((performance.now() - compileStartMs) / 1000, 0.001);
					const normalizedProgress = Math.max(progress, 0.001);
					const rawEtaSeconds = Math.max(
						0,
						elapsedSeconds * ((1 - normalizedProgress) / normalizedProgress),
					);
					compileEtaSeconds = compileEtaSeconds * 0.7 + rawEtaSeconds * 0.3;
					if (this.config.onProgress) {
						this.config.onProgress({
							currentFrame: totalFrames,
							totalFrames,
							percentage: 100,
							estimatedTimeRemaining: Math.max(0, compileEtaSeconds),
							phase: "finalizing",
							renderProgress: Math.round(progress * 100),
							phaseDetail: "Encoding GIF frames",
						});
					}
				});

				this.gif!.render();
			});

			return { success: true, blob };
		} catch (error) {
			console.error("GIF Export error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			this.cleanup();
		}
	}

	cancel(): void {
		this.cancelled = true;
		if (this.streamingDecoder) {
			this.streamingDecoder.cancel();
		}
		if (this.gif) {
			this.gif.abort();
		}
		this.cleanup();
	}

	private cleanup(): void {
		if (this.streamingDecoder) {
			try {
				this.streamingDecoder.destroy();
			} catch (e) {
				console.warn("Error destroying streaming decoder:", e);
			}
			this.streamingDecoder = null;
		}

		if (this.renderer) {
			try {
				this.renderer.destroy();
			} catch (e) {
				console.warn("Error destroying renderer:", e);
			}
			this.renderer = null;
		}

		this.gif = null;
	}
}
